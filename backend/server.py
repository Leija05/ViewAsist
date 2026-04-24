import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import Cookie, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, EmailStr
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

app = FastAPI(title="ViewAsist API", version="2.0.0")

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# In-memory stores (no DB)
# ----------------------------
SETTINGS: Dict[str, Any] = {
    "entry_time": "09:00",
    "tolerance_minutes": 30,
    "work_hours": 9,
}
REPORTS: List[Dict[str, Any]] = []
SESSIONS: Dict[str, Dict[str, Any]] = {}

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@empresa.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


class LoginPayload(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = True


class SettingsPayload(BaseModel):
    entry_time: str = "09:00"
    tolerance_minutes: int = 30
    work_hours: int = 9


def _parse_attendance_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in df.to_dict(orient="records"):
        employee_id = str(row.get("employee_id") or row.get("id") or row.get("ID") or "").strip()
        employee_name = str(row.get("employee_name") or row.get("name") or row.get("Nombre") or "Sin nombre").strip()
        status = str(row.get("status") or row.get("estado") or "presente").strip().lower()
        date_value = row.get("date") or row.get("fecha") or datetime.now(timezone.utc).date().isoformat()

        if not employee_id:
            continue

        rows.append(
            {
                "employee_id": employee_id,
                "employee_name": employee_name or f"Empleado {employee_id}",
                "status": status,
                "date": str(date_value),
                "department": str(row.get("department") or row.get("departamento") or "General"),
                "arrival_time": str(row.get("arrival_time") or row.get("entrada") or "09:00"),
            }
        )
    return rows


def _require_user(session_id: Optional[str]) -> Dict[str, Any]:
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(status_code=401, detail="No autenticado")
    return SESSIONS[session_id]["user"]


def _dashboard_stats() -> Dict[str, Any]:
    if not REPORTS:
        return {
            "total_employees": 0,
            "present_today": 0,
            "late_today": 0,
            "absent_today": 0,
            "attendance_rate": 0,
            "recent_reports": 0,
            "weekly_trend": [],
        }

    latest = REPORTS[-1]
    records = latest.get("attendance_records", [])
    total = len({r["employee_id"] for r in records})
    present = len([r for r in records if r.get("status") == "presente"])
    late = len([r for r in records if r.get("status") in {"retardo", "late"}])
    absent = len([r for r in records if r.get("status") in {"falta", "absente", "absent"}])

    attendance_rate = round((present / total) * 100, 1) if total else 0
    return {
        "total_employees": total,
        "present_today": present,
        "late_today": late,
        "absent_today": absent,
        "attendance_rate": attendance_rate,
        "recent_reports": len(REPORTS),
        "weekly_trend": [
            {"day": "Lun", "attendance": max(attendance_rate - 6, 0)},
            {"day": "Mar", "attendance": max(attendance_rate - 3, 0)},
            {"day": "Mié", "attendance": attendance_rate},
            {"day": "Jue", "attendance": min(attendance_rate + 2, 100)},
            {"day": "Vie", "attendance": min(attendance_rate + 1, 100)},
        ],
    }


@app.get("/api/")
def health() -> Dict[str, str]:
    return {"status": "ok", "backend": "fastapi", "database": "disabled"}


@app.post("/api/auth/login")
def login(payload: LoginPayload, response: Response) -> Dict[str, Any]:
    if payload.email != ADMIN_EMAIL or payload.password != ADMIN_PASSWORD:
        response.delete_cookie("session_id")
        return {"authenticated": False, "detail": "Credenciales inválidas"}

    session_id = secrets.token_urlsafe(32)
    user = {"id": "admin", "email": ADMIN_EMAIL, "name": "Administrador", "authenticated": True}
    expiration = datetime.now(timezone.utc) + (timedelta(days=30) if payload.remember_me else timedelta(hours=8))

    SESSIONS[session_id] = {"user": user, "expires_at": expiration}

    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30 if payload.remember_me else 60 * 60 * 8,
    )
    return user


@app.get("/api/auth/me")
def me(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    if not session_id or session_id not in SESSIONS:
        return {"authenticated": False}
    return SESSIONS[session_id]["user"]


@app.post("/api/auth/logout")
def logout(response: Response, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, str]:
    if session_id in SESSIONS:
        del SESSIONS[session_id]
    response.delete_cookie("session_id")
    return {"message": "Sesión cerrada"}


@app.get("/api/dashboard/stats")
def get_dashboard_stats(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    return _dashboard_stats()


@app.get("/api/settings")
def get_settings(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    return SETTINGS


@app.put("/api/settings")
def update_settings(payload: SettingsPayload, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    SETTINGS.update(payload.model_dump())
    return SETTINGS


@app.get("/api/version")
def get_version(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, str]:
    _require_user(session_id)
    return {"current_version": "2.0.0", "latest_version": "2.0.0", "up_to_date": True}


@app.post("/api/check-updates")
def check_updates(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    return {"up_to_date": True, "message": "No hay actualizaciones disponibles"}


@app.post("/api/upload/excel")
async def upload_excel(file: UploadFile = File(...), session_id: Optional[str] = Cookie(default=None)) -> Dict[str, str]:
    _require_user(session_id)
    content = await file.read()
    try:
        excel_data = pd.read_excel(io.BytesIO(content), sheet_name=None)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {exc}") from exc

    preview = {}
    records: List[Dict[str, Any]] = []
    for sheet_name, df in excel_data.items():
        preview[sheet_name] = df.head(25).fillna("").to_dict(orient="records")
        records.extend(_parse_attendance_rows(df.fillna("")))

    report_id = secrets.token_hex(8)
    report = {
        "id": report_id,
        "filename": file.filename,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "attendance_records": records,
        "excel_preview": preview,
    }
    REPORTS.append(report)
    return {"report_id": report_id, "message": "Archivo cargado"}


@app.get("/api/reports")
def list_reports(session_id: Optional[str] = Cookie(default=None)) -> List[Dict[str, Any]]:
    _require_user(session_id)
    return [
        {
            "id": r["id"],
            "filename": r["filename"],
            "upload_date": r["upload_date"],
            "records_count": len(r.get("attendance_records", [])),
        }
        for r in reversed(REPORTS)
    ]


@app.get("/api/reports/{report_id}")
def get_report(report_id: str, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    report = next((r for r in REPORTS if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@app.get("/api/reports/{report_id}/excel-preview")
def get_excel_preview(report_id: str, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    report = next((r for r in REPORTS if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report.get("excel_preview", {})


@app.get("/api/reports/{report_id}/pdf")
def get_report_pdf(report_id: str, session_id: Optional[str] = Cookie(default=None)) -> StreamingResponse:
    _require_user(session_id)
    report = next((r for r in REPORTS if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.setFont("Helvetica-Bold", 14)
    p.drawString(72, 760, "ViewAsist - Reporte")
    p.setFont("Helvetica", 10)
    p.drawString(72, 740, f"Archivo: {report['filename']}")
    p.drawString(72, 725, f"Registros: {len(report.get('attendance_records', []))}")
    p.drawString(72, 710, f"Fecha de carga: {report['upload_date']}")
    p.showPage()
    p.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reporte_{report_id}.pdf"},
    )


@app.get("/api/reports/export")
def export_reports(session_id: Optional[str] = Cookie(default=None)) -> StreamingResponse:
    _require_user(session_id)
    rows: List[Dict[str, Any]] = []
    for report in REPORTS:
        for row in report.get("attendance_records", []):
            rows.append({**row, "report_id": report["id"], "filename": report["filename"]})

    df = pd.DataFrame(rows)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_bytes = io.BytesIO(csv_buffer.getvalue().encode("utf-8"))
    return StreamingResponse(
        csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historial_asistencia.csv"},
    )


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: str, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, str]:
    _require_user(session_id)
    idx = next((i for i, r in enumerate(REPORTS) if r["id"] == report_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    REPORTS.pop(idx)
    return {"message": "Reporte eliminado"}


@app.post("/api/reports/sync")
def sync_reports(session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    raise HTTPException(status_code=410, detail="La sincronización con reloj checador fue removida.")


@app.get("/api/employees/{employee_id}/history")
def employee_history(employee_id: str, session_id: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    _require_user(session_id)
    history: List[Dict[str, Any]] = []
    for report in REPORTS:
        for row in report.get("attendance_records", []):
            if row.get("employee_id") == employee_id:
                history.append(row)
    return {"employee_id": employee_id, "history": history}
