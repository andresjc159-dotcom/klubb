import { useEffect, useState } from 'react';
import { Armchair, Flame, MapPin, Package, Power, Receipt, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth';

interface Counts {
  productos: number;
  mesas: number;
  zonas: number;
  pedidos: number;
}

export default function Dashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const puedeAbrirCerrar = user?.role === 'ADMIN' || user?.role === 'MASTER';
  const [counts, setCounts] = useState<Counts | null>(null);
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [abierto, setAbierto] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [p, m, z, pe, est] = await Promise.all([
        api<any[]>('/productos'),
        api<any[]>('/mesas'),
        api<any[]>('/zonas'),
        api<any[]>('/pedidos'),
        api<{ abierto: boolean }>('/local/estado'),
      ]);
      setCounts({ productos: p.length, mesas: m.length, zonas: z.length, pedidos: pe.length });
      setProductos(p);
      setPedidos(pe);
      setAbierto(est.abierto);
    })().catch(console.error);
  }, []);

  async function toggleLocal() {
    try {
      await api(abierto ? '/local/cerrar' : '/local/abrir', { method: 'POST' });
      setAbierto(!abierto);
      toast(abierto ? 'Local cerrado' : 'Local abierto', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  const stats: Array<{ label: string; val: string | number; Icon: LucideIcon; bg: string; color: string }> = [
    { label: 'Productos', val: counts?.productos ?? '—', Icon: Package, bg: 'rgba(245,179,1,.14)', color: '#f5b301' },
    { label: 'Mesas', val: counts?.mesas ?? '—', Icon: Armchair, bg: 'rgba(56,189,248,.14)', color: '#38bdf8' },
    { label: 'Zonas', val: counts?.zonas ?? '—', Icon: MapPin, bg: 'rgba(167,139,250,.14)', color: '#a78bfa' },
    { label: 'Pedidos activos', val: counts?.pedidos ?? '—', Icon: Flame, bg: 'rgba(239,68,68,.14)', color: '#f87171' },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Panel general</h1>
          <div className="sub">Resumen de tu local en tiempo real</div>
        </div>
      </div>

      {puedeAbrirCerrar && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stat-icon" style={{ background: abierto ? 'rgba(46,204,113,.14)' : 'rgba(239,68,68,.14)' }}>
              <Power size={20} color={abierto ? '#4ade80' : '#f87171'} />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{abierto ? 'Local abierto' : 'Local cerrado'}</div>
              <div className="sub" style={{ marginTop: 2 }}>
                {abierto
                  ? 'Meseros y clientes pueden operar con normalidad.'
                  : 'Meseros y clientes no pueden entrar ni pedir hasta que lo abras.'}
              </div>
            </div>
          </div>
          <button className={`btn ${abierto ? 'danger' : 'primary'}`} onClick={toggleLocal}>
            <Power size={16} /> {abierto ? 'Cerrar local' : 'Abrir local'}
          </button>
        </div>
      )}

      <div className="grid cols-4">
        {stats.map((s) => (
          <div className="card hover stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.bg }}>
              <s.Icon size={22} color={s.color} />
            </div>
            <div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Inventario y stock</h3>
          {productos.slice(0, 6).map((p) => {
            const pct = Math.min(100, Math.round((p.stock / Math.max(p.stock + p.stockMinimo, 1)) * 100));
            const estado = p.stock === 0 ? 'bad' : p.stock <= p.stockMinimo ? 'warn' : 'ok';
            return (
              <div className="list-item" key={p.id}>
                <div className="emoji-tile">
                  {p.imagenUrl ? (
                    <img src={p.imagenUrl} alt={p.nombre} style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'cover' }} />
                  ) : (
                    p.emoji || '🍸'
                  )}
                </div>
                <div className="body">
                  <div className="title">{p.nombre}</div>
                  <div className="bar" style={{ marginTop: 8 }}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className={`pill ${estado}`}>Stock {p.stock}</span>
              </div>
            );
          })}
          {productos.length === 0 && <div className="sub">Sin productos aún.</div>}
        </div>

        <div className="card">
          <h3>Pedidos recientes</h3>
          {pedidos.slice(0, 6).map((p) => (
            <div className="list-item" key={p.id}>
              <div className="emoji-tile"><Receipt size={18} color="#8b95a6" /></div>
              <div className="body">
                <div className="title">
                  {p.codigo} · {p.mesa?.nombre}
                </div>
                <div className="meta">
                  {p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(', ')}
                </div>
              </div>
              <span className={`pill ${p.estado === 'LISTO' ? 'ok' : p.estado === 'RECIBIDO' ? 'bad' : 'warn'}`}>
                {p.estado.replaceAll('_', ' ').toLowerCase()}
              </span>
            </div>
          ))}
          {pedidos.length === 0 && <div className="sub">Sin pedidos activos.</div>}
        </div>
      </div>
    </div>
  );
}
