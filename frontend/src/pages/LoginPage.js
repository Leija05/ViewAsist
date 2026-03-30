import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import AppLogo from '../components/AppLogo';

const formatApiErrorDetail = (detail) => {
  if (detail == null) return "Algo salió mal. Por favor intenta de nuevo.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white text-zinc-900">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Title */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-14 h-14 bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                <AppLogo className="w-9 h-9" animated />
              </div>
              <h1 className="text-3xl font-black tracking-tight">ASISTENCIA</h1>
            </div>
            <p className="text-sm text-zinc-500 uppercase tracking-widest">
              Sistema de Control de Asistencia
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div 
                data-testid="login-error"
                className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 text-red-700"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-widest font-semibold">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@empresa.com"
                required
                className="h-12 border-2 border-zinc-200 focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-widest font-semibold">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 border-2 border-zinc-200 focus:border-black transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                data-testid="login-remember-checkbox"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
              />
              <Label htmlFor="remember" className="text-sm text-zinc-600 cursor-pointer">
                Mantener sesión iniciada
              </Label>
            </div>

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-semibold uppercase tracking-widest transition-all duration-150"
            >
              {loading ? (
                <div className="loader border-white border-t-transparent" />
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-zinc-400">
            Sistema exclusivo para administradores
          </p>
        </div>
      </div>

      {/* Right Panel - Background Image */}
      <div 
        className="hidden lg:block lg:w-1/2 login-bg relative"
        style={{
          backgroundImage: "url('https://static.prod-images.emergentagent.com/jobs/edcfcb89-ea1e-4a24-9005-fb174fda6ddc/images/1d79a7c2a964afb0e3a526c559e032300a4b0ce7fb5efed4ec7ae669ca82d1f5.png')"
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Control Total de Asistencia</h2>
          <p className="text-sm text-white/80">
            Gestiona faltas, retardos y reportes de tu equipo de trabajo de manera eficiente.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
