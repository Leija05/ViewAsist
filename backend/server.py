from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Depends, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import io
import secrets
import socket
import ipaddress
from pathlib import Path
from urllib.parse import urlparse
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for persistent session

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def get_xlrd_module():
    try:
        import xlrd
        return xlrd
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail='Falta dependencia opcional "xlrd". Ejecuta: pip install xlrd==2.0.1',
        ) from exc

def get_openpyxl_module():
    try:
        import openpyxl
        return openpyxl
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail='Falta dependencia opcional "openpyxl". Ejecuta: pip install openpyxl',
        ) from exc

class ExcelSheetAdapter:
    def __init__(self, sheet_name: str, nrows: int, ncols: int, getter):
        self.sheet_name = sheet_name
        self.nrows = nrows
        self.ncols = ncols
        self._getter = getter

    def cell_value(self, row_idx: int, col_idx: int):
        return self._getter(row_idx, col_idx)

class ExcelWorkbookAdapter:
    def __init__(self, sheet_map: Dict[str, ExcelSheetAdapter]):
        self._sheet_map = sheet_map

    def sheet_names(self):
        return list(self._sheet_map.keys())

    def sheet_by_name(self, name: str):
        return self._sheet_map[name]

def load_excel_workbook(filename: str, content: bytes) -> ExcelWorkbookAdapter:
    extension = Path(filename or "").suffix.lower()

    if extension == ".xlsx":
        openpyxl = get_openpyxl_module()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
        sheets = {}
        for ws in wb.worksheets:
            sheets[ws.title] = ExcelSheetAdapter(
                sheet_name=ws.title,
                nrows=ws.max_row or 0,
                ncols=ws.max_column or 0,
                getter=lambda row_idx, col_idx, _ws=ws: (_ws.cell(row=row_idx + 1, column=col_idx + 1).value or "")
            )
        return ExcelWorkbookAdapter(sheets)

    xlrd = get_xlrd_module()
    wb = xlrd.open_workbook(file_contents=content)
    sheets = {}
    for sheet_name in wb.sheet_names():
        sheet = wb.sheet_by_name(sheet_name)
        sheets[sheet_name] = ExcelSheetAdapter(
            sheet_name=sheet_name,
            nrows=sheet.nrows,
            ncols=sheet.ncols,
            getter=lambda row_idx, col_idx, _sheet=sheet: _sheet.cell_value(row_idx, col_idx)
        )
    return ExcelWorkbookAdapter(sheets)

def get_reportlab_modules():
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        return {
            "colors": colors,
            "letter": letter,
            "landscape": landscape,
            "SimpleDocTemplate": SimpleDocTemplate,
            "Table": Table,
            "TableStyle": TableStyle,
            "Paragraph": Paragraph,
            "Spacer": Spacer,
            "getSampleStyleSheet": getSampleStyleSheet,
            "ParagraphStyle": ParagraphStyle,
        }
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail='Falta dependencia opcional "reportlab". Ejecuta: pip install reportlab',
        ) from exc

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Create the main app
app = FastAPI(title="Sistema de Control de Asistencia")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = True

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class EmployeeBase(BaseModel):
    employee_id: str
    name: str
    department: str

class AttendanceRecord(BaseModel):
    employee_id: str
    name: str
    department: str
    date: str
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    delay_minutes: float = 0
    early_departure_minutes: float = 0
    absence_minutes: float = 0
    status: str  # "presente", "retardo", "falta"

class SettingsUpdate(BaseModel):
    entry_time: str = "09:00"
    tolerance_minutes: int = 30
    work_hours: int = 9

class AttendanceRule(BaseModel):
    name: str
    expected_entry_time: str
    tolerance_minutes: int = 30

class ClockConfigUpdate(BaseModel):
    device_name: str = "Reloj Principal"
    ip: str
    port: int = 4370
    password: str = ""
    rules: List[AttendanceRule] = Field(default_factory=list)

class ClockSyncResponse(BaseModel):
    synced_records: int
    generated_report_id: Optional[str] = None
    message: str

class ClockConnectionPayload(BaseModel):
    connected: bool

class ClockUserBase(BaseModel):
    user_id: str
    name: str
    department: str = "General"
    privilege: Literal["admin", "empleado"] = "empleado"
    password: str = ""
    card_number: str = ""
    fingerprint_registered: bool = False
    face_registered: bool = False
    vein_registered: bool = False
    work_schedule: str = "Turno General"
    enabled: bool = True

class ClockUserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    privilege: Optional[Literal["admin", "empleado"]] = None
    password: Optional[str] = None
    card_number: Optional[str] = None
    fingerprint_registered: Optional[bool] = None
    face_registered: Optional[bool] = None
    vein_registered: Optional[bool] = None
    work_schedule: Optional[str] = None
    enabled: Optional[bool] = None

class VersionInfo(BaseModel):
    current_version: str
    latest_version: Optional[str] = None
    update_available: bool = False
    release_notes: Optional[str] = None
    download_url: Optional[str] = None

# Auth Routes
@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    email = request.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    max_age = 604800 if request.remember_me else 3600  # 7 days or 1 hour
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=max_age,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=2592000,  # 30 days
        path="/"
    )
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Sesión cerrada"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No hay token de refresh")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        new_access_token = create_access_token(str(user["_id"]), user["email"])
        
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=604800,
            path="/"
        )
        
        return {"message": "Token refrescado"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token de refresh expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Excel Processing
@api_router.post("/upload/excel")
async def upload_excel(request: Request, file: UploadFile = File(...)):
    await get_current_user(request)
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel (.xls, .xlsx)")
    
    content = await file.read()
    
    try:
        # Get settings
        settings = await db.settings.find_one({}, {"_id": 0})
        if not settings:
            settings = {"entry_time": "09:00", "tolerance_minutes": 30, "work_hours": 9}
        
        entry_hour, entry_min = map(int, settings["entry_time"].split(":"))
        tolerance = settings["tolerance_minutes"]
        
        # Parse Excel
        workbook = load_excel_workbook(file.filename, content)
        
        all_data = {
            "filename": file.filename,
            "upload_date": datetime.now(timezone.utc).isoformat(),
            "sheets": {},
            "employees": [],
            "attendance_records": [],
            "statistics": {}
        }
        
        # Process Reporte de Excepciones sheet (main attendance data)
        if "Reporte de Excepciones" in workbook.sheet_names():
            sheet = workbook.sheet_by_name("Reporte de Excepciones")
            records = []
            
            for row_idx in range(4, sheet.nrows):
                try:
                    emp_id = str(sheet.cell_value(row_idx, 0)).strip()
                    if not emp_id or emp_id == "":
                        continue
                    
                    name = str(sheet.cell_value(row_idx, 1)).strip()
                    department = str(sheet.cell_value(row_idx, 2)).strip()
                    date = str(sheet.cell_value(row_idx, 3)).strip()
                    entry_time = str(sheet.cell_value(row_idx, 4)).strip()
                    exit_time = str(sheet.cell_value(row_idx, 5)).strip()
                    
                    delay_min = float(sheet.cell_value(row_idx, 8) or 0)
                    early_dep = float(sheet.cell_value(row_idx, 9) or 0)
                    absence_min = float(sheet.cell_value(row_idx, 10) or 0)
                    
                    # Determine status based on tolerance
                    if absence_min >= 540:  # Full day absence (9 hours)
                        status = "falta"
                    elif delay_min > tolerance:
                        status = "retardo"
                    elif delay_min > 0:
                        status = "retardo_tolerancia"
                    else:
                        status = "presente"
                    
                    record = {
                        "employee_id": emp_id,
                        "name": name,
                        "department": department,
                        "date": date,
                        "entry_time": entry_time if entry_time else None,
                        "exit_time": exit_time if exit_time else None,
                        "delay_minutes": delay_min,
                        "early_departure_minutes": early_dep,
                        "absence_minutes": absence_min,
                        "status": status
                    }
                    records.append(record)
                except Exception as e:
                    continue
            
            all_data["attendance_records"] = records
        
        # Process Reporte Estadístico sheet
        if "Reporte Estadístico" in workbook.sheet_names():
            sheet = workbook.sheet_by_name("Reporte Estadístico")
            employees = []
            
            for row_idx in range(4, sheet.nrows):
                try:
                    emp_id = str(sheet.cell_value(row_idx, 0)).strip()
                    if not emp_id or emp_id == "":
                        continue
                    
                    name = str(sheet.cell_value(row_idx, 1)).strip()
                    department = str(sheet.cell_value(row_idx, 2)).strip()
                    normal_hours = str(sheet.cell_value(row_idx, 3)).strip()
                    real_hours = str(sheet.cell_value(row_idx, 4)).strip()
                    delay_count = float(sheet.cell_value(row_idx, 5) or 0)
                    delay_minutes = float(sheet.cell_value(row_idx, 6) or 0)
                    early_count = float(sheet.cell_value(row_idx, 7) or 0)
                    early_minutes = float(sheet.cell_value(row_idx, 8) or 0)
                    absence_days = float(sheet.cell_value(row_idx, 13) or 0)
                    
                    employee = {
                        "employee_id": emp_id,
                        "name": name,
                        "department": department,
                        "normal_hours": normal_hours,
                        "real_hours": real_hours,
                        "delay_count": int(delay_count),
                        "delay_minutes": int(delay_minutes),
                        "early_departure_count": int(early_count),
                        "early_departure_minutes": int(early_minutes),
                        "absence_days": int(absence_days)
                    }
                    employees.append(employee)
                except Exception as e:
                    continue
            
            all_data["employees"] = employees
        
        # Extract raw sheet data for preview
        for sheet_name in workbook.sheet_names():
            sheet = workbook.sheet_by_name(sheet_name)
            sheet_data = []
            for row_idx in range(min(50, sheet.nrows)):  # Limit to 50 rows for preview
                row_data = []
                for col_idx in range(sheet.ncols):
                    cell_value = sheet.cell_value(row_idx, col_idx)
                    row_data.append(str(cell_value) if cell_value else "")
                sheet_data.append(row_data)
            all_data["sheets"][sheet_name] = sheet_data
        
        # Calculate statistics
        total_employees = len(all_data["employees"])
        total_absences = sum(e["absence_days"] for e in all_data["employees"])
        total_delays = sum(e["delay_count"] for e in all_data["employees"])
        total_delay_minutes = sum(e["delay_minutes"] for e in all_data["employees"])
        
        # Find employees with most issues
        employees_sorted_by_absences = sorted(all_data["employees"], key=lambda x: x["absence_days"], reverse=True)
        employees_sorted_by_delays = sorted(all_data["employees"], key=lambda x: x["delay_count"], reverse=True)
        
        all_data["statistics"] = {
            "total_employees": total_employees,
            "total_absences": int(total_absences),
            "total_delays": int(total_delays),
            "total_delay_minutes": int(total_delay_minutes),
            "avg_absences_per_employee": round(total_absences / total_employees, 2) if total_employees > 0 else 0,
            "avg_delays_per_employee": round(total_delays / total_employees, 2) if total_employees > 0 else 0,
            "top_absent_employees": employees_sorted_by_absences[:5],
            "top_delayed_employees": employees_sorted_by_delays[:5]
        }
        
        # Save to database
        report_doc = {
            "filename": all_data["filename"],
            "upload_date": datetime.now(timezone.utc),
            "employees": all_data["employees"],
            "attendance_records": all_data["attendance_records"],
            "statistics": all_data["statistics"],
            "raw_content": content
        }
        
        result = await db.reports.insert_one(report_doc)
        all_data["report_id"] = str(result.inserted_id)
        
        # Don't return raw_content
        del all_data["sheets"]  # Remove raw sheets from response
        
        return all_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")

@api_router.get("/reports")
async def get_reports(request: Request):
    await get_current_user(request)
    reports = await db.reports.find({}, {"raw_content": 0}).sort("upload_date", -1).to_list(100)
    for r in reports:
        r["_id"] = str(r["_id"])
        if isinstance(r.get("upload_date"), datetime):
            r["upload_date"] = r["upload_date"].isoformat()
    return reports

@api_router.get("/reports/{report_id}")
async def get_report(report_id: str, request: Request):
    await get_current_user(request)
    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)}, {"raw_content": 0})
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        report["_id"] = str(report["_id"])
        if isinstance(report.get("upload_date"), datetime):
            report["upload_date"] = report["upload_date"].isoformat()
        return report
    except Exception:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

@api_router.get("/reports/{report_id}/excel-preview")
async def get_excel_preview(report_id: str, request: Request):
    await get_current_user(request)
    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
        if not report or "raw_content" not in report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
        content = report["raw_content"]
        workbook = load_excel_workbook(report.get("filename", ""), content)
        
        sheets_data = {}
        for sheet_name in workbook.sheet_names():
            sheet = workbook.sheet_by_name(sheet_name)
            sheet_data = []
            for row_idx in range(sheet.nrows):
                row_data = []
                for col_idx in range(sheet.ncols):
                    cell_value = sheet.cell_value(row_idx, col_idx)
                    row_data.append(str(cell_value) if cell_value else "")
                sheet_data.append(row_data)
            sheets_data[sheet_name] = sheet_data
        
        return {"sheets": sheets_data, "filename": report.get("filename", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, request: Request):
    await get_current_user(request)
    try:
        result = await db.reports.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        return {"message": "Reporte eliminado"}
    except Exception:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

# Settings
@api_router.get("/settings")
async def get_settings(request: Request):
    await get_current_user(request)
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"entry_time": "09:00", "tolerance_minutes": 30, "work_hours": 9}
        await db.settings.insert_one(settings)
    return settings

@api_router.put("/settings")
async def update_settings(settings: SettingsUpdate, request: Request):
    await get_current_user(request)
    await db.settings.update_one({}, {"$set": settings.model_dump()}, upsert=True)
    return settings.model_dump()

# Version & Updates
@api_router.get("/version")
async def get_version():
    current_version = os.environ.get("APP_VERSION", "1.0.0")
    github_repo = os.environ.get("GITHUB_REPO", "")
    
    return {
        "current_version": current_version,
        "github_repo": github_repo,
        "update_available": False,
        "latest_version": current_version,
        "release_notes": None,
        "download_url": None
    }

@api_router.post("/check-updates")
async def check_updates():
    """Check for updates from GitHub releases"""
    import requests
    
    current_version = os.environ.get("APP_VERSION", "1.0.0")
    github_repo = os.environ.get("GITHUB_REPO", "")
    
    if not github_repo:
        return {
            "current_version": current_version,
            "update_available": False,
            "message": "No hay repositorio de GitHub configurado"
        }
    
    try:
        # Format: owner/repo
        api_url = f"https://api.github.com/repos/{github_repo}/releases/latest"
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 200:
            release = response.json()
            latest_version = release.get("tag_name", "").lstrip("v")
            
            # Simple version comparison
            current_parts = [int(x) for x in current_version.split(".")]
            latest_parts = [int(x) for x in latest_version.split(".")]
            
            update_available = latest_parts > current_parts
            
            return {
                "current_version": current_version,
                "latest_version": latest_version,
                "update_available": update_available,
                "release_notes": release.get("body", ""),
                "download_url": release.get("html_url", ""),
                "published_at": release.get("published_at", "")
            }
        else:
            return {
                "current_version": current_version,
                "update_available": False,
                "message": "No se pudo obtener información de actualizaciones"
            }
    except Exception as e:
        return {
            "current_version": current_version,
            "update_available": False,
            "message": f"Error verificando actualizaciones: {str(e)}"
        }

# PDF Export
@api_router.get("/reports/{report_id}/pdf")
async def export_pdf(report_id: str, request: Request):
    await get_current_user(request)
    
    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)}, {"raw_content": 0})
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
        reportlab = get_reportlab_modules()
        colors = reportlab["colors"]
        SimpleDocTemplate = reportlab["SimpleDocTemplate"]
        Table = reportlab["Table"]
        TableStyle = reportlab["TableStyle"]
        Paragraph = reportlab["Paragraph"]
        Spacer = reportlab["Spacer"]
        getSampleStyleSheet = reportlab["getSampleStyleSheet"]
        ParagraphStyle = reportlab["ParagraphStyle"]
        letter = reportlab["letter"]
        landscape = reportlab["landscape"]

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
        elements.append(Paragraph(f"Reporte de Asistencia - {report.get('filename', 'Sin nombre')}", title_style))
        elements.append(Spacer(1, 12))
        
        # Statistics
        stats = report.get("statistics", {})
        stats_text = f"""
        <b>Estadísticas Generales:</b><br/>
        Total de Empleados: {stats.get('total_employees', 0)}<br/>
        Total de Faltas: {stats.get('total_absences', 0)}<br/>
        Total de Retardos: {stats.get('total_delays', 0)}<br/>
        Minutos de Retardo Total: {stats.get('total_delay_minutes', 0)}<br/>
        """
        elements.append(Paragraph(stats_text, styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Employee Table
        elements.append(Paragraph("<b>Resumen por Empleado:</b>", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        table_data = [["ID", "Nombre", "Departamento", "Faltas", "Retardos", "Min. Retardo"]]
        for emp in report.get("employees", []):
            table_data.append([
                emp.get("employee_id", ""),
                emp.get("name", "")[:25],
                emp.get("department", "")[:15],
                str(emp.get("absence_days", 0)),
                str(emp.get("delay_count", 0)),
                str(emp.get("delay_minutes", 0))
            ])
        
        if len(table_data) > 1:
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        filename = f"reporte_asistencia_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    await get_current_user(request)
    
    # Get latest report
    latest_report = await db.reports.find_one({}, {"raw_content": 0}, sort=[("upload_date", -1)])
    
    if not latest_report:
        return {
            "has_data": False,
            "message": "No hay reportes cargados"
        }
    
    stats = latest_report.get("statistics", {})
    employees = latest_report.get("employees", [])
    
    # Alerts for employees with high absences or delays
    alerts = []
    for emp in employees:
        if emp.get("absence_days", 0) >= 5:
            alerts.append({
                "type": "danger",
                "employee": emp["name"],
                "message": f"Tiene {emp['absence_days']} faltas"
            })
        elif emp.get("delay_count", 0) >= 5:
            alerts.append({
                "type": "warning", 
                "employee": emp["name"],
                "message": f"Tiene {emp['delay_count']} retardos"
            })
    
    return {
        "has_data": True,
        "report_id": str(latest_report["_id"]),
        "filename": latest_report.get("filename", ""),
        "upload_date": latest_report.get("upload_date").isoformat() if isinstance(latest_report.get("upload_date"), datetime) else latest_report.get("upload_date"),
        "statistics": stats,
        "employees": employees,
        "alerts": alerts[:10]  # Top 10 alerts
    }

# Employees
@api_router.get("/employees")
async def get_employees(request: Request):
    await get_current_user(request)
    latest_report = await db.reports.find_one({}, {"employees": 1}, sort=[("upload_date", -1)])
    if not latest_report:
        return []
    return latest_report.get("employees", [])

@api_router.get("/employees/{employee_id}/history")
async def get_employee_history(employee_id: str, request: Request):
    await get_current_user(request)
    
    # Get all reports and find records for this employee
    reports = await db.reports.find({}, {"attendance_records": 1, "upload_date": 1, "filename": 1}).to_list(100)
    
    history = []
    for report in reports:
        records = [r for r in report.get("attendance_records", []) if r.get("employee_id") == employee_id]
        if records:
            history.append({
                "report_date": report.get("upload_date").isoformat() if isinstance(report.get("upload_date"), datetime) else report.get("upload_date"),
                "filename": report.get("filename", ""),
                "records": records
            })
    
    return history

def _summarize_clock_records(records: List[Dict[str, Any]], settings: Dict[str, Any], user_lookup: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    user_lookup = user_lookup or {}
    grouped: Dict[tuple, List[datetime]] = {}

    for record in records:
        employee_id = str(record.get("employee_id", "")).strip()
        timestamp = record.get("timestamp")
        if not employee_id or not isinstance(timestamp, datetime):
            continue
        ts = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
        key = (employee_id, ts.date().isoformat())
        grouped.setdefault(key, []).append(ts)

    entry_hour, entry_minute = map(int, settings.get("entry_time", "09:00").split(":"))
    tolerance_minutes = int(settings.get("tolerance_minutes", 30))

    attendance_records = []
    employee_summary: Dict[str, Dict[str, Any]] = {}

    for (employee_id, date_str), punches in grouped.items():
        punches = sorted(punches)
        entry_time = punches[0]
        exit_time = punches[-1]

        scheduled = datetime.fromisoformat(f"{date_str}T{entry_hour:02d}:{entry_minute:02d}:00").replace(tzinfo=timezone.utc)
        delay_minutes = max((entry_time - scheduled).total_seconds() / 60.0, 0)
        status = "retardo" if delay_minutes > tolerance_minutes else "presente"

        employee_name = user_lookup.get(employee_id, f"Empleado {employee_id}")
        attendance_records.append({
            "employee_id": employee_id,
            "name": employee_name,
            "department": "Reloj checador",
            "date": date_str,
            "entry_time": entry_time.strftime("%H:%M"),
            "exit_time": exit_time.strftime("%H:%M"),
            "delay_minutes": round(delay_minutes, 2),
            "early_departure_minutes": 0,
            "absence_minutes": 0,
            "status": status,
        })

        if employee_id not in employee_summary:
            employee_summary[employee_id] = {
                "employee_id": employee_id,
                "name": employee_name,
                "department": "Reloj checador",
                "absence_days": 0,
                "delay_count": 0,
                "delay_minutes": 0,
            }

        if status == "retardo":
            employee_summary[employee_id]["delay_count"] += 1
            employee_summary[employee_id]["delay_minutes"] += round(delay_minutes, 2)

    employees = list(employee_summary.values())
    statistics = {
        "total_employees": len(employees),
        "total_absences": 0,
        "total_delays": sum(e["delay_count"] for e in employees),
        "total_delay_minutes": round(sum(e["delay_minutes"] for e in employees), 2),
    }

    return {
        "attendance_records": attendance_records,
        "employees": employees,
        "statistics": statistics,
    }


def _fetch_clock_attendance(config: Dict[str, Any]) -> Dict[str, Any]:
    conn = _connect_to_clock(config)
    try:
        users = conn.get_users() or []
        user_lookup = {str(u.user_id): (u.name or f"Empleado {u.user_id}") for u in users}
        attendance = conn.get_attendance() or []

        normalized = []
        for item in attendance:
            timestamp = getattr(item, "timestamp", None)
            user_id = str(getattr(item, "user_id", "")).strip()
            if not timestamp or not user_id:
                continue
            normalized.append({"employee_id": user_id, "timestamp": timestamp})

        return {"records": normalized, "users": user_lookup}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al leer asistencias del reloj: {exc}")
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass


def _connect_to_clock(config: Dict[str, Any]):
    device_ip = str(config.get("ip", "") or "").strip()
    if not device_ip:
        raise HTTPException(status_code=400, detail="Ingresa la IP del reloj antes de conectar.")

    raw_port = config.get("port", 4370)
    try:
        device_port = int(raw_port)
    except Exception:
        raise HTTPException(status_code=400, detail="El puerto del reloj no es válido.")
    if device_port <= 0:
        raise HTTPException(status_code=400, detail="El puerto del reloj no es válido.")

    raw_password = str(config.get("password", "") or "").strip()
    if raw_password == "":
        raise HTTPException(status_code=400, detail="Ingresa la Contraseña/Comm Key del reloj antes de conectar.")

    try:
        from zk import ZK  # type: ignore
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f'No se encontró la librería pyzk/zk: {exc}. Instala dependencias con: pip install pyzk'
        )

    try:
        device_password = int(raw_password)
    except Exception:
        raise HTTPException(status_code=400, detail="La Contraseña/Comm Key debe ser numérica.")

    zk_client = ZK(device_ip, port=device_port, timeout=10, password=device_password, force_udp=False, ommit_ping=False)
    try:
        return zk_client.connect()
    except Exception as exc:
        message = str(exc)
        if "Unauthenticated" in message:
            raise HTTPException(
                status_code=400,
                detail="No se pudo autenticar con el reloj. Verifica la Contraseña/Comm Key en Configuración."
            )
        raise HTTPException(status_code=500, detail=f"No se pudo conectar al reloj: {message}")


def _serialize_clock_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(doc)
    out["_id"] = str(out["_id"])
    return out


def _same_subnet(local_ip: str, clock_ip: str, prefix: int = 24) -> bool:
    try:
        local_net = ipaddress.ip_network(f"{local_ip}/{prefix}", strict=False)
        return ipaddress.ip_address(clock_ip) in local_net
    except Exception:
        return False


def _get_local_ipv4s() -> List[str]:
    ips = {"127.0.0.1"}
    try:
        hostname = socket.gethostname()
        for result in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = result[4][0]
            if ip:
                ips.add(ip)
    except Exception:
        pass
    return sorted(ips)


@api_router.get("/clock/config")
async def get_clock_config(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        config = {
            "device_name": "",
            "ip": "",
            "port": 4370,
            "password": "",
            "rules": [
                {"name": "Turno General", "expected_entry_time": "09:00", "tolerance_minutes": 30}
            ],
            "connected": False,
            "last_sync": None,
        }
        await db.clock_config.insert_one(config)
    return config


@api_router.put("/clock/config")
async def update_clock_config(payload: ClockConfigUpdate, request: Request):
    await get_current_user(request)
    data = payload.model_dump()
    data["updated_at"] = datetime.now(timezone.utc)
    await db.clock_config.update_one({}, {"$set": data}, upsert=True)
    return data


@api_router.post("/clock/test-connection")
async def test_clock_connection(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    conn = _connect_to_clock(config)
    try:
        return {"connected": True, "message": "Conexión y autenticación con reloj exitosas"}
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass


@api_router.post("/clock/connection")
async def set_clock_connection(payload: ClockConnectionPayload, request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    if payload.connected:
        conn = _connect_to_clock(config)
        try:
            pass
        finally:
            try:
                conn.disconnect()
            except Exception:
                pass

    await db.clock_config.update_one(
        {},
        {"$set": {"connected": payload.connected, "connection_changed_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"connected": payload.connected}


@api_router.get("/clock/status")
async def get_clock_status(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0}) or {}
    users_count = await db.clock_users.count_documents({})
    last_event = await db.clock_events.find_one({}, sort=[("created_at", -1)])
    return {
        "connected": bool(config.get("connected", False)),
        "device_name": config.get("device_name", "Reloj Principal"),
        "ip": config.get("ip"),
        "port": config.get("port"),
        "users_count": users_count,
        "last_sync": config.get("last_sync"),
        "last_event_at": last_event.get("created_at") if last_event else None,
    }


@api_router.get("/clock/network-check")
async def get_clock_network_check(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0}) or {}
    clock_ip = str(config.get("ip", "") or "").strip()
    local_ips = _get_local_ipv4s()
    same_subnet = any(_same_subnet(local_ip, clock_ip) for local_ip in local_ips if local_ip != "127.0.0.1") if clock_ip else False
    return {
        "clock_ip": clock_ip,
        "local_ips": local_ips,
        "same_subnet": same_subnet,
        "message": "Equipo y reloj en misma red" if same_subnet else "Equipo y reloj parecen estar en redes distintas"
    }


@api_router.get("/clock/device-info")
async def get_clock_device_info(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    users_count = await db.clock_users.count_documents({})
    fingerprint_users = await db.clock_users.count_documents({"fingerprint_registered": True})
    face_users = await db.clock_users.count_documents({"face_registered": True})
    vein_users = await db.clock_users.count_documents({"vein_registered": True})

    info = {
        "device_name": config.get("device_name", "Reloj Principal"),
        "ip": config.get("ip"),
        "port": config.get("port"),
        "connected": bool(config.get("connected", False)),
        "users": users_count,
        "fingerprints": fingerprint_users,
        "faces": face_users,
        "veins": vein_users,
    }

    if info["connected"]:
        conn = None
        try:
            conn = _connect_to_clock(config)
            info["device_time"] = conn.get_time().isoformat() if hasattr(conn, "get_time") else None
        except Exception as exc:
            info["device_time_error"] = str(exc)
        finally:
            try:
                conn.disconnect()
            except Exception:
                pass

    return info


@api_router.get("/clock/users")
async def get_clock_users(request: Request):
    await get_current_user(request)
    users = await db.clock_users.find({}).sort("user_id", 1).to_list(2000)
    return [_serialize_clock_user(u) for u in users]


@api_router.post("/clock/users")
async def create_clock_user(payload: ClockUserBase, request: Request):
    await get_current_user(request)
    exists = await db.clock_users.find_one({"user_id": payload.user_id})
    if exists:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese ID")
    doc = payload.model_dump()
    doc.update({
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "sync_status": "pending",
    })
    result = await db.clock_users.insert_one(doc)
    saved = await db.clock_users.find_one({"_id": result.inserted_id})
    return _serialize_clock_user(saved)


@api_router.put("/clock/users/{user_id}")
async def update_clock_user(user_id: str, payload: ClockUserUpdate, request: Request):
    await get_current_user(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay cambios para actualizar")
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["sync_status"] = "pending"
    result = await db.clock_users.update_one({"user_id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user = await db.clock_users.find_one({"user_id": user_id})
    return _serialize_clock_user(user)


@api_router.delete("/clock/users/{user_id}")
async def delete_clock_user(user_id: str, request: Request):
    await get_current_user(request)
    result = await db.clock_users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}


@api_router.post("/clock/users/pull")
async def pull_users_from_clock(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    conn = _connect_to_clock(config)
    imported = 0
    try:
        users = conn.get_users() or []
        for user in users:
            user_id = str(getattr(user, "user_id", "")).strip()
            if not user_id:
                continue
            doc = {
                "user_id": user_id,
                "name": getattr(user, "name", f"Empleado {user_id}") or f"Empleado {user_id}",
                "department": "General",
                "privilege": "admin" if int(getattr(user, "privilege", 0)) > 0 else "empleado",
                "password": getattr(user, "password", "") or "",
                "card_number": str(getattr(user, "card", "") or ""),
                "fingerprint_registered": True,
                "face_registered": False,
                "vein_registered": False,
                "work_schedule": "Turno General",
                "enabled": True,
                "sync_status": "synced",
                "updated_at": datetime.now(timezone.utc),
            }
            await db.clock_users.update_one(
                {"user_id": user_id},
                {"$set": doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
                upsert=True
            )
            imported += 1
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass

    return {"imported": imported}


@api_router.post("/clock/users/push")
async def push_users_to_clock(request: Request):
    await get_current_user(request)
    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    users = await db.clock_users.find({}).to_list(2000)
    conn = _connect_to_clock(config)
    pushed = 0
    errors = []

    try:
        for user in users:
            try:
                privilege = 14 if user.get("privilege") == "admin" else 0
                conn.set_user(
                    uid=int(user["user_id"]),
                    name=user.get("name", ""),
                    privilege=privilege,
                    password=user.get("password", ""),
                    user_id=str(user["user_id"]),
                    card=user.get("card_number", "")
                )
                await db.clock_users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"sync_status": "synced", "synced_at": datetime.now(timezone.utc)}}
                )
                pushed += 1
            except Exception as exc:
                errors.append({"user_id": user.get("user_id"), "error": str(exc)})
                await db.clock_users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"sync_status": "error", "last_error": str(exc)}}
                )
    finally:
        try:
            conn.disconnect()
        except Exception:
            pass

    return {"pushed": pushed, "errors": errors}


@api_router.get("/clock/attendance/live")
async def get_live_attendance(request: Request, limit: int = 100):
    await get_current_user(request)
    docs = await db.clock_events.find({}, {"events": 1, "created_at": 1}).sort("created_at", -1).to_list(5)
    events = []
    for doc in docs:
        for event in doc.get("events", []):
            timestamp = event.get("timestamp")
            if isinstance(timestamp, datetime):
                ts_iso = timestamp.isoformat()
            else:
                ts_iso = str(timestamp)
            events.append({
                "employee_id": event.get("employee_id"),
                "timestamp": ts_iso,
                "received_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at")),
            })
    events = sorted(events, key=lambda e: e["timestamp"], reverse=True)[: max(1, min(limit, 500))]
    return {"events": events}


@api_router.post("/clock/sync", response_model=ClockSyncResponse)
async def sync_clock_attendance(request: Request):
    await get_current_user(request)

    config = await db.clock_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero el reloj checador")

    settings = await db.settings.find_one({}, {"_id": 0}) or {"entry_time": "09:00", "tolerance_minutes": 30, "work_hours": 9}
    data = _fetch_clock_attendance(config)

    await db.clock_events.insert_one({
        "source": "clock_device",
        "device": {"ip": config.get("ip"), "port": config.get("port"), "device_name": config.get("device_name")},
        "events": data["records"],
        "created_at": datetime.now(timezone.utc),
    })

    summary = _summarize_clock_records(data["records"], settings, data.get("users"))
    report_doc = {
        "filename": f"SYNC_RELOJ_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "upload_date": datetime.now(timezone.utc),
        "source": "clock_sync",
        "sheets": ["Reloj checador"],
        "employees": summary["employees"],
        "attendance_records": summary["attendance_records"],
        "statistics": summary["statistics"],
    }
    report_result = await db.reports.insert_one(report_doc)

    await db.clock_config.update_one({}, {"$set": {"last_sync": datetime.now(timezone.utc)}}, upsert=True)

    return ClockSyncResponse(
        synced_records=len(summary["attendance_records"]),
        generated_report_id=str(report_result.inserted_id),
        message="Sincronización completada desde el reloj checador",
    )


@api_router.get("/clock/events")
async def get_clock_events(request: Request, limit: int = 10):
    await get_current_user(request)
    docs = await db.clock_events.find({}, {"events": 0}).sort("created_at", -1).to_list(max(1, min(limit, 100)))
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs


# Root route
@api_router.get("/")
async def root():
    return {"message": "Sistema de Control de Asistencia API", "version": os.environ.get("APP_VERSION", "1.0.0")}

# Include the router in the main app
app.include_router(api_router)

def get_allowed_origins() -> List[str]:
    raw_origins = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    expanded_origins = set(origins)
    for origin in origins:
        parsed = urlparse(origin)
        if not parsed.scheme or not parsed.netloc:
            continue
        if "localhost" in parsed.netloc:
            expanded_origins.add(origin.replace("localhost", "127.0.0.1"))
        if "127.0.0.1" in parsed.netloc:
            expanded_origins.add(origin.replace("127.0.0.1", "localhost"))

    # Common local dev origins
    expanded_origins.update({
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    })
    return sorted(expanded_origins)

ALLOWED_ORIGINS = get_allowed_origins()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info(f"CORS allow_origins: {ALLOWED_ORIGINS}")

    async def upsert_seed_user(email: str, password: str, name: str, role: str, extra_fields: Optional[Dict[str, Any]] = None):
        existing = await db.users.find_one({"email": email})
        extra_fields = extra_fields or {}
        base_updates = {
            "name": name,
            "role": role,
            **extra_fields
        }

        if existing is None:
            await db.users.insert_one({
                "email": email,
                "password_hash": hash_password(password),
                "created_at": datetime.now(timezone.utc),
                **base_updates
            })
            logger.info(f"Seed user created: {email}")
            return

        updates = dict(base_updates)
        if not verify_password(password, existing["password_hash"]):
            updates["password_hash"] = hash_password(password)
            logger.info(f"Seed user password updated: {email}")
        await db.users.update_one({"email": email}, {"$set": updates})

    # Seed users
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    await upsert_seed_user(admin_email, admin_password, "Administrador", "admin")

    developer_email = os.environ.get("DEVELOPER_EMAIL", "leijahector5@gmail.com")
    developer_password = os.environ.get("DEVELOPER_PASSWORD", "/Leija091105")
    await upsert_seed_user(
        developer_email,
        developer_password,
        "Héctor Leija",
        "developer",
        {
            "developer_options": {
                "feature_flags": {
                    "beta_dashboard": True,
                    "diagnostic_mode": True,
                    "export_debug_logs": True
                },
                "can_manage_clock_config": True,
                "can_trigger_manual_sync": True
            }
        }
    )
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.reports.create_index("upload_date")
    await db.clock_users.create_index("user_id", unique=True)
    
    # Initialize settings if not exists
    settings = await db.settings.find_one({})
    if not settings:
        await db.settings.insert_one({
            "entry_time": "09:00",
            "tolerance_minutes": 30,
            "work_hours": 9
        })

    clock_config = await db.clock_config.find_one({})
    if not clock_config:
        await db.clock_config.insert_one({
            "device_name": "",
            "ip": "",
            "port": 4370,
            "password": "",
            "rules": [
                {"name": "Turno General", "expected_entry_time": "09:00", "tolerance_minutes": 30}
            ],
            "connected": False,
            "last_sync": None,
            "created_at": datetime.now(timezone.utc)
        })
    else:
        legacy_ip = str(clock_config.get("ip", "") or "").strip()
        legacy_password = str(clock_config.get("password", "") or "").strip()
        legacy_name = str(clock_config.get("device_name", "") or "").strip()
        if (
            not clock_config.get("connected", False)
            and legacy_ip == "192.168.1.104"
            and legacy_password in {"123", "1234"}
            and legacy_name == "Reloj Principal"
        ):
            await db.clock_config.update_one(
                {"_id": clock_config["_id"]},
                {"$set": {"device_name": "", "ip": "", "password": ""}}
            )
            logger.info("Clock config reset from legacy defaults to empty values")

    await db.clock_events.create_index("created_at")
    
    # Write test credentials
    credentials_path = Path("/app/memory/test_credentials.md")
    credentials_path.parent.mkdir(parents=True, exist_ok=True)
    credentials_path.write_text(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Developer Account
- Email: {developer_email}
- Password: {developer_password}
- Role: developer

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
""")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
