import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { Upload, FileSpreadsheet, Settings, LogOut, Download, Trash2, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [settings, setSettings] = useState({ entry_time: '09:00', tolerance_minutes: 30, work_hours: 9 });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await axios.get(`${API_URL}/api/dashboard/stats`, { withCredentials: true });
    setStats(res.data);
  }, []);

  const fetchReports = useCallback(async () => {
    const res = await axios.get(`${API_URL}/api/reports`, { withCredentials: true });
    setReports(res.data || []);
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
    setSettings(res.data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchReports(), fetchSettings()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudieron cargar datos');
    } finally {
      setLoading(false);
    }
  }, [fetchReports, fetchSettings, fetchStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/api/upload/excel`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Excel cargado correctamente');
      await loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir archivo');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(`${API_URL}/api/settings`, settings, { withCredentials: true });
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar configuración');
    }
  };

  const handleDeleteReport = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/reports/${id}`, { withCredentials: true });
      toast.success('Reporte eliminado');
      await loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  const summaryCards = useMemo(
    () => [
      { title: 'Empleados', value: stats?.total_employees ?? 0 },
      { title: 'Presentes', value: stats?.present_today ?? 0 },
      { title: 'Retardos', value: stats?.late_today ?? 0 },
      { title: 'Faltas', value: stats?.absent_today ?? 0 },
    ],
    [stats]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Toaster richColors position="top-right" />

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ViewAsist</h1>
          <p className="text-sm text-zinc-500">Bienvenido, {user?.name || user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll}><RefreshCw className="w-4 h-4 mr-2" />Actualizar</Button>
          <Button variant="destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Salir</Button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.title} className="bg-white border p-4 rounded-lg">
              <p className="text-sm text-zinc-500">{card.title}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList>
            <TabsTrigger value="reports"><FileSpreadsheet className="w-4 h-4 mr-2" />Reportes</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <h2 className="font-semibold">Carga de asistencias</h2>
                <p className="text-sm text-zinc-500">Sube un Excel para generar reportes (sin reloj checador).</p>
              </div>
              <div className="flex gap-2">
                <Label className="cursor-pointer inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md">
                  <Upload className="w-4 h-4" /> {uploading ? 'Subiendo...' : 'Subir Excel'}
                  <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
                </Label>
                <Button
                  variant="outline"
                  onClick={() => window.open(`${API_URL}/api/reports/export`, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />Exportar CSV
                </Button>
              </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">Historial de reportes</div>
              {reports.length === 0 ? (
                <p className="p-4 text-zinc-500">No hay reportes todavía.</p>
              ) : (
                <div className="divide-y">
                  {reports.map((report) => (
                    <div key={report.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{report.filename}</p>
                        <p className="text-xs text-zinc-500">{new Date(report.upload_date).toLocaleString('es-MX')} · {report.records_count} registros</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(`${API_URL}/api/reports/${report.id}/pdf`, '_blank')}>
                          <Download className="w-4 h-4 mr-1" />PDF
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteReport(report.id)}>
                          <Trash2 className="w-4 h-4 mr-1" />Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="bg-white border rounded-lg p-4 space-y-4 max-w-xl">
              <div>
                <Label>Hora de entrada</Label>
                <Input value={settings.entry_time} onChange={(e) => setSettings((prev) => ({ ...prev, entry_time: e.target.value }))} />
              </div>
              <div>
                <Label>Tolerancia (minutos)</Label>
                <Input
                  type="number"
                  value={settings.tolerance_minutes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, tolerance_minutes: Number(e.target.value || 0) }))}
                />
              </div>
              <div>
                <Label>Horas laborales</Label>
                <Input
                  type="number"
                  value={settings.work_hours}
                  onChange={(e) => setSettings((prev) => ({ ...prev, work_hours: Number(e.target.value || 0) }))}
                />
              </div>

              <Button className="bg-black hover:bg-zinc-800" onClick={handleSaveSettings}>Guardar configuración</Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DashboardPage;
