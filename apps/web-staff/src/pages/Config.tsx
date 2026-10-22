import { useCallback, useEffect, useState } from 'react';
import { Save, Store } from 'lucide-react';
import { api, getToken } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Config() {
  const toast = useToast();
  const [form, setForm] = useState<{ nombre: string; mensajeBienvenida: string; direccion: string }>({
    nombre: '',
    mensajeBienvenida: '',
    direccion: '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<{ nombre: string; mensajeBienvenida?: string; direccion?: string; logoUrl?: string }>('/local/config')
      .then((c) => {
        setForm({
          nombre: c.nombre || '',
          mensajeBienvenida: c.mensajeBienvenida || '',
          direccion: c.direccion || '',
        });
        setLogoUrl(c.logoUrl || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    try {
      await api('/local/config', { method: 'PATCH', body: JSON.stringify(form) });
      toast('Configuración guardada', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function subirLogo(file: File) {
    const token = getToken();
    const data = new FormData();
    data.append('logo', file);
    try {
      const res = await fetch('/api/local/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      if (!res.ok) throw new Error('Error al subir el logo');
      const r = await res.json();
      setLogoUrl(r.logoUrl);
      toast('Logo actualizado', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Store size={22} color="#f5b301" /> Configuración del local
          </h1>
          <div className="sub">Identidad de marca que verá el cliente al escanear el QR</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Logo e identidad</h3>
          <div className="stat-icon" style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, #f5b301, #7a5b00)', fontSize: 28, marginBottom: 14 }}>
            {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover' }} /> : 'K'}
          </div>
          <label className="btn sm" style={{ cursor: 'pointer', width: 'auto' }}>
            Subir logo
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />
          </label>
        </div>

        <div className="card">
          <h3>Información del local</h3>
          <label>Nombre del local</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="La Noche Bar" />
          <label>Mensaje de bienvenida (al escanear QR)</label>
          <input value={form.mensajeBienvenida} onChange={(e) => setForm({ ...form, mensajeBienvenida: e.target.value })} placeholder="¡Bienvenido!" />
          <label>Dirección</label>
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Medellín" />
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
