import { useCallback, useEffect, useState } from 'react';
import { Save, Store, Users } from 'lucide-react';
import { api, getToken } from '../lib/api';
import { useToast } from '../components/Toast';

const PRESETS = [
  '#f5b301',
  '#ff9d2e',
  '#ff6b35',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#22c55e',
  '#14b8a6',
  '#ffffff',
];

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: value,
            boxShadow: `0 0 22px ${value}66, 0 0 6px ${value}44`,
            border: '1px solid rgba(255,255,255,.15)',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: value === c ? '2px solid #fff' : '2px solid rgba(255,255,255,.12)',
                boxShadow: value === c ? `0 0 10px ${c}` : undefined,
                cursor: 'pointer',
                transition: 'transform .15s',
              }}
            />
          ))}
          <label
            title="Color personalizado"
            style={{
              position: 'relative',
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2px dashed rgba(255,255,255,.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 14, color: '#8b95a6', lineHeight: 1 }}>+</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
          </label>
        </div>
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#f5b301" style={{ marginTop: 10, textTransform: 'uppercase' }} />
    </div>
  );
}

export default function Config() {
  const toast = useToast();
  const [form, setForm] = useState<{ nombre: string; mensajeBienvenida: string; direccion: string; colorPrimario: string; colorMarca: string; apoyoHabilitado: boolean; umbralApoyo: string }>({
    nombre: '',
    mensajeBienvenida: '',
    direccion: '',
    colorPrimario: '#f5b301',
    colorMarca: '#ffffff',
    apoyoHabilitado: true,
    umbralApoyo: '5',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<{ nombre: string; mensajeBienvenida?: string; direccion?: string; logoUrl?: string; colorPrimario?: string; colorMarca?: string; apoyoHabilitado?: boolean; umbralApoyo?: number }>('/local/config')
      .then((c) => {
        setForm({
          nombre: c.nombre || '',
          mensajeBienvenida: c.mensajeBienvenida || '',
          direccion: c.direccion || '',
          colorPrimario: c.colorPrimario || '#f5b301',
          colorMarca: c.colorMarca || '#ffffff',
          apoyoHabilitado: c.apoyoHabilitado ?? true,
          umbralApoyo: String(c.umbralApoyo ?? 5),
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
      await api('/local/config', {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: form.nombre,
          mensajeBienvenida: form.mensajeBienvenida,
          direccion: form.direccion,
          colorPrimario: form.colorPrimario,
          colorMarca: form.colorMarca,
          apoyoHabilitado: form.apoyoHabilitado,
          umbralApoyo: Number(form.umbralApoyo),
        }),
      });
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
          <ColorPicker label="Color principal (botones y acentos)" value={form.colorPrimario} onChange={(c) => setForm({ ...form, colorPrimario: c })} />
          <ColorPicker label="Color del nombre (letras)" value={form.colorMarca} onChange={(c) => setForm({ ...form, colorMarca: c })} />
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="stat-icon" style={{ background: 'rgba(56,189,248,.14)' }}>
            <Users size={20} color="#38bdf8" />
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Apoyo entre zonas</h3>
            <div className="sub" style={{ marginTop: 0 }}>Balanceo automático de meseros</div>
          </div>
        </div>

        <div className="sub" style={{ marginBottom: 16, lineHeight: 1.7 }}>
          Cuando una zona está muy ocupada, el sistema redirige los pedidos nuevos al mesero en turno menos ocupado (aunque sea de otra zona), para equilibrar la carga. Los llamados siempre van al mesero titular de la mesa.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.18)', borderRadius: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Activar apoyo automático</div>
            <div className="meta">Meseros de zonas tranquilas ayudan en zonas ocupadas</div>
          </div>
          <button
            className={`pill ${form.apoyoHabilitado ? 'ok' : 'mute'}`}
            style={{ cursor: 'pointer', padding: '8px 16px', border: 'none', fontSize: 13 }}
            onClick={() => setForm({ ...form, apoyoHabilitado: !form.apoyoHabilitado })}
          >
            {form.apoyoHabilitado ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        <label>Diferencia de pedidos activos para redirigir (umbral)</label>
        <input type="number" min={1} value={form.umbralApoyo} onChange={(e) => setForm({ ...form, umbralApoyo: e.target.value })} placeholder="5" />
        <div className="sub" style={{ marginTop: 6 }}>
          Ejemplo: con umbral 5, si un mesero tiene 5 o más pedidos activos que otro, el siguiente pedido se asigna al menos ocupado (marcado como "Apoyo").
        </div>

        <button className="btn primary" style={{ marginTop: 16 }} onClick={guardar}>
          <Save size={16} /> Guardar
        </button>
      </div>
    </div>
  );
}
