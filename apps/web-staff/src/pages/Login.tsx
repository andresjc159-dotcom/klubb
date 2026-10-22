import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@klubb.app');
  const [password, setPassword] = useState('klubb123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(homeForRole(user.role));
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="logo-mark">K</div>
          <div>
            KLUB<span className="gold">B</span>
          </div>
        </div>
        <div className="sub" style={{ textAlign: 'center', marginBottom: 8 }}>
          Gestión de bares y discotecas
        </div>
        <label>Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && (
          <div className="pill bad" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}
        <button className="btn primary block" style={{ marginTop: 18 }} disabled={busy}>
          {busy ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
        <div className="sub" style={{ marginTop: 18, fontSize: 11 }}>
          admin@klubb.app · laura@klubb.app (mesero) · juan@klubb.app (barman)
          <br />
          contraseña: klubb123
        </div>
      </form>
    </div>
  );
}
