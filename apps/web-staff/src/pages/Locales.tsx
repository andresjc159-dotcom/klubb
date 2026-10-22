import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, MapPin, Pencil, Plus, Receipt, Store, Trash2, TrendingUp } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { useToast } from '../components/Toast';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export default function Locales() {
  const toast = useToast();
  const navigate = useNavigate();
  const [locales, setLocales] = useState<any[]>([]);
  const [consolidado, setConsolidado] = useState<any>(null);
  const [form, setForm] = useState<{ id?: string; nombre: string; direccion: string; mensajeBienvenida: string } | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/locales').then(setLocales).catch(console.error);
    api<any>('/locales/consolidado').then(setConsolidado).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function entrar(id: string) {
    try {
      const data = await api<{ access_token: string }>(`/locales/${id}/entrar`, { method: 'POST' });
      setToken(data.access_token);
      window.location.href = '/';
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardar() {
    if (!form?.nombre.trim()) return;
    try {
      if (form.id) {
        await api(`/locales/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre: form.nombre, direccion: form.direccion, mensajeBienvenida: form.mensajeBienvenida }),
        });
        toast('Local actualizado', 'ok');
      } else {
        await api('/locales', { method: 'POST', body: JSON.stringify({ nombre: form.nombre, direccion: form.direccion }) });
        toast('Local creado', 'ok');
      }
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción borra todo el local.`)) return;
    try {
      await api(`/locales/${id}`, { method: 'DELETE' });
      toast('Local eliminado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Mis locales</h1>
          <div className="sub">Gestiona todos tus bares desde aquí</div>
        </div>
        <button className="btn primary" onClick={() => setForm({ nombre: '', direccion: '', mensajeBienvenida: '' })}>
          <Plus size={16} /> Nuevo local
        </button>
      </div>

      {consolidado && (
        <>
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(46,204,113,.14)' }}><TrendingUp size={22} color="#4ade80" /></div>
              <div>
                <div className="stat-val" style={{ color: '#4ade80' }}>{fmt(consolidado.totalVentas)}</div>
                <div className="stat-label">Ventas totales (todos los locales)</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(56,189,248,.14)' }}><Receipt size={22} color="#38bdf8" /></div>
              <div>
                <div className="stat-val">{consolidado.totalPedidos}</div>
                <div className="stat-label">Pedidos totales</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(167,139,250,.14)' }}><Store size={22} color="#a78bfa" /></div>
              <div>
                <div className="stat-val">{consolidado.totalLocales}</div>
                <div className="stat-label">Locales</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Comparativa por local</h3>
            {consolidado.porLocal.map((l: any) => (
              <div className="list-item" key={l.id}>
                <div className="emoji-tile"><Store size={18} color="#8b95a6" /></div>
                <div className="body">
                  <div className="title">{l.nombre}</div>
                  <div className="meta">{l.pedidos} pedidos · {l.mesas} mesas</div>
                </div>
                <span style={{ fontWeight: 700 }}>{fmt(l.ventas)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid cols-2">
        {locales.map((l) => (
          <div className="card hover" key={l.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}>
                <Store size={22} color="#f5b301" />
              </div>
              <div>
                <div className="title" style={{ fontSize: 16, fontWeight: 700 }}>{l.nombre}</div>
                {l.direccion && (
                  <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={12} /> {l.direccion}
                  </div>
                )}
              </div>
              <span className={`pill ${l.abierto ? 'ok' : 'mute'}`} style={{ marginLeft: 'auto' }}>
                {l.abierto ? 'Abierto' : 'Cerrado'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8b95a6', marginBottom: 14 }}>
              <span>🪑 {l._count.mesas} mesas</span>
              <span>🍹 {l._count.productos} productos</span>
              <span>🙋 {l._count.usuarios} staff</span>
              <span>🧾 {l._count.pedidos} pedidos</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={() => entrar(l.id)}>
                <LogIn size={16} /> Entrar
              </button>
              <button className="btn" onClick={() => setForm({ id: l.id, nombre: l.nombre, direccion: l.direccion || '', mensajeBienvenida: l.mensajeBienvenida || '' })}>
                <Pencil size={15} />
              </button>
              <button className="btn danger" onClick={() => eliminar(l.id, l.nombre)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {locales.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
            <div className="sub">Crea tu primer local para empezar.</div>
          </div>
        )}
      </div>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <h2>{form.id ? 'Editar local' : 'Nuevo local'}</h2>
          <label>Nombre</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Bar La Noche" autoFocus />
          <label>Dirección</label>
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Medellín" />
          {form.id && (
            <>
              <label>Mensaje de bienvenida</label>
              <input value={form.mensajeBienvenida} onChange={(e) => setForm({ ...form, mensajeBienvenida: e.target.value })} placeholder="¡Bienvenido!" />
            </>
          )}
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>
            Guardar
          </button>
        </Modal>
      )}
    </div>
  );
}
