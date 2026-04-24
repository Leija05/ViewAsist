# ViewAsist

Sistema de control de asistencia con:

- **Backend FastAPI** en memoria (sin base de datos).
- **Frontend React** para autenticación, carga de Excel, reportes y configuración general.
- **Electron** para ejecución como app de escritorio.

## Cambios importantes

- Se removió toda la integración con **reloj checador** (`/api/clock/*`).
- Se removió la dependencia de **MongoDB**.
- El backend queda listo para correr en **puerto 8000** por defecto.

## Ejecutar backend (modo desarrollo)

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Ejecutar frontend web

```bash
cd frontend
yarn install
yarn start
```

## Ejecutar app de escritorio (Electron dev)

```bash
cd frontend
yarn install
yarn dev:electron
```

Electron intentará levantar el backend automáticamente en `http://127.0.0.1:8000`.

## Generar instalador Windows con `server.exe` embebido

> Objetivo: que la app instalada arranque el backend sin abrir terminal ni requerir ejecutar comandos manuales.

```bash
cd frontend
yarn install
yarn dist:win
```

`dist:win` ahora hace esto:

1. Ejecuta `build:backend:exe`.
2. Genera `backend/dist/server.exe` con **PyInstaller** usando `backend/run_server.py`.
3. Empaqueta Electron e incluye `server.exe` dentro de `resources/backend/dist` del instalador.
4. Al abrir la app instalada, Electron inicia `server.exe` automáticamente y apunta al puerto `8000`.

### Requisitos para empaquetar

- Python 3 instalado en la máquina de build.
- Permiso para instalar/usar `pyinstaller` (el script lo instala automáticamente con `pip`).

### Solución si aparece `spawn UNKNOWN` al generar NSIS

Si al ejecutar `yarn dist:win` aparece `spawn UNKNOWN`, normalmente es un problema del toolchain de empaquetado/firmado de NSIS en Windows. En esta configuración se desactiva la firma del desinstalador y edición del ejecutable para evitar ese fallo en entornos sin firma de código.


## Credenciales por defecto

- Email: `admin@empresa.com`
- Contraseña: `admin123`

Puedes sobrescribirlas con variables de entorno:

```bash
ADMIN_EMAIL=tu_correo@empresa.com
ADMIN_PASSWORD=tu_password_seguro
```
