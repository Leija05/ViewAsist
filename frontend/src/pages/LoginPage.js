import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { AlertCircle, Moon, Sun } from 'lucide-react';

const MIN_PASSWORD_SCORE = 3;

const passwordRules = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'Una mayúscula', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'Un número', test: (v) => /\d/.test(v) },
  { key: 'symbol', label: 'Un símbolo', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const formatApiErrorDetail = (detail) => {
  if (detail == null) return 'Algo salió mal. Por favor intenta de nuevo.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register, verifyRegistrationOtp } = useAuth();

  const [mode, setMode] = useState('login');
  const [theme, setTheme] = useState(() => localStorage.getItem('crash-theme') || 'dark');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpPhone, setOtpPhone] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const passwordScore = useMemo(
    () => passwordRules.reduce((acc, r) => (r.test(registerPassword) ? acc + 1 : acc), 0),
    [registerPassword],
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('crash-theme', theme);
  }, [theme]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (registerPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (passwordScore < MIN_PASSWORD_SCORE) {
      setError('Tu contraseña no cumple la fortaleza mínima requerida.');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        name,
        email: registerEmail,
        phone,
        password: registerPassword,
        confirmPassword,
      });
      setOtpPhone(result.phone);
      setMode('otp');
      setSuccess('Cuenta creada. Te enviamos un token de verificación por WhatsApp.');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await verifyRegistrationOtp({ phone: otpPhone, otp });
      setSuccess('Número verificado correctamente.');
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen crash-page-bg px-4 py-6 md:py-8 text-[hsl(var(--foreground))]">
      <div className="mx-auto w-full max-w-6xl grid md:grid-cols-2 gap-6">
        <section className="glass-card p-6 md:p-8 flex flex-col justify-between min-h-[420px]">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">CRASH Safety</p>
                <h1 className="text-4xl font-black leading-tight mt-2">Ultra-Premium Security</h1>
              </div>
              <button
                className="glass-chip"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                type="button"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </button>
            </div>
            <p className="mt-6 text-white/70">
              Plataforma de seguridad vial con telemetría en tiempo real, detección de colisiones y alertas automatizadas por WhatsApp Cloud API.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-10">
            <article className="glass-mini-card">
              <p className="mini-kicker">Notificaciones</p>
              <p className="mini-main">OTP + Colisión</p>
            </article>
            <article className="glass-mini-card">
              <p className="mini-kicker">Parser MPU6050</p>
              <p className="mini-main">100ms Streaming</p>
            </article>
          </div>
        </section>

        <section className="glass-card p-6 md:p-8">
          <div className="flex gap-2 mb-6">
            {['login', 'register', 'otp'].map((item) => (
              <button
                key={item}
                type="button"
                className={`glass-tab ${mode === item ? 'active' : ''}`}
                onClick={() => setMode(item)}
              >
                {item === 'login' ? 'Iniciar sesión' : item === 'register' ? 'Registro' : 'Verificar OTP'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm">{success}</div>}

          {mode === 'login' && (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <Label htmlFor="email">Correo</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="premium-input" />
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
                <Label htmlFor="remember">Mantener sesión iniciada</Label>
              </div>
              <Button disabled={loading} className="w-full premium-button" type="submit">{loading ? 'Ingresando...' : 'Entrar'}</Button>
            </form>
          )}

          {mode === 'register' && (
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="registerEmail">Correo</Label>
                <Input id="registerEmail" type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp (+52...)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="registerPassword">Contraseña</Label>
                <Input id="registerPassword" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="premium-input" />
              </div>
              <ul className="text-xs text-white/60 space-y-1">
                {passwordRules.map((rule) => (
                  <li key={rule.key} className={rule.test(registerPassword) ? 'text-emerald-300' : ''}>{rule.label}</li>
                ))}
              </ul>
              <Button disabled={loading} className="w-full premium-button" type="submit">{loading ? 'Registrando...' : 'Crear cuenta y enviar OTP'}</Button>
            </form>
          )}

          {mode === 'otp' && (
            <form className="space-y-4" onSubmit={handleOtpSubmit}>
              <div>
                <Label htmlFor="otpPhone">Número de WhatsApp</Label>
                <Input id="otpPhone" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} required className="premium-input" />
              </div>
              <div>
                <Label htmlFor="otp">Token OTP</Label>
                <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} required className="premium-input" />
              </div>
              <Button disabled={loading} className="w-full premium-button" type="submit">{loading ? 'Validando...' : 'Verificar y continuar'}</Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
