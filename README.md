# ViewAsist

Sistema de control de asistencia con:

- **Backend FastAPI** en memoria (sin base de datos).
- **Frontend React** para autenticación, carga de Excel, reportes y configuración general.
- **Electron** para ejecución como app de escritorio.

## Cambios importantes

- Se removió toda la integración con **reloj checador** (`/api/clock/*`).
- Se removió la dependencia de **MongoDB**.
- El backend queda listo para correr en **puerto 8000** por defecto.

## Ejecutar backend (FastAPI en puerto 8000)

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

## Ejecutar app de escritorio (Electron)

```bash
cd frontend
yarn install
yarn dev:electron
```

Electron levantará el backend automáticamente usando `uvicorn backend.server:app` en el puerto `8000`.

## Credenciales por defecto

- Email: `admin@empresa.com`
- Contraseña: `admin123`

Puedes sobrescribirlas con variables de entorno:

```bash
ADMIN_EMAIL=tu_correo@empresa.com
ADMIN_PASSWORD=tu_password_seguro
```
