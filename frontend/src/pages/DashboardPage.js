import React, { useState, useEffect, useCallback } from 'react';
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
  const [clockConfig, setClockConfig] = useState({ device_name: 'Reloj Principal', ip: '192.168.1.104', port: 4370, password: '123', rules: [{ name: 'Turno General', expected_entry_time: '09:00', tolerance_minutes: 30 }] });
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
    } catch (error) {
      console.error('Error fetching clock status:', error);
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
        fetchVersion()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboardData, fetchReports, fetchSettings, fetchClockConfig, fetchClockStatus, fetchClockUsers, fetchLiveAttendance, fetchVersion]);

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
      setSelectedReport(response.data.report_id);
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
      const sheetNames = Object.keys(response.data.sheets);
      if (sheetNames.length > 0) {
        setSelectedSheet(sheetNames[0]);
      }
      setShowExcelPanel(true);
    } catch (error) {
      toast.error('Error al cargar vista previa del Excel');
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
    try {
      const response = await axios.post(`${API_URL}/api/clock/test-connection`, {}, { withCredentials: true });
      if (response.data.connected) {
        toast.success(response.data.message || 'Conexión exitosa con reloj');
      } else {
        toast.error(response.data.message || 'No se pudo conectar con el reloj');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error validando conexión del reloj');
    }
  };

  const handleSyncFromClock = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/clock/sync`, {}, { withCredentials: true });
      toast.success(`Sync completado: ${response.data.synced_records} registros`);
      await fetchDashboardData();
      await fetchReports();
      await fetchClockConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo sincronizar con el reloj');
    }
  };

  const handleToggleConnection = async (nextValue) => {
    try {
      await axios.post(`${API_URL}/api/clock/connection`, { connected: nextValue }, { withCredentials: true });
      toast.success(nextValue ? 'Reloj conectado' : 'Reloj desconectado');
      await fetchClockStatus();
      await fetchClockConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado de conexión');
    }
  };

  const handleAddClockUser = async () => {
    const user_id = window.prompt('ID del usuario');
    if (!user_id) return;
    const name = window.prompt('Nombre del usuario');
    if (!name) return;
    const department = window.prompt('Departamento', 'General') || 'General';
    try {
      await axios.post(`${API_URL}/api/clock/users`, {
        user_id,
        name,
        department,
        privilege: 'empleado',
        password: '',
        card_number: '',
        fingerprint_registered: false,
        face_registered: false,
        vein_registered: false,
        work_schedule: 'Turno General',
        enabled: true
      }, { withCredentials: true });
      toast.success('Usuario creado');
      await fetchClockUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear el usuario');
    }
  };

  const handleEditClockUser = async (user) => {
    const name = window.prompt('Nuevo nombre', user.name);
    if (!name) return;
    const department = window.prompt('Departamento', user.department || 'General') || 'General';
    const work_schedule = window.prompt('Horario de trabajo', user.work_schedule || 'Turno General') || 'Turno General';
    try {
      await axios.put(`${API_URL}/api/clock/users/${user.user_id}`, {
        name,
        department,
        work_schedule
      }, { withCredentials: true });
      toast.success('Usuario actualizado');
      await fetchClockUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar usuario');
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
      toast.error(error.response?.data?.detail || 'No se pudo importar usuarios del reloj');
    }
  };

  const handlePushUsers = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/clock/users/push`, {}, { withCredentials: true });
      const errors = response.data.errors?.length || 0;
      toast.success(`Usuarios subidos: ${response.data.pushed}. Errores: ${errors}`);
      await fetchClockUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudieron subir usuarios al reloj');
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
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" />
      
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-zinc-200">
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

            {/* Settings */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" data-testid="settings-button" className="border-2 border-zinc-200 hover:border-black">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Configuración</DialogTitle>
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
                    <Button className="w-full bg-black hover:bg-zinc-800" onClick={handleSyncFromClock}>
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
                  <Button onClick={handleSaveSettings} data-testid="save-settings-button" className="w-full bg-black hover:bg-zinc-800">
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

              <div className="border border-zinc-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Centro de Reloj Checador</h3>
                  <Badge className={clockStatus?.connected ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}>
                    {clockStatus?.connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-zinc-50 border border-zinc-200">
                    <p className="text-zinc-500">Dispositivo</p>
                    <p className="font-medium">{clockStatus?.device_name || 'Sin configurar'}</p>
                    <p className="text-zinc-500">{clockStatus?.ip}:{clockStatus?.port}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 border border-zinc-200">
                    <p className="text-zinc-500">Usuarios en app</p>
                    <p className="font-medium">{clockStatus?.users_count || 0}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 border border-zinc-200">
                    <p className="text-zinc-500">Última sincronización</p>
                    <p className="font-medium">{clockStatus?.last_sync ? new Date(clockStatus.last_sync).toLocaleString('es-MX') : 'Sin sync'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="border-2" onClick={handleAddClockUser}>+ Agregar usuario</Button>
                  <Button variant="outline" className="border-2" onClick={handlePullUsers}>Importar usuarios del reloj</Button>
                  <Button variant="outline" className="border-2" onClick={handlePushUsers}>Subir usuarios al reloj (Wi-Fi)</Button>
                  <Button variant="outline" className="border-2" onClick={handleSyncFromClock}>Descargar asistencias</Button>
                  <Button variant="outline" className="border-2" onClick={fetchLiveAttendance}>Actualizar tiempo real</Button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="border border-zinc-200">
                    <div className="p-2 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold uppercase tracking-widest">Usuarios del reloj</div>
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200">
                            <th className="text-left p-2">ID</th>
                            <th className="text-left p-2">Nombre</th>
                            <th className="text-left p-2">Huella</th>
                            <th className="text-left p-2">Horario</th>
                            <th className="text-left p-2">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clockUsers.slice(0, 100).map((u) => (
                            <tr key={u._id} className="border-b border-zinc-100">
                              <td className="p-2 font-mono">{u.user_id}</td>
                              <td className="p-2">{u.name}</td>
                              <td className="p-2">{u.fingerprint_registered ? 'Sí' : 'No'}</td>
                              <td className="p-2">{u.work_schedule || 'Turno General'}</td>
                              <td className="p-2 flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEditClockUser(u)}>Editar</Button>
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
                  <div className="border border-zinc-200">
                    <div className="p-2 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold uppercase tracking-widest">Asistencias en tiempo real</div>
                    <div className="max-h-64 overflow-auto divide-y divide-zinc-100">
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
                <div className="border border-zinc-200 p-4">
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
                <div className="border border-zinc-200 p-4">
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
                <div className="border border-zinc-200 p-4">
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
              <div className="border border-zinc-200">
                <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Resumen de Empleados</h3>
                  {dashboardData?.report_id && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadExcelPreview(dashboardData.report_id)}
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
                    <thead className="bg-zinc-50 border-b border-zinc-200">
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
                        <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors" data-testid={`employee-row-${idx}`}>
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
              <div className="border border-zinc-200">
                <div className="p-4 border-b border-zinc-200">
                  <h3 className="text-sm font-semibold uppercase tracking-widest">Historial de Reportes</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {reports.map((report) => (
                    <div key={report._id} className="p-4 flex items-center justify-between hover:bg-zinc-50" data-testid={`report-${report._id}`}>
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
                        <Button variant="ghost" size="sm" onClick={() => loadExcelPreview(report._id)}>
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
          <aside className="lg:col-span-4 border-l border-zinc-200 bg-zinc-50 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-200 bg-white flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Vista Previa Excel</h3>
                <p className="text-xs text-zinc-500 truncate">{excelPreview.filename}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowExcelPanel(false)} data-testid="close-excel-panel">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Sheet Tabs */}
            <div className="border-b border-zinc-200 bg-white">
              <ScrollArea className="w-full" orientation="horizontal">
                <div className="flex p-2 gap-1">
                  {Object.keys(excelPreview.sheets).map((sheetName) => (
                    <button
                      key={sheetName}
                      onClick={() => setSelectedSheet(sheetName)}
                      data-testid={`sheet-tab-${sheetName}`}
                      className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedSheet === sheetName
                          ? 'bg-black text-white'
                          : 'bg-zinc-100 hover:bg-zinc-200'
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
              <div className="p-2">
                {selectedSheet && excelPreview.sheets[selectedSheet] && (
                  <table className="excel-preview-table w-full">
                    <tbody>
                      {excelPreview.sheets[selectedSheet].slice(0, 50).map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx === 0 ? 'bg-zinc-200 font-semibold' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
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
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, variant = 'default', testId }) => {
  const variants = {
    default: 'bg-white border-zinc-200',
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200'
  };

  const iconVariants = {
    default: 'text-zinc-600',
    danger: 'text-red-600',
    warning: 'text-yellow-600',
    success: 'text-green-600'
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
