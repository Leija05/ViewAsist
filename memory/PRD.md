# Sistema de Control de Asistencia - PRD

## Problema Original
Sistema que cuente las faltas de un empleado, la hora de entrada y el retardo de un reporte Excel y agregale cosas innovadoras y necesarias, que pueda crear un setup de la app y que pueda darle actualizaciones por github para que el software en todos los que lo tengan, que al abrir la app cheque si esta actualizado si no que se descargue la actualizacion de github y muestre la descarga y los datos de la act.

## User Personas
- **Administrador**: Usuario único con acceso completo al sistema para gestionar reportes de asistencia de empleados.

## Core Requirements (Static)
1. Procesamiento de archivos Excel (.xls/.xlsx) con reportes de asistencia
2. Cálculo automático de faltas, retardos y asistencias
3. Hora de entrada: 9:00 AM con tolerancia de 30 minutos
4. Dashboard con estadísticas y gráficas
5. Panel lateral con vista previa del Excel cargado
6. Exportación de reportes en PDF
7. Alertas de empleados con muchas faltas/retardos
8. Historial de asistencia por empleado
9. Sistema de actualizaciones vía GitHub
10. Autenticación solo admin con sesión persistente

## Arquitectura
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI + Motor (MongoDB async)
- **Base de Datos**: MongoDB
- **Autenticación**: JWT con cookies httpOnly

## What's Been Implemented (v1.0.0) - 30 Mar 2026

### Backend
- [x] Autenticación JWT con sesión persistente (7 días)
- [x] API de upload y procesamiento de Excel
- [x] Parsing de 4 hojas: Turnos, Estadístico, Asistencia, Excepciones
- [x] Cálculo de estadísticas: faltas, retardos, minutos de retardo
- [x] API de configuración (hora entrada, tolerancia, horas laborales)
- [x] Sistema de versiones con check de GitHub
- [x] Exportación a PDF con ReportLab
- [x] Historial de empleados
- [x] Alertas automáticas por faltas/retardos

### Frontend
- [x] Login con diseño Swiss/High-Contrast
- [x] Dashboard con grid 8/4 (contenido + panel Excel)
- [x] Gráficas de barras y pie con Recharts
- [x] Tabla de empleados con badges de status
- [x] Panel lateral de vista previa Excel con tabs por hoja
- [x] Diálogo de configuración
- [x] Diálogo de historial de empleado
- [x] Exportación PDF
- [x] Sistema de notificaciones (Sonner)

## Prioritized Backlog

### P0 (Crítico) - Completado
- [x] Login admin
- [x] Carga de Excel
- [x] Dashboard básico

### P1 (Alta)
- [ ] Configuración de repositorio GitHub real para actualizaciones automáticas
- [ ] Descarga automática de actualizaciones desde GitHub releases
- [ ] Setup wizard para primera configuración

### P2 (Media)
- [ ] Múltiples roles de usuario (supervisor, RRHH)
- [ ] Notificaciones por email de alertas
- [ ] Comparativa entre períodos
- [ ] Calendario visual de asistencia

### P3 (Baja)
- [ ] Dark mode
- [ ] Exportar a Excel
- [ ] Integración con sistemas biométricos
- [ ] App móvil

## Next Tasks
1. Configurar repositorio GitHub para actualizaciones
2. Implementar descarga automática de releases
3. Agregar setup wizard inicial
4. Comparativa de reportes entre meses
