from __future__ import annotations

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import io
import csv
import json
import secrets

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "local_db.json"


def _default_db() -> Dict[str, Any]:
    return {
        "users": [
            {
                "id": "admin",
                "email": "admin@viewasist.local",
                "password": "admin123",
                "name": "Administrador",
                "role": "admin",
            }
        ],
        "sessions": {},
        "settings": {"expected_entry": "09:00", "tolerance_minutes": 10},
        "clock_config": {"connected": False, "ip": "", "port": 4370, "password": ""},
        "clock_settings": {"settings": {"late_threshold_minutes": 10}},
        "clock_users": [],
        "clock_events": [],
        "reports": [],
        "version": "2.0.0-local"
    }


def _load_db() -> Dict[str, Any]:
    if not DB_PATH.exists():
        db = _default_db()
        DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
        return db
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


def _save_db(db: Dict[str, Any]) -> None:
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = True


app = FastAPI(title="ViewAsist Local")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _user_by_session(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    db = _load_db()
    user_id = db["sessions"].get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario inválido")
    return user


@api.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    db = _load_db()
    user = next((u for u in db["users"] if u["email"].lower() == payload.email.lower()), None)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = secrets.token_urlsafe(32)
    db["sessions"][token] = user["id"]
    _save_db(db)
    response.set_cookie("access_token", token, httponly=True, samesite="lax")
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    db = _load_db()
    db["sessions"].pop(token, None)
    _save_db(db)
    response.delete_cookie("access_token")
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request):
    user = _user_by_session(request)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


@api.get("/settings")
async def get_settings(request: Request):
    _user_by_session(request)
    return _load_db()["settings"]

@api.put("/settings")
async def put_settings(payload: Dict[str, Any], request: Request):
    _user_by_session(request)
    db = _load_db(); db["settings"] = payload; _save_db(db); return payload

@api.get("/dashboard/stats")
async def stats(request: Request):
    _user_by_session(request)
    db = _load_db()
    total = len(db["reports"])
    faltas = sum(r.get("absences", 0) for r in db["reports"])
    retardos = sum(r.get("late_arrivals", 0) for r in db["reports"])
    return {"total_reports": total, "total_absences": faltas, "total_late_arrivals": retardos}

@api.post("/upload/excel")
async def upload_excel(request: Request, file: UploadFile = File(...)):
    _user_by_session(request)
    content = await file.read()
    report_id = secrets.token_hex(8)
    now = datetime.now(timezone.utc).isoformat()
    db = _load_db()
    db["reports"].append({
        "id": report_id,
        "filename": file.filename,
        "created_at": now,
        "rows": len(content.splitlines()),
        "absences": 0,
        "late_arrivals": 0,
        "raw_size": len(content),
    })
    _save_db(db)
    return {"report_id": report_id, "message": "Reporte cargado en almacenamiento local"}

@api.get('/reports')
async def reports(request: Request):
    _user_by_session(request)
    return _load_db()["reports"]

@api.get('/reports/{report_id}')
async def report(report_id: str, request: Request):
    _user_by_session(request)
    r = next((x for x in _load_db()["reports"] if x["id"] == report_id), None)
    if not r: raise HTTPException(404, "No encontrado")
    return r

@api.delete('/reports/{report_id}')
async def report_delete(report_id: str, request: Request):
    _user_by_session(request)
    db = _load_db(); db["reports"] = [x for x in db["reports"] if x["id"] != report_id]; _save_db(db)
    return {"ok": True}

@api.get('/version')
async def version():
    return {"version": _load_db()["version"], "channel": "local"}

@api.post('/check-updates')
async def check_updates(request: Request):
    _user_by_session(request)
    return {"update_available": False, "message": "Modo local sin MongoDB. Configura autoUpdater de Electron con GitHub Releases."}

@api.get('/clock/config')
async def clock_cfg(request: Request): _user_by_session(request); return _load_db()["clock_config"]
@api.put('/clock/config')
async def put_clock_cfg(payload: Dict[str, Any], request: Request): _user_by_session(request); db=_load_db(); db["clock_config"].update(payload); _save_db(db); return db["clock_config"]
@api.get('/clock/status')
async def clock_status(request: Request): _user_by_session(request); c=_load_db()["clock_config"]; return {"connected": c.get("connected", False)}
@api.get('/clock/network-check')
async def clock_network(request: Request): _user_by_session(request); return {"same_subnet": True, "ips":["127.0.0.1"]}
@api.get('/clock/settings')
async def clock_settings(request: Request): _user_by_session(request); return _load_db()["clock_settings"]
@api.post('/clock/settings')
async def save_clock_settings(payload: Dict[str, Any], request: Request): _user_by_session(request); db=_load_db(); db["clock_settings"]=payload; _save_db(db); return payload
@api.get('/clock/events')
async def clock_events(request: Request, limit: int = 10): _user_by_session(request); return _load_db()["clock_events"][-limit:]
@api.get('/clock/users')
async def clock_users(request: Request): _user_by_session(request); return _load_db()["clock_users"]

@api.get('/reports/export')
async def export_reports(request: Request):
    _user_by_session(request)
    out = io.StringIO(); w = csv.writer(out); w.writerow(["id","filename","created_at","absences","late_arrivals"])
    for r in _load_db()["reports"]: w.writerow([r.get("id"), r.get("filename"), r.get("created_at"), r.get("absences",0), r.get("late_arrivals",0)])
    return StreamingResponse(io.BytesIO(out.getvalue().encode("utf-8")), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=reportes_locales.csv"})

@api.get('/health')
async def health(): return {"status":"ok","storage":"local-json"}

app.include_router(api)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000)
