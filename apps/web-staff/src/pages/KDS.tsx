import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Beer, Check, CheckCircle2, ChefHat, ClipboardList, Martini, Play } from 'lucide-react';
import { api, getToken } from '../lib/api';
import { useAuth } from '../auth';

const COLS = [
  { key: 'RECIBIDO', label: 'Recibidos', color: 'var(--bad)', cls: 'r' },
  { key: 'EN_PREPARACION', label: 'En preparación', color: 'var(--warn)', cls: 'p' },
  { key: 'LISTO', label: 'Listos', color: 'var(--ok)', cls: 'l' },
];

const ESTACION_LABEL: Record<string, string> = {
  BARRA: 'Barra',
  BARMAN: 'Coctelería',
  COCINA: 'Cocina',
};

export default function KDS() {
  const { user } = useAuth();
  const esBarman = user?.role === 'BARMAN';
  const esCocina = user?.role === 'COCINA';
  const esBarra = user?.role === 'BARRA';
  const filtraEstacion = esBarman || esCocina || esBarra;
  const miEstacion = esBarman ? 'BARMAN' : esCocina ? 'COCINA' : 'BARRA';

  const [pedidos, setPedidos] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/pedidos').then(setPedidos).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
    const socket = io('/ws', { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on('connect', () => {
      const tenantId = user?.tenantActivoId ?? user?.tenantId;
      if (tenantId) socket.emit('join-tenant', { tenantId });
    });
    socket.on('pedido:nuevo', cargar);
    socket.on('pedido:actualizado', cargar);
    return () => {
      socket.disconnect();
    };
  }, [cargar, user]);

  const filtrados = useMemo(() => {
    if (!filtraEstacion) return pedidos;
    return pedidos
      .map((p) => ({
        ...p,
        detalles: (p.detalles || []).filter((d: any) => d.producto?.estacion === miEstacion),
      }))
      .filter((p) => p.detalles.length > 0);
  }, [pedidos, filtraEstacion, miEstacion]);

  async function cambiarEstado(id: string, estado: string) {
    await api(`/pedidos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  const titulo = esBarman ? 'Coctelería' : esCocina ? 'Cocina' : esBarra ? 'Barra' : 'Pedidos';
  const subtitulo = esBarman
    ? 'Solo preparas cocteles'
    : esCocina
      ? 'Solo preparas comida'
      : esBarra
        ? 'Atiendes las demás bebidas'
        : 'Todas las estaciones: barra, coctelería y cocina';
  const Icono = esBarman ? Martini : esCocina ? ChefHat : esBarra ? Beer : ClipboardList;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icono size={22} color="#f5b301" /> {titulo} — KDS
          </h1>
          <div className="sub">{subtitulo}</div>
        </div>
        <span className="pill ok">● Conectado</span>
      </div>

      <div className="kds-cols">
        {COLS.map((col) => {
          const items = filtrados.filter((p) => p.estado === col.key);
          return (
            <div className="kds-col" key={col.key}>
              <h3>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                {col.label}
                <span className="pill mute">{items.length}</span>
              </h3>
              {items.map((p) => (
                <div className={`kds-card ${col.cls}`} key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="kds-code">{p.codigo}</span>
                  </div>
                  <div className="kds-meta">
                    {p.mesa?.nombre} · {p.mesa?.zona?.nombre} ·{' '}
                    {p.modo === 'MESA' ? 'Servicio a mesa' : 'Pick-up'}
                  </div>
                  <div style={{ fontSize: 13, margin: '6px 0' }}>
                    {p.detalles.map((d: any) => (
                      <div key={d.id}>
                        • {d.cantidad}x {d.producto?.nombre}
                        {!filtraEstacion && d.producto?.estacion && (
                          <span className="pill mute" style={{ marginLeft: 6, fontSize: 9 }}>
                            {ESTACION_LABEL[d.producto.estacion] || d.producto.estacion}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {col.key === 'RECIBIDO' && (
                    <button className="btn primary block" onClick={() => cambiarEstado(p.id, 'EN_PREPARACION')}>
                      <Play size={15} /> Preparar
                    </button>
                  )}
                  {col.key === 'EN_PREPARACION' && (
                    <button className="btn block" onClick={() => cambiarEstado(p.id, 'LISTO')}>
                      <Check size={15} /> Marcar listo
                    </button>
                  )}
                  {col.key === 'LISTO' && (
                    <button className="btn block" onClick={() => cambiarEstado(p.id, 'ENTREGADO')}>
                      <CheckCircle2 size={15} /> Confirmar entrega (PIN {p.pin})
                    </button>
                  )}
                </div>
              ))}
              {items.length === 0 && <div className="sub">Sin pedidos</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
