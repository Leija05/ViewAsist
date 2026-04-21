import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast, Toaster } from 'sonner';
import { AlertTriangle, Bluetooth, LogOut, Moon, Sun, UserRound, UsersRound, Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
const SENSOR_TIMEOUT_MS = 1800;

const TelemetryContext = createContext(null);

const parseTelemetryCsvLine = (line) => {
  const cleaned = line.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(',');
  if (parts.length !== 7) return null;

  const values = parts.map((part) => Number.parseFloat(part));
  if (values.some((value) => Number.isNaN(value))) return null;

  const [xG, yG, zG, gx, gy, gz, magnitudG] = values;
  return { xG, yG, zG, gx, gy, gz, magnitudG, raw: cleaned, ts: Date.now() };
};

const TelemetryProvider = ({ children }) => {
  const [telemetry, setTelemetry] = useState({ xG: 0, yG: 0, zG: 1, gx: 0, gy: 0, gz: 0, magnitudG: 1, raw: '', ts: 0 });
  const [sensorConnected, setSensorConnected] = useState(false);
  const [impactThreshold, setImpactThreshold] = useState(5);
  const streamBufferRef = useRef('');
  const lastSignalAtRef = useRef(0);
  const pendingFrameRef = useRef(null);
  const rafRef = useRef(null);

  const enqueueTelemetryFrame = useCallback((frame) => {
    pendingFrameRef.current = frame;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingFrameRef.current) {
        setTelemetry(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
    });
  }, []);

  const parseTelemetryStream = useCallback((chunkText) => {
    if (!chunkText) return;
    streamBufferRef.current += chunkText;
    const lines = streamBufferRef.current.split(/\r?\n/);
    streamBufferRef.current = lines.pop() ?? '';

    for (const line of lines) {
      const frame = parseTelemetryCsvLine(line);
      if (!frame) continue;
      lastSignalAtRef.current = frame.ts;
      setSensorConnected(true);
      enqueueTelemetryFrame(frame);
    }
  }, [enqueueTelemetryFrame]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastSignalAtRef.current) return;
      if (Date.now() - lastSignalAtRef.current > SENSOR_TIMEOUT_MS) {
        setSensorConnected(false);
      }
    }, 250);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const value = {
    telemetry,
    impactThreshold,
    setImpactThreshold,
    sensorConnected,
    parseTelemetryStream,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return context;
};

const BentoCard = ({ className = '', children, alert = false }) => (
  <article className={`glass-card p-5 transition-all duration-300 ${alert ? 'ring-1 ring-red-400/70 bg-red-500/10' : ''} ${className}`}>{children}</article>
);

const DashboardContent = () => {
  const { user, logout } = useAuth();
  const { telemetry, impactThreshold, setImpactThreshold, sensorConnected, parseTelemetryStream } = useTelemetry();

  const [theme, setTheme] = useState(() => localStorage.getItem('crash-theme') || 'dark');
  const [emergencyContacts] = useState([
    { name: '911 Nacional', channel: 'Llamada', value: '911' },
    { name: 'Contacto Principal', channel: 'WhatsApp', value: '+52 555 111 2222' },
  ]);
  const [sendingCollisionAlert, setSendingCollisionAlert] = useState(false);

  const impactDetected = telemetry.magnitudG >= impactThreshold;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('crash-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!sensorConnected) {
      toast.warning('Sensor HC-05 desconectado. Revisando telemetría...');
    }
  }, [sensorConnected]);

  useEffect(() => {
    if (impactDetected) {
      toast.error(`Impacto detectado: ${telemetry.magnitudG.toFixed(2)}G`);
    }
  }, [impactDetected, telemetry.magnitudG]);

  const handleSimulateBluetoothPayload = () => {
    const simulatedLines = [
      '0.02,0.01,0.99,11,-6,4,0.99\n',
      '0.10,0.24,1.23,78,-31,49,1.26\n',
      '0.94,1.72,4.82,411,-362,508,5.21\n',
    ].join('');

    parseTelemetryStream(simulatedLines);
    toast.success('Stream CSV parseado correctamente (HC-05 demo).');
  };

  const handleSendCollisionAlert = async () => {
    setSendingCollisionAlert(true);
    try {
      await axios.post(
        `${API_URL}/api/notifications/collision`,
        {
          phone: user?.phone || emergencyContacts[1].value,
          telemetry,
          threshold: impactThreshold,
        },
        { withCredentials: true },
      );
      toast.success('Alerta de colisión enviada por WhatsApp.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo enviar la alerta de colisión.');
    } finally {
      setSendingCollisionAlert(false);
    }
  };

  const telemetryRows = useMemo(
    () => [
      { label: 'xG', value: telemetry.xG.toFixed(2) },
      { label: 'yG', value: telemetry.yG.toFixed(2) },
      { label: 'zG', value: telemetry.zG.toFixed(2) },
      { label: 'gx', value: telemetry.gx.toFixed(0) },
      { label: 'gy', value: telemetry.gy.toFixed(0) },
      { label: 'gz', value: telemetry.gz.toFixed(0) },
    ],
    [telemetry],
  );

  return (
    <div className="min-h-screen crash-page-bg p-4 md:p-8">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="glass-card p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">CRASH Safety</p>
            <h1 className="text-3xl md:text-4xl font-black">Panel Ultra-Premium</h1>
            <p className="text-white/70 mt-2">Estado actual de seguridad vial y telemetría en tiempo real.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="glass-chip" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} type="button">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <button className="glass-chip" onClick={handleSimulateBluetoothPayload} type="button">
              <Bluetooth size={16} /> Simular CSV
            </button>
            <button className="glass-chip" onClick={logout} type="button">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-6 auto-rows-[minmax(120px,auto)]">
          <BentoCard className="md:col-span-4" alert={!sensorConnected || impactDetected}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-2xl">Telemetría</h2>
              <span className={`rounded-full px-3 py-1 text-xs ${sensorConnected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                {sensorConnected ? 'Sensor conectado' : 'Sensor desconectado'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {telemetryRows.map((item) => (
                <div key={item.label} className="glass-mini-card">
                  <p className="mini-kicker uppercase">{item.label}</p>
                  <p className="mini-main">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className={`text-5xl font-black tracking-tight ${impactDetected ? 'text-red-300 impact-glow' : 'text-cyan-300'}`}>
                G: {telemetry.magnitudG.toFixed(2)}
              </p>
              <p className="text-white/65 mt-2 text-sm">Raw: {telemetry.raw || 'Sin datos aún'}</p>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-2">
            <h2 className="font-bold text-2xl mb-4">Perfil</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/80"><UserRound size={16} /> {user?.name || 'Operador'}</div>
              <div className="text-white/65">{user?.email}</div>
              <div className="text-white/65">WhatsApp: {user?.phone || 'No configurado'}</div>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-3">
            <div className="flex items-center gap-2 mb-3"><Activity size={18} /><h2 className="font-bold text-xl">Detección de colisión</h2></div>
            <label className="text-sm text-white/70">Umbral actual: {impactThreshold.toFixed(1)}G</label>
            <input
              type="range"
              min="2"
              max="12"
              step="0.1"
              value={impactThreshold}
              onChange={(e) => setImpactThreshold(Number.parseFloat(e.target.value))}
              className="w-full mt-2"
            />
            <button
              type="button"
              disabled={sendingCollisionAlert || !impactDetected}
              className="premium-button w-full mt-4 disabled:opacity-50"
              onClick={handleSendCollisionAlert}
            >
              {sendingCollisionAlert ? 'Enviando...' : 'Enviar alerta crash_collision_diagnosis'}
            </button>
          </BentoCard>

          <BentoCard className="md:col-span-3">
            <div className="flex items-center gap-2 mb-3"><UsersRound size={18} /><h2 className="font-bold text-xl">Contactos de emergencia</h2></div>
            <div className="space-y-2">
              {emergencyContacts.map((contact) => (
                <div key={contact.name} className="glass-mini-card flex items-center justify-between">
                  <div>
                    <p className="mini-main text-base">{contact.name}</p>
                    <p className="mini-kicker">{contact.channel}</p>
                  </div>
                  <span className="text-sm text-white/70">{contact.value}</span>
                </div>
              ))}
            </div>
          </BentoCard>
        </section>

        {impactDetected && (
          <div className="glass-card p-4 border border-red-400/70 flex items-center gap-2 text-red-200">
            <AlertTriangle size={18} /> Impacto sobre umbral detectado. Se recomienda iniciar protocolo de emergencia.
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => (
  <TelemetryProvider>
    <DashboardContent />
  </TelemetryProvider>
);

export default DashboardPage;
