import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Toaster, toast } from 'sonner';
import {
  Clock,
  Upload,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Settings,
  LogOut,
  RefreshCw,
  Trash2,
  Eye,
  ChevronDown,
  X,
  Calendar,
  TrendingUp,
  UserX,
  Timer,
  CheckCircle,
  Info,
  Wifi,
  Database
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [settings, setSettings] = useState({ entry_time: '09:00', tolerance_minutes: 30, work_hours: 9 });
  const [clockConfig, setClockConfig] = useState({ device_name: '', ip: '', port: 4370, password: '', rules: [{ name: 'Turno General', expected_entry_time: '09:00', tolerance_minutes: 30 }] });
  const [versionInfo, setVersionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showExcelPanel, setShowExcelPanel] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [employeeHistory, setEmployeeHistory] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [clockStatus, setClockStatus] = useState(null);
  const [clockUsers, setClockUsers] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [clockLibraryMissing, setClockLibraryMissing] = useState(false);
  const [clockReadOnly, setClockReadOnly] = useState(false);
  const [clockNetwork, setClockNetwork] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [clockUserDialogOpen, setClockUserDialogOpen] = useState(false);
  const [clockUserDialogMode, setClockUserDialogMode] = useState('create');
  const [editingClockUserId, setEditingClockUserId] = useState(null);
  const [clockProcess, setClockProcess] = useState({ visible: false, status: 'loading', step: '', detail: '' });
  const [clockUserForm, setClockUserForm] = useState({
    user_id: '',
    name: '',
    department: 'General',
    work_schedule: 'Turno General'
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`, { withCredentials: true });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reports`, { withCredentials: true });
      setReports(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  const fetchClockConfig = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clock/config`, { withCredentials: true });
      setClockConfig(response.data);
    } catch (error) {
      console.error('Error fetching clock config:', error);
    }
  }, []);

  const fetchVersion = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/version`, { withCredentials: true });
      setVersionInfo(response.data);
    } catch (error) {
      console.error('Error fetching version:', error);
    }
  }, []);

  const fetchClockStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clock/status`, { withCredentials: true });
      setClockStatus(response.data);
      setClockLibraryMissing(false);
      setClockReadOnly(!response.data?.connected);
    } catch (error) {
      console.error('Error fetching clock status:', error);
    }
  }, []);

  const getClockErrorMessage = (error, fallbackMessage) => {
    const detail = error?.response?.data?.detail || '';
    if (typeof detail === 'string' && detail.toLowerCase().includes('pyzk/zk')) {
      setClockLibraryMissing(true);
      setClockReadOnly(true);
      return 'Falta la librería del reloj (pyzk). Instala en tu entorno Python: pip install pyzk';
    }
    if (typeof detail === 'string' && detail.toLowerCase().includes('autenticar')) {
      setClockReadOnly(true);
    }
    return detail || fallbackMessage;
  };

  const fetchClockNetworkStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clock/network-check`, { withCredentials: true });
      setClockNetwork(response.data);
    } catch (error) {
      setClockNetwork(null);
    }
  }, []);

  const fetchClockUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clock/users`, { withCredentials: true });
      setClockUsers(response.data);
    } catch (error) {
      console.error('Error fetching clock users:', error);
    }
  }, []);

  const fetchLiveAttendance = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clock/attendance/live?limit=50`, { withCredentials: true });
      setLiveAttendance(response.data.events || []);
    } catch (error) {
      console.error('Error fetching live attendance:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboardData(),
        fetchReports(),
        fetchSettings(),
        fetchClockConfig(),
        fetchClockStatus(),
        fetchClockUsers(),
        fetchLiveAttendance(),
        fetchVersion(),
        fetchClockNetworkStatus()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboardData, fetchReports, fetchSettings, fetchClockConfig, fetchClockStatus, fetchClockUsers, fetchLiveAttendance, fetchVersion, fetchClockNetworkStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveAttendance();
      fetchClockStatus();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchLiveAttendance, fetchClockStatus]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload/excel`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Archivo procesado correctamente');
      await fetchDashboardData();
      await fetchReports();
      await loadReportData(response.data.report_id);
      loadExcelPreview(response.data.report_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const loadExcelPreview = async (reportId) => {
    try {
      const response = await axios.get(`${API_URL}/api/reports/${reportId}/excel-preview`, { withCredentials: true });
      setExcelPreview(response.data);
      setSelectedReport(reportId);
      const sheetNames = Object.keys(response.data.sheets);
      if (sheetNames.length > 0) {
        setSelectedSheet(sheetNames[0]);
      }
      setShowExcelPanel(true);
    } catch (error) {
      toast.error('Error al cargar vista previa del Excel');
    }
  };

  const loadReportData = async (reportId) => {
    try {
      const response = await axios.get(`${API_URL}/api/reports/${reportId}`, { withCredentials: true });
      const report = response.data;
      setDashboardData({
        has_data: true,
        report_id: reportId,
        statistics: report.statistics || {},
        employees: report.employees || [],
        alerts: []
      });
      setSelectedReport(reportId);
    } catch (error) {
      toast.error('No se pudo cargar el reporte seleccionado');
    }
  };

  const handleExportPDF = async (reportId) => {
    try {
      const response = await axios.get(`${API_URL}/api/reports/${reportId}/pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_asistencia.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF exportado correctamente');
    } catch (error) {
      toast.error('Error al exportar PDF');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('¿Estás seguro de eliminar este reporte?')) return;
    try {
      await axios.delete(`${API_URL}/api/reports/${reportId}`, { withCredentials: true });
      toast.success('Reporte eliminado');
      await fetchReports();
      await fetchDashboardData();
      if (selectedReport === reportId) {
        setSelectedReport(null);
        setExcelPreview(null);
        setShowExcelPanel(false);
      }
    } catch (error) {
      toast.error('Error al eliminar reporte');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(`${API_URL}/api/settings`, settings, { withCredentials: true });
      toast.success('Configuración guardada');
      setSettingsOpen(false);
    } catch (error) {
      toast.error('Error al guardar configuración');
    }
  };

  const handleSaveClockConfig = async () => {
    try {
      await axios.put(`${API_URL}/api/clock/config`, clockConfig, { withCredentials: true });
      toast.success('Reloj checador configurado');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar configuración del reloj');
    }
  };

  const handleTestClockConnection = async () => {
    setClockProcess({ visible: true, status: 'loading', step: 'Conectando con el reloj...', detail: 'Validando IP, puerto y Comm Key' });
    try {
      setClockProcess({ visible: true, status: 'loading', step: 'Autenticando con dispositivo...', detail: 'Esperando respuesta del reloj checador' });
      const response = await axios.post(`${API_URL}/api/clock/test-connection`, {}, { withCredentials: true });
      if (response.data.connected) {
        toast.success(response.data.message || 'Conexión exitosa con reloj');
        setClockProcess({ visible: true, status: 'success', step: 'Conexión exitosa', detail: 'El reloj respondió correctamente' });
      } else {
        toast.error(response.data.message || 'No se pudo conectar con el reloj');
        setClockProcess({ visible: true, status: 'error', step: 'Error de conexión', detail: response.data.message || 'No se pudo conectar con el reloj' });
      }
    } catch (error) {
      const detail = getClockErrorMessage(error, 'Error validando conexión del reloj');
      toast.error(detail);
      setClockProcess({ visible: true, status: 'error', step: 'Error de conexión', detail });
      return;
    }
    setTimeout(() => setClockProcess((prev) => ({ ...prev, visible: false })), 1000);
  };

  const handleSyncFromClock = async () => {
    setClockProcess({ visible: true, status: 'loading', step: 'Sincronizando asistencias...', detail: 'Leyendo registros del reloj' });
    try {
      const response = await axios.post(`${API_URL}/api/clock/sync`, {}, { withCredentials: true });
      toast.success(`Sync completado: ${response.data.synced_records} registros`);
      setClockProcess({
        visible: true,
        status: 'success',
        step: 'Sincronización completada',
        detail: `Detectados: ${response.data.detected_records || 0} | Insertados: ${response.data.inserted_records || response.data.synced_records || 0}`
      });
      await fetchDashboardData();
      await fetchReports();
      await fetchClockConfig();
    } catch (error) {
      const detail = getClockErrorMessage(error, 'No se pudo sincronizar con el reloj');
      toast.error(detail);
      setClockProcess({ visible: true, status: 'error', step: 'Error al sincronizar', detail });
      return;
    }
    setTimeout(() => setClockProcess((prev) => ({ ...prev, visible: false })), 1100);
  };

  const handleToggleConnection = async (nextValue) => {
    if (nextValue) {
      if (!clockConfig.ip?.trim()) {
        toast.error('Ingresa la IP del reloj antes de conectar');
        return;
      }
      if (!clockConfig.port || Number(clockConfig.port) <= 0) {
        toast.error('Ingresa un puerto válido');
        return;
      }
      if (!String(clockConfig.password || '').trim()) {
        toast.error('Ingresa la Contraseña/Comm Key antes de conectar');
        return;
      }
    }

    try {
      if (nextValue) {
        setClockProcess({ visible: true, status: 'loading', step: 'Conectando reloj...', detail: 'Guardando configuración y abriendo conexión' });
      }
      if (nextValue) {
        await axios.put(`${API_URL}/api/clock/config`, {
          ...clockConfig,
          ip: clockConfig.ip.trim(),
          password: String(clockConfig.password).trim(),
          port: Number(clockConfig.port)
        }, { withCredentials: true });
      }
      await axios.post(`${API_URL}/api/clock/connection`, { connected: nextValue }, { withCredentials: true });
      toast.success(nextValue ? 'Reloj conectado' : 'Reloj desconectado');
      if (nextValue) {
        setClockProcess({ visible: true, status: 'success', step: 'Reloj conectado', detail: 'Conexión establecida correctamente' });
      }
      await fetchClockStatus();
      await fetchClockConfig();
    } catch (error) {
      const detail = error.response?.data?.detail || 'No se pudo cambiar el estado de conexión';
      toast.error(detail);
      if (nextValue) {
        setClockProcess({ visible: true, status: 'error', step: 'Error al conectar reloj', detail });
      }
      return;
    }
    if (nextValue) {
      setTimeout(() => setClockProcess((prev) => ({ ...prev, visible: false })), 1000);
    }
  };

  const openCreateClockUserDialog = () => {
    setClockUserDialogMode('create');
    setEditingClockUserId(null);
    setClockUserForm({
      user_id: '',
      name: '',
      department: 'General',
      work_schedule: 'Turno General'
    });
    setClockUserDialogOpen(true);
  };

  const openEditClockUserDialog = (user) => {
    setClockUserDialogMode('edit');
    setEditingClockUserId(user.user_id);
    setClockUserForm({
      user_id: user.user_id || '',
      name: user.name || '',
      department: user.department || 'General',
      work_schedule: user.work_schedule || 'Turno General'
    });
    setClockUserDialogOpen(true);
  };

  const handleSubmitClockUser = async () => {
    if (!clockUserForm.user_id?.trim() || !clockUserForm.name?.trim()) {
      toast.error('ID y nombre son obligatorios');
      return;
    }

    try {
      if (clockUserDialogMode === 'create') {
        await axios.post(`${API_URL}/api/clock/users`, {
          user_id: clockUserForm.user_id.trim(),
          name: clockUserForm.name.trim(),
          department: clockUserForm.department.trim() || 'General',
          privilege: 'empleado',
          password: '',
          card_number: '',
          fingerprint_registered: false,
          face_registered: false,
          vein_registered: false,
          work_schedule: clockUserForm.work_schedule.trim() || 'Turno General',
          enabled: true
        }, { withCredentials: true });
        toast.success('Usuario creado');
      } else {
        await axios.put(`${API_URL}/api/clock/users/${editingClockUserId}`, {
          name: clockUserForm.name.trim(),
          department: clockUserForm.department.trim() || 'General',
          work_schedule: clockUserForm.work_schedule.trim() || 'Turno General'
        }, { withCredentials: true });
        toast.success('Usuario actualizado');
      }

      await fetchClockUsers();
      setClockUserDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar usuario');
    }
  };

  const handleDeleteClockUser = async (user) => {
    if (!window.confirm(`¿Eliminar usuario ${user.name}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/clock/users/${user.user_id}`, { withCredentials: true });
      toast.success('Usuario eliminado');
      await fetchClockUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar usuario');
    }
  };

  const handlePullUsers = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/clock/users/pull`, {}, { withCredentials: true });
      toast.success(`Usuarios importados: ${response.data.imported}`);
      await fetchClockUsers();
      await fetchClockStatus();
    } catch (error) {
      toast.error(getClockErrorMessage(error, 'No se pudo importar usuarios del reloj'));
    }
  };

  const handlePushUsers = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/clock/users/push`, {}, { withCredentials: true });
      const errors = response.data.errors?.length || 0;
      toast.success(`Usuarios subidos: ${response.data.pushed}. Errores: ${errors}`);
      await fetchClockUsers();
    } catch (error) {
      toast.error(getClockErrorMessage(error, 'No se pudieron subir usuarios al reloj'));
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const response = await axios.post(`${API_URL}/api/check-updates`, {}, { withCredentials: true });
      setVersionInfo(response.data);
      if (response.data.update_available) {
        toast.success(`Nueva versión disponible: ${response.data.latest_version}`);
      } else {
        toast.info('Ya tienes la última versión');
      }
    } catch (error) {
      toast.error('Error al verificar actualizaciones');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleOpenBonusWindow = () => {
    const employeesForBonus = dashboardData?.employees || [];
    if (!employeesForBonus.length) {
      toast.error('No hay empleados para calcular bonos');
      return;
    }

    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    const rowsHtml = employeesForBonus.map((employee) => {
      const hasBonusData = employee.bonus_eligible_days != null || employee.bonus_lost_days != null;
      const bonusEligible = hasBonusData
        ? Number(employee.bonus_eligible_days || 0)
        : (Number(employee.absence_days || 0) === 0 && Number(employee.delay_count || 0) === 0 ? 1 : 0);
      const bonusLost = hasBonusData
        ? Number(employee.bonus_lost_days || 0)
        : (bonusEligible > 0 ? 0 : 1);
      const absences = Number(employee.absence_days || 0);
      const status = bonusEligible > 0 ? 'Con bono' : 'Sin bono';
      return `
        <tr>
          <td>${escapeHtml(employee.employee_id)}</td>
          <td>${escapeHtml(employee.name)}</td>
          <td>${bonusEligible}</td>
          <td>${bonusLost}</td>
          <td>${absences}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join('');

    const bonusWindow = escapeHtml(dashboardData?.statistics?.bonus_window || '09:00 a 09:30');
    const notes = escapeHtml(dashboardData?.statistics?.bonus_policy_note || 'Después de ese horario ya no cuenta para bono.');

    const reportWindow = window.open('', '_blank', 'width=980,height=700');
    if (!reportWindow) {
      toast.error('No se pudo abrir la ventana de bonos. Revisa bloqueador de pop-ups.');
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Bono de empleados</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin: 0 0 8px; }
            p { margin: 0 0 10px; color: #444; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #d4d4d8; padding: 8px 10px; text-align: left; font-size: 14px; }
            th { background: #f4f4f5; text-transform: uppercase; font-size: 12px; letter-spacing: .04em; }
          </style>
        </head>
        <body>
          <h1>Cálculo de bonos</h1>
          <p><strong>Horario bono:</strong> ${bonusWindow}</p>
          <p>${notes}</p>
          <p><strong>Condiciones:</strong> Entrada dentro del horario bono. Si llega después de 09:30, pierde bono. Las faltas no se descuentan para bono, pero sí se muestran para vacaciones.</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Empleado</th>
                <th>Días con bono</th>
                <th>Días sin bono</th>
                <th>Faltas</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const handleOpenExcelInNewWindow = () => {
    if (!excelPreview?.sheets) {
      toast.error('No hay vista de Excel para abrir');
      return;
    }

    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    const sheetsHtml = Object.entries(excelPreview.sheets).map(([sheetName, rows]) => {
      const rowsHtml = rows.map((row, rowIdx) => `
        <tr class="${rowIdx === 0 ? 'head' : ''}">
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
        </tr>
      `).join('');

      return `
        <section>
          <h2>${escapeHtml(sheetName)}</h2>
          <div class="table-wrap">
            <table>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </section>
      `;
    }).join('');

    const win = window.open('', '_blank', 'width=1300,height=850');
    if (!win) {
      toast.error('No se pudo abrir el Excel completo. Revisa bloqueador de pop-ups.');
      return;
    }

    win.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Vista completa Excel</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 16px; }
            h1 { margin: 0 0 12px; }
            h2 { margin: 18px 0 8px; font-size: 16px; }
            .table-wrap { overflow: auto; border: 1px solid #d4d4d8; max-height: 65vh; }
            table { border-collapse: collapse; min-width: 100%; }
            td { border: 1px solid #e4e4e7; padding: 6px 8px; white-space: nowrap; font-size: 12px; }
            tr.head td { background: #f4f4f5; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Vista completa de Excel</h1>
          <p>Archivo: ${escapeHtml(excelPreview.filename || 'Sin nombre')}</p>
          ${sheetsHtml}
        </body>
      </html>
    `);
    win.document.close();
  };

  const closeClockProcessModal = () => {
    setClockProcess({ visible: false, status: 'loading', step: '', detail: '' });
  };

  const clockProcessOverlay = clockProcess.visible
    ? createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 text-center shadow-2xl pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={closeClockProcessModal} aria-label="Cerrar modal de proceso del reloj">
              <X className="w-4 h-4" />
            </Button>
          </div>
          {clockProcess.status === 'loading' && <div className="loader w-12 h-12 mx-auto mb-4" />}
          {clockProcess.status === 'success' && (
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl">✓</div>
          )}
          {clockProcess.status === 'error' && (
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl error-pulse">✕</div>
          )}
          <h3 className="text-lg font-bold mb-2">{clockProcess.step}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-300">{clockProcess.detail}</p>
          {clockProcess.status === 'error' && (
            <Button className="mt-4" onClick={closeClockProcessModal}>Cerrar</Button>
          )}
        </div>
      </div>,
      document.body
    )
    : null;

  const loadEmployeeHistory = async (employeeId, employeeName) => {
    try {
      const response = await axios.get(`${API_URL}/api/employees/${employeeId}/history`, { withCredentials: true });
      setEmployeeHistory(response.data);
      setSelectedEmployee(employeeName);
    } catch (error) {
      toast.error('Error al cargar historial');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="loader w-8 h-8" />
      </div>
    );
  }

  const stats = dashboardData?.statistics || {};
  const employees = dashboardData?.employees || [];
  const alerts = dashboardData?.alerts || [];

  // Chart data
  const absenceChartData = employees.slice(0, 10).map(emp => ({
    name: emp.name.split('.')[0],
    faltas: emp.absence_days,
    retardos: emp.delay_count
  }));

  const pieData = [
    { name: 'Presentes', value: stats.total_employees - (stats.total_absences || 0), color: '#18181b' },
    { name: 'Faltas', value: stats.total_absences || 0, color: '#E53935' },
    { name: 'Retardos', value: stats.total_delays || 0, color: '#FACC15' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      <Toaster position="top-right" toastOptions={{ className: 'max-w-[420px] break-words' }} />
      
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ASISTENCIA</h1>
              <p className="text-xs text-zinc-500">v{versionInfo?.current_version || '1.0.0'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Upload Button */}
            <label data-testid="upload-excel-button" className="cursor-pointer">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="upload-excel-input"
              />
              <div className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-zinc-800 transition-colors">
                {uploading ? (
                  <div className="loader w-4 h-4 border-white border-t-transparent" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Cargar Excel</span>
              </div>
            </label>

            <Button
              variant="outline"
              className="border-2 border-zinc-200 hover:border-black dark:border-zinc-700 dark:hover:border-zinc-300"
              onClick={handleOpenBonusWindow}
            >
              Calcular bonos
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="border-2 border-zinc-200 hover:border-black dark:border-zinc-700 dark:hover:border-zinc-300"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              data-testid="theme-toggle-button"
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
                </svg>
              )}
            </Button>

            {/* Settings */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" data-testid="settings-button" className="border-2 border-zinc-200 hover:border-black dark:border-zinc-700 dark:hover:border-zinc-300">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Configuración</DialogTitle>
                  <DialogDescription>
                    Ajusta reglas de asistencia, conexión del reloj y actualizaciones.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-semibold">Hora de Entrada</Label>
                    <Input
                      type="time"
                      data-testid="settings-entry-time"
                      value={settings.entry_time}
                      onChange={(e) => setSettings({ ...settings, entry_time: e.target.value })}
                      className="border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-semibold">Tolerancia (minutos)</Label>
                    <Input
                      type="number"
                      data-testid="settings-tolerance"
                      value={settings.tolerance_minutes}
                      onChange={(e) => setSettings({ ...settings, tolerance_minutes: parseInt(e.target.value) })}
                      className="border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-semibold">Horas Laborales</Label>
                    <Input
                      type="number"
                      data-testid="settings-work-hours"
                      value={settings.work_hours}
                      onChange={(e) => setSettings({ ...settings, work_hours: parseInt(e.target.value) })}
                      className="border-2"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Wifi className="w-4 h-4" />
                      Conexión Reloj Checador
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-semibold">Nombre del equipo</Label>
                      <Input
                        value={clockConfig.device_name || ''}
                        onChange={(e) => setClockConfig({ ...clockConfig, device_name: e.target.value })}
                        className="border-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-semibold">IP</Label>
                        <Input
                          value={clockConfig.ip || ''}
                          onChange={(e) => setClockConfig({ ...clockConfig, ip: e.target.value })}
                          className="border-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-semibold">Puerto</Label>
                        <Input
                          type="number"
                          value={clockConfig.port || 4370}
                          onChange={(e) => setClockConfig({ ...clockConfig, port: parseInt(e.target.value || '4370', 10) })}
                          className="border-2"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-semibold">Contraseña/Comm Key</Label>
                      <Input
                        value={clockConfig.password || ''}
                        onChange={(e) => setClockConfig({ ...clockConfig, password: e.target.value })}
                        className="border-2"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2 border border-zinc-200">
                      <span className="text-sm">
                        Estado actual: <strong>{clockStatus?.connected ? 'Conectado' : 'Desconectado'}</strong>
                      </span>
                      <Button
                        variant={clockStatus?.connected ? 'destructive' : 'outline'}
                        className="border-2"
                        onClick={() => handleToggleConnection(!clockStatus?.connected)}
                      >
                        {clockStatus?.connected ? 'Desconectar para cambiar reloj' : 'Conectar reloj'}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-semibold">Regla principal</Label>
                      <Input
                        value={clockConfig.rules?.[0]?.name || ''}
                        onChange={(e) => {
                          const nextRules = [...(clockConfig.rules || [])];
                          if (!nextRules[0]) nextRules[0] = { name: '', expected_entry_time: '09:00', tolerance_minutes: 30 };
                          nextRules[0].name = e.target.value;
                          setClockConfig({ ...clockConfig, rules: nextRules });
                        }}
                        className="border-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="border-2" onClick={handleSaveClockConfig}>
                        <Database className="w-4 h-4 mr-2" />Guardar Reloj
                      </Button>
                      <Button variant="outline" className="border-2" onClick={handleTestClockConnection}>
                        Probar Conexión
                      </Button>
                    </div>
                    <Button className="w-full bg-black hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300" onClick={handleSyncFromClock}>
                      Sincronizar Asistencias del Reloj
                    </Button>
                    {clockConfig.last_sync && (
                      <p className="text-xs text-zinc-500">Última sincronización: {new Date(clockConfig.last_sync).toLocaleString('es-MX')}</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-semibold">Repositorio GitHub</Label>
                    <p className="text-sm text-zinc-500">{versionInfo?.github_repo || 'No configurado'}</p>
                    <Button
                      variant="outline"
                      onClick={handleCheckUpdates}
                      disabled={checkingUpdates}
                      data-testid="check-updates-button"
                      className="w-full border-2"
                    >
                      {checkingUpdates ? (
                        <div className="loader w-4 h-4" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Verificar Actualizaciones
                        </>
                      )}
                    </Button>
                    {versionInfo?.update_available && (
                      <div className="p-3 bg-green-50 border border-green-200">
                        <p className="text-sm font-medium text-green-800">
                          Nueva versión disponible: {versionInfo.latest_version}
                        </p>
                        {versionInfo.download_url && (
                          <a
                            href={versionInfo.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-600 underline"
                          >
                            Ver en GitHub
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleSaveSettings} data-testid="save-settings-button" className="w-full bg-black hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                    Guardar Configuración
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="user-menu-button" className="border-2 border-zinc-200 hover:border-black">
                  <span className="mr-2">{user?.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-button">
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Main Dashboard */}
        <main className={`${showExcelPanel ? 'lg:col-span-8' : 'lg:col-span-12'} p-4 md:p-6 space-y-6`}>
          {/* Stats Cards */}
          {dashboardData?.has_data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  label="Empleados"
                  value={stats.total_employees || 0}
                  testId="stat-employees"
                />
                <StatCard
                  icon={<UserX className="w-5 h-5" />}
                  label="Total Faltas"
                  value={stats.total_absences || 0}
                  variant="danger"
                  testId="stat-absences"
                />
                <StatCard
                  icon={<Timer className="w-5 h-5" />}
                  label="Total Retardos"
                  value={stats.total_delays || 0}
                  variant="warning"
                  testId="stat-delays"
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Min. Retardo"
                  value={stats.total_delay_minutes || 0}
                  testId="stat-delay-minutes"
                />
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Centro de Reloj Checador</h3>
                  <Badge className={clockStatus?.connected ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}>
                    {clockStatus?.connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                {clockLibraryMissing && (
                  <div className="p-3 text-sm border border-yellow-600/40 bg-yellow-500/10 text-yellow-200">
                    Modo sin reloj físico: instala <code>pyzk</code> en el entorno del backend para habilitar prueba/sync/importación.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-500">Dispositivo</p>
                    <p className="font-medium">{clockStatus?.device_name || 'Sin configurar'}</p>
                    <p className="text-zinc-500">{clockStatus?.ip}:{clockStatus?.port}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-500">Usuarios en app</p>
                    <p className="font-medium">{clockStatus?.users_count || 0}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-500">Última sincronización</p>
                    <p className="font-medium">{clockStatus?.last_sync ? new Date(clockStatus.last_sync).toLocaleString('es-MX') : 'Sin sync'}</p>
                  </div>
                </div>
                {clockNetwork && (
                  <div className={`p-2 text-xs border ${clockNetwork.same_subnet ? 'border-green-600/40 bg-green-500/10 text-green-300' : 'border-yellow-600/40 bg-yellow-500/10 text-yellow-200'}`}>
                    Red reloj: {clockNetwork.message} (Reloj: {clockNetwork.clock_ip || 'sin IP'} | Equipo: {clockNetwork.local_ips?.join(', ')})
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="border-2" onClick={openCreateClockUserDialog}>+ Agregar usuario</Button>
                  <Button variant="outline" className="border-2" onClick={handlePullUsers} disabled={clockReadOnly}>Importar usuarios del reloj</Button>
                  <Button variant="outline" className="border-2" onClick={handlePushUsers} disabled={clockReadOnly}>Subir usuarios al reloj (Wi-Fi)</Button>
                  <Button variant="outline" className="border-2" onClick={handleSyncFromClock} disabled={clockReadOnly}>Descargar asistencias</Button>
                  <Button variant="outline" className="border-2" onClick={fetchLiveAttendance} disabled={clockReadOnly}>Actualizar tiempo real</Button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="border border-zinc-200 dark:border-zinc-800">
                    <div className="p-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase tracking-widest">Usuarios del reloj</div>
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="text-left p-2">ID</th>
                            <th className="text-left p-2">Nombre</th>
                            <th className="text-left p-2">Huella</th>
                            <th className="text-left p-2">Horario</th>
                            <th className="text-left p-2">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clockUsers.slice(0, 100).map((u) => (
                            <tr key={u._id} className="border-b border-zinc-100 dark:border-zinc-900">
                              <td className="p-2 font-mono">{u.user_id}</td>
                              <td className="p-2">{u.name}</td>
                              <td className="p-2">{u.fingerprint_registered ? 'Sí' : 'No'}</td>
                              <td className="p-2">{u.work_schedule || 'Turno General'}</td>
                              <td className="p-2 flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEditClockUserDialog(u)}>Editar</Button>
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteClockUser(u)}>Borrar</Button>
                              </td>
                            </tr>
                          ))}
                          {clockUsers.length === 0 && (
                            <tr>
                              <td className="p-3 text-zinc-500" colSpan={5}>No hay usuarios cargados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-800">
                    <div className="p-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase tracking-widest">Asistencias en tiempo real</div>
                    <div className="max-h-64 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-900">
                      {liveAttendance.slice(0, 50).map((event, idx) => (
                        <div key={`${event.employee_id}-${event.timestamp}-${idx}`} className="p-2 text-sm flex items-center justify-between">
                          <span className="font-mono">{event.employee_id}</span>
                          <span>{new Date(event.timestamp).toLocaleString('es-MX')}</span>
                        </div>
                      ))}
                      {liveAttendance.length === 0 && (
                        <div className="p-3 text-zinc-500 text-sm">No hay eventos recientes.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-widest mb-4">Faltas y Retardos por Empleado</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={absenceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="faltas" fill="#E53935" name="Faltas" />
                        <Bar dataKey="retardos" fill="#FACC15" name="Retardos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart */}
                <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-widest mb-4">Distribución General</h3>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {pieData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <div className="w-3 h-3" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Alertas de Asistencia
                  </h3>
                  <div className="space-y-2">
                    {alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        data-testid={`alert-${idx}`}
                        className={`flex items-center gap-3 p-3 ${
                          alert.type === 'danger' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-yellow-50 border-l-4 border-yellow-500'
                        }`}
                      >
                        {alert.type === 'danger' ? (
                          <UserX className="w-4 h-4 text-red-600" />
                        ) : (
                          <Timer className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="font-medium">{alert.employee}</span>
                        <span className="text-sm text-zinc-600">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employees Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Resumen de Empleados</h3>
                  {dashboardData?.report_id && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { loadReportData(dashboardData.report_id); loadExcelPreview(dashboardData.report_id); }}
                        data-testid="view-excel-button"
                        className="border-2"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPDF(dashboardData.report_id)}
                        data-testid="export-pdf-button"
                        className="border-2"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Exportar PDF
                      </Button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full data-table">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="text-left p-3">ID</th>
                        <th className="text-left p-3">Nombre</th>
                        <th className="text-left p-3">Departamento</th>
                        <th className="text-center p-3">Faltas</th>
                        <th className="text-center p-3">Retardos</th>
                        <th className="text-center p-3">Min. Retardo</th>
                        <th className="text-center p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, idx) => (
                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors" data-testid={`employee-row-${idx}`}>
                          <td className="p-3 font-mono text-sm">{emp.employee_id}</td>
                          <td className="p-3 font-medium">{emp.name}</td>
                          <td className="p-3 text-zinc-600">{emp.department}</td>
                          <td className="p-3 text-center">
                            <Badge className={emp.absence_days > 0 ? 'bg-red-100 text-red-700' : 'bg-zinc-100'}>
                              {emp.absence_days}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={emp.delay_count > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-zinc-100'}>
                              {emp.delay_count}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-mono text-sm">{emp.delay_minutes}</td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadEmployeeHistory(emp.employee_id, emp.name)}
                              data-testid={`view-history-${emp.employee_id}`}
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reports History */}
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Historial de Reportes</h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {reports.map((report) => (
                    <div key={report._id} className={`p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 ${selectedReport === report._id ? 'bg-zinc-100 dark:bg-zinc-900/70' : ''}`} data-testid={`report-${report._id}`}>
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-zinc-400" />
                        <div>
                          <p className="font-medium">{report.filename}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(report.upload_date).toLocaleDateString('es-MX', { 
                              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { loadReportData(report._id); loadExcelPreview(report._id); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleExportPDF(report._id)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report._id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <div className="p-8 text-center text-zinc-500">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No hay reportes cargados</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileSpreadsheet className="w-16 h-16 text-zinc-300 mb-4" />
              <h2 className="text-xl font-bold mb-2">No hay datos cargados</h2>
              <p className="text-zinc-500 mb-6">Sube un archivo Excel para comenzar a analizar la asistencia</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-zinc-800 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Cargar Excel</span>
                </div>
              </label>
            </div>
          )}
        </main>

        {/* Excel Preview Panel */}
        {showExcelPanel && excelPreview && (
          <aside className="lg:col-span-4 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Vista Previa Excel</h3>
                <p className="text-xs text-zinc-500 truncate">{excelPreview.filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="border-2" onClick={handleOpenExcelInNewWindow}>
                  Abrir completo
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowExcelPanel(false)} data-testid="close-excel-panel">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Sheet Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <ScrollArea className="w-full" orientation="horizontal">
                <div className="flex p-2 gap-1">
                  {Object.keys(excelPreview.sheets).map((sheetName) => (
                    <button
                      key={sheetName}
                      onClick={() => setSelectedSheet(sheetName)}
                      data-testid={`sheet-tab-${sheetName}`}
                      className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedSheet === sheetName
                          ? 'bg-black text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {sheetName}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Sheet Content */}
            <ScrollArea className="flex-1">
              <div className="p-2 overflow-x-auto">
                {selectedSheet && excelPreview.sheets[selectedSheet] && (
                  <table className="excel-preview-table w-max min-w-full">
                    <tbody>
                      {excelPreview.sheets[selectedSheet].map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx === 0 ? 'bg-zinc-200 dark:bg-zinc-800 font-semibold' : rowIdx % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-900'}>
                          {row.map((cell, colIdx) => (
                            <td key={colIdx} title={cell}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      {/* Employee History Dialog */}
      <Dialog open={!!employeeHistory} onOpenChange={() => { setEmployeeHistory(null); setSelectedEmployee(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Asistencia - {selectedEmployee}</DialogTitle>
            <DialogDescription>
              Registros recientes del empleado seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {employeeHistory && employeeHistory.length > 0 ? (
              employeeHistory.map((report, idx) => (
                <div key={idx} className="border border-zinc-200 p-4">
                  <h4 className="font-semibold mb-2">{report.filename}</h4>
                  <p className="text-xs text-zinc-500 mb-3">
                    {new Date(report.report_date).toLocaleDateString('es-MX')}
                  </p>
                  <div className="space-y-1">
                    {report.records.slice(0, 10).map((record, rIdx) => (
                      <div key={rIdx} className="flex items-center gap-2 text-sm">
                        <span className="font-mono w-24">{record.date}</span>
                        <Badge className={
                          record.status === 'falta' ? 'bg-red-100 text-red-700' :
                          record.status === 'retardo' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }>
                          {record.status === 'falta' ? 'Falta' : record.status === 'retardo' ? 'Retardo' : 'Presente'}
                        </Badge>
                        {record.entry_time && <span className="text-zinc-500">Entrada: {record.entry_time}</span>}
                        {record.delay_minutes > 0 && <span className="text-yellow-600">{record.delay_minutes} min tarde</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-zinc-500 py-8">No hay historial disponible</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clock User Dialog */}
      <Dialog open={clockUserDialogOpen} onOpenChange={setClockUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{clockUserDialogMode === 'create' ? 'Agregar usuario del reloj' : 'Editar usuario del reloj'}</DialogTitle>
            <DialogDescription>
              Completa los campos del usuario para guardarlo en la app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>ID del usuario</Label>
              <Input
                value={clockUserForm.user_id}
                disabled={clockUserDialogMode === 'edit'}
                onChange={(e) => setClockUserForm({ ...clockUserForm, user_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={clockUserForm.name} onChange={(e) => setClockUserForm({ ...clockUserForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={clockUserForm.department} onChange={(e) => setClockUserForm({ ...clockUserForm, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Horario</Label>
              <Input value={clockUserForm.work_schedule} onChange={(e) => setClockUserForm({ ...clockUserForm, work_schedule: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setClockUserDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-black hover:bg-zinc-800" onClick={handleSubmitClockUser}>
                {clockUserDialogMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {clockProcessOverlay}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, variant = 'default', testId }) => {
  const variants = {
    default: 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800',
    danger: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900',
    success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
  };

  const iconVariants = {
    default: 'text-zinc-600 dark:text-zinc-300',
    danger: 'text-red-600 dark:text-red-300',
    warning: 'text-yellow-600 dark:text-yellow-300',
    success: 'text-green-600 dark:text-green-300'
  };

  return (
    <div className={`p-4 border ${variants[variant]}`} data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <span className={iconVariants[variant]}>{icon}</span>
        <span className="text-xs uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
};

export default DashboardPage;
