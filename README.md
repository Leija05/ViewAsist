# ViewAsist

Sistema de control de asistencia con:

- Backend FastAPI + MongoDB para autenticación, reportes y sincronización con reloj checador.
- Frontend React para dashboard, reglas de asistencia, configuración del reloj y generación de reportes.
- Setup con Electron para operar la app como escritorio.

## Configuración del reloj checador

Desde el Dashboard > Configuración:

1. Configura IP, puerto y contraseña (Comm Key).
2. Guarda la configuración del reloj.
3. Prueba conexión TCP con el reloj.
4. Puedes **conectar / desconectar** el reloj para cambiar a otro dispositivo.
5. Administra usuarios (agregar, editar, borrar), verifica banderas de biometría (huella/rostro/vena) y horario.
6. Usa **Importar usuarios del reloj** y **Subir usuarios al reloj (Wi-Fi)** para sincronización bidireccional.
7. Ejecuta **Sincronizar Asistencias del Reloj** para crear un reporte directo desde eventos del dispositivo.
8. Revisa asistencias en tiempo real desde el panel “Centro de Reloj Checador”.

El backend expone:

- `GET /api/clock/config`
- `PUT /api/clock/config`
- `POST /api/clock/test-connection`
- `POST /api/clock/connection`
- `GET /api/clock/status`
- `GET /api/clock/device-info`
- `GET /api/clock/users`
- `POST /api/clock/users`
- `PUT /api/clock/users/{user_id}`
- `DELETE /api/clock/users/{user_id}`
- `POST /api/clock/users/pull`
- `POST /api/clock/users/push`
- `POST /api/clock/sync`
- `GET /api/clock/events`
- `GET /api/clock/attendance/live`

## Electron (frontend)

```bash
cd frontend
yarn install
yarn dev:electron
```

Al abrir Electron, ahora la app intenta:

1. Levantar automáticamente el backend FastAPI (`backend.server:app`).
2. Conectarse a MongoDB usando por defecto `MONGO_URL=mongodb://127.0.0.1:27017`.
3. Esperar a que la API responda en `http://127.0.0.1:8000` antes de abrir la ventana.

Si quieres personalizar rutas/puertos:

```bash
MONGO_URL=mongodb://127.0.0.1:27017 \
DB_NAME=viewasist \
BACKEND_HOST=127.0.0.1 \
BACKEND_PORT=8000 \
ELECTRON_PYTHON_PATH=python3 \
yarn dev:electron
```

Comandos relevantes:

- `yarn start` → solo frontend web.
- `yarn dev:electron` → frontend + Electron para entorno local.
- `yarn electron` → abre Electron contra build estático (`frontend/build`).
- `yarn dist` → genera instaladores/artefactos de escritorio con `electron-builder`.
- `yarn dist:win` → genera instalador `.exe` (NSIS) en `frontend/dist/`.

## Dependencia del reloj

El backend usa `pyzk` para comunicación con equipos compatibles en puerto `4370`.
