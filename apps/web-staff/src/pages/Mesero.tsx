import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Armchair,
  Ban,
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Pause,
  Play,
  Square,
  Wallet,
} from 'lucide-react';
import { api, getToken } from '../lib/api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { METODO_LABEL, METODOS_TODOS } from '../lib/metodos';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

export default function Mesero() {
  const { user } = useAuth();
  const toast = useToast();
  const [enTurno, setEnTurno] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mesas, setMesas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [llamado, setLlamado] = useState<any>(null);
  const [pedidoListo, setPedidoListo] = useState<any>(null);
  const [solicitudPago, setSolicitudPago] = useState<any>(null);
  const [cobrarModal, setCobrarModal] = useState<any>(null);
  const [cobrarMetodo, setCobrarMetodo] = useState('EFECTIVO');
  const didAct = useRef(false);

  const cargar = useCallback(async () => {
    const [m, p] = await Promise.all([api<any[]>('/mis-mesas'), api<any[]>('/pedidos')]);
    setMesas(m);
    setPedidos(p);
  }, []);

  useEffect(() => {
    if (!user?.userId) return;
    const socket = io('/ws', { auth: { token: getToken() } });
    socket.on('connect', () => {
      socket.emit('join-user', { userId: user.userId });
      const tenantId = user?.tenantActivoId ?? user?.tenantId;
      if (tenantId) socket.emit('join-tenant', { tenantId });
    });
    socket.on('pedido:nuevo', cargar);
    socket.on('pedido:actualizado', cargar);
    socket.on('llamado:mesa', (data: any) => {
      try {
        navigator.vibrate?.([300, 100, 300]);
      } catch {}
      setLlamado(data);
    });
    socket.on('pedido:listo', (data: any) => {
      try {
        navigator.vibrate?.([300, 100, 300]);
      } catch {}
      setPedidoListo(data);
      cargar();
    });
    socket.on('solicitud:pago', (data: any) => {
      try {
        navigator.vibrate?.([300, 100, 300]);
      } catch {}
      setSolicitudPago(data);
    });
    return () => {
      socket.disconnect();
    };
  }, [user, cargar]);

  useEffect(() => {
    cargar();
    api<any[]>('/staff')
      .then((staff) => {
        if (didAct.current) return;
        const yo = staff.find((s) => s.id === user?.userId);
        if (yo) {
          setEnTurno(yo.enTurno);
          setOcupado(yo.ocupado);
        }
      })
      .catch(console.error);
  }, [cargar, user]);

  const misPedidos = useMemo(() => pedidos.filter((p) => p.meseroId === user?.userId), [pedidos, user]);
  const listos = useMemo(() => misPedidos.filter((p) => p.estado === 'LISTO'), [misPedidos]);
  const enPreparacion = useMemo(
    () => misPedidos.filter((p) => (p.estado === 'RECIBIDO' || p.estado === 'EN_PREPARACION') && !p.pagadoEn),
    [misPedidos],
  );

  const porZona = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const m of mesas) {
      const key = m.zona?.nombre || 'Sin zona';
      (map[key] = map[key] || []).push(m);
    }
    return map;
  }, [mesas]);

  async function iniciarTurno() {
    try {
      const u = await api('/staff/turno/iniciar', { method: 'POST' });
      didAct.current = true;
      setEnTurno(u.enTurno);
      setOcupado(u.ocupado);
      toast('Turno iniciado', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function finalizarTurno() {
    try {
      const u = await api('/staff/turno/finalizar', { method: 'POST' });
      didAct.current = true;
      setEnTurno(u.enTurno);
      setOcupado(u.ocupado);
      toast('Turno finalizado', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function toggleOcupado() {
    try {
      const u = await api('/staff/ocupado', { method: 'PATCH', body: JSON.stringify({ ocupado: !ocupado }) });
      didAct.current = true;
      setOcupado(u.ocupado);
      toast(u.ocupado ? 'Marcado como ocupado' : 'Marcado como libre', 'ok');
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function cambiarEstadoMesa(id: string, estado: string) {
    try {
      await api(`/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
      toast('Mesa actualizada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function cancelarPedido(id: string) {
    if (!window.confirm('¿Cancelar este pedido?')) return;
    try {
      await api(`/pedidos/${id}/cancelar`, { method: 'PATCH' });
      toast('Pedido cancelado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function marcarPagado(id: string) {
    try {
      await api(`/pedidos/${id}/pagar`, { method: 'PATCH', body: JSON.stringify({}) });
      toast('Pedido marcado como pagado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function marcarEntregado(id: string) {
    try {
      await api(`/pedidos/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: 'ENTREGADO' }) });
      toast('Pedido entregado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  const totalPendienteMesa = (mesaId: string) => {
    return pedidos
      .filter((p) => p.mesaId === mesaId && !p.pagadoEn && p.estado !== 'CANCELADO')
      .reduce((s, p) => s + p.total, 0);
  };

  const pedidosPendientesMesa = (mesaId: string) => {
    return pedidos.filter((p) => p.mesaId === mesaId && !p.pagadoEn && p.estado !== 'CANCELADO');
  };

  async function cobrarMesa() {
    if (!cobrarModal) return;
    try {
      await api('/pedidos/pagar-mesa', {
        method: 'POST',
        body: JSON.stringify({ mesaId: cobrarModal.id, metodoPago: cobrarMetodo }),
      });
      toast('Mesa cobrada', 'ok');
      setCobrarModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Mi turno</h1>
          <div className="sub">{user?.nombre}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className={`pill ${enTurno ? 'ok' : 'mute'}`}>{enTurno ? 'En turno' : 'Fuera de turno'}</span>
          <span className={`pill ${ocupado ? 'warn' : 'ok'}`}>{ocupado ? 'Ocupado' : 'Libre'}</span>
          {!enTurno ? (
            <button className="btn primary" onClick={iniciarTurno}><Play size={16} /> Iniciar turno</button>
          ) : (
            <>
              <button className="btn" onClick={toggleOcupado}>
                {ocupado ? <Check size={16} /> : <Pause size={16} />} {ocupado ? 'Libre' : 'Ocupado'}
              </button>
              <button className="btn danger" onClick={finalizarTurno}><Square size={16} /> Finalizar turno</button>
            </>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card hover stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}><Armchair size={22} color="#f5b301" /></div>
          <div>
            <div className="stat-val">{mesas.length}</div>
            <div className="stat-label">Mis mesas asignadas</div>
          </div>
        </div>
        <div className="card hover stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56,189,248,.14)' }}><ClipboardList size={22} color="#38bdf8" /></div>
          <div>
            <div className="stat-val">{misPedidos.length}</div>
            <div className="stat-label">Mis pedidos activos</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Control de mesas</h3>
        {Object.entries(porZona).map(([zona, ms]) => (
          <div key={zona} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="#8b95a6" /> {zona}
            </div>
            <div className="mesa-grid">
              {ms.map((m) => (
                <div className={`mesa ${m.estado.toLowerCase()}`} key={m.id}>
                  <div className="num">{m.nombre}</div>
                  <div className="estado">
                    <span className={`pill ${m.estado === 'LIBRE' ? 'ok' : m.estado === 'OCUPADA' ? 'warn' : 'info'}`}>
                      {m.estado.toLowerCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => cambiarEstadoMesa(m.id, 'OCUPADA')}>Ocupar</button>
                    <button className="btn sm" onClick={() => cambiarEstadoMesa(m.id, 'RESERVADA')}>Reservar</button>
                    <button className="btn sm" onClick={() => cambiarEstadoMesa(m.id, 'LIBRE')}>Liberar</button>
                  </div>
                  {totalPendienteMesa(m.id) > 0 && (
                    <button
                      className="btn primary sm"
                      style={{ marginTop: 8, width: '100%' }}
                      onClick={() => { setCobrarModal(m); setCobrarMetodo('EFECTIVO'); }}
                    >
                      Cobrar {fmt(totalPendienteMesa(m.id))}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: 'var(--ok)' }}>
        <h3>Listos para entregar <span className="pill ok">{listos.length}</span></h3>
        {listos.length === 0 && (
          <div className="sub">No hay pedidos listos para recoger.</div>
        )}
        {listos.map((p) => (
          <div className="list-item" key={p.id} style={{ borderColor: 'var(--ok)' }}>
            <div className="emoji-tile"><CheckCircle2 size={18} color="#4ade80" /></div>
            <div className="body">
              <div className="title">{p.codigo} · {p.mesa?.nombre}{p.apoyo && <span className="pill info" style={{ marginLeft: 6 }}>Apoyo</span>}</div>
              <div className="meta">{p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(', ')}</div>
            </div>
            <button className="btn primary sm" onClick={() => marcarEntregado(p.id)}>Entregar</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>En preparación <span className="pill mute">{enPreparacion.length}</span></h3>
        {enPreparacion.length === 0 && (
          <div className="sub">No tienes pedidos en preparación.</div>
        )}
        {enPreparacion.map((p) => (
          <div className="list-item" key={p.id}>
            <div className="emoji-tile"><ClipboardList size={18} color="#8b95a6" /></div>
            <div className="body">
              <div className="title">{p.codigo} · {p.mesa?.nombre}{p.apoyo && <span className="pill info" style={{ marginLeft: 6 }}>Apoyo</span>}</div>
              <div className="meta">{p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(', ')}</div>
              <div className="meta" style={{ marginTop: 4 }}>
                Pago: {METODO_LABEL[p.metodoPago] || p.metodoPago || '—'}
                <span className="pill warn" style={{ marginLeft: 6 }}>Por pagar</span>
              </div>
            </div>
            <span className={`pill ${p.estado === 'RECIBIDO' ? 'bad' : 'warn'}`}>
              {p.estado.replaceAll('_', ' ').toLowerCase()}
            </span>
            {p.estado === 'RECIBIDO' && (
              <button className="btn sm danger" title="Cancelar pedido" onClick={() => cancelarPedido(p.id)}>
                <Ban size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {llamado && (
        <div className="modal-bg" onClick={() => setLlamado(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div className="stat-icon" style={{ background: 'rgba(239,68,68,.14)', margin: '0 auto 10px', width: 56, height: 56 }}>
                <Bell size={26} color="#f87171" />
              </div>
              <h2>Te están llamando</h2>
              <div className="sub" style={{ fontSize: 15 }}>
                La mesa <b style={{ color: 'var(--accent)' }}>{llamado.mesa}</b> ({llamado.zona}) necesita atención.
              </div>
            </div>
            <button className="btn primary block" onClick={() => setLlamado(null)}>
              Atender
            </button>
          </div>
        </div>
      )}

      {pedidoListo && (
        <div className="modal-bg" onClick={() => setPedidoListo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div className="stat-icon" style={{ background: 'rgba(46,204,113,.14)', margin: '0 auto 10px', width: 56, height: 56 }}>
                <CheckCircle2 size={26} color="#4ade80" />
              </div>
              <h2>Pedido listo para entregar</h2>
              <div className="sub" style={{ fontSize: 15 }}>
                {pedidoListo.codigo} · Mesa {pedidoListo.mesa}
              </div>
              <div style={{ fontSize: 13, color: '#8b95a6', marginTop: 4 }}>
                {pedidoListo.detalles?.join(', ')}
              </div>
            </div>
            <button className="btn primary block" onClick={() => setPedidoListo(null)}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {solicitudPago && (
        <div className="modal-bg" onClick={() => setSolicitudPago(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)', margin: '0 auto 10px', width: 56, height: 56 }}>
                <Wallet size={26} color="#f5b301" />
              </div>
              <h2>Quieren pagar</h2>
              <div className="sub" style={{ fontSize: 15 }}>
                La mesa <b style={{ color: 'var(--accent)' }}>{solicitudPago.mesa}</b> ({solicitudPago.zona}) quiere pagar.
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
                Total: {fmt(solicitudPago.total)}
              </div>
            </div>
            <button className="btn primary block" onClick={() => setSolicitudPago(null)}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {cobrarModal && (
        <div className="modal-bg" onClick={() => setCobrarModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cobrar mesa {cobrarModal.nombre}</h2>
            <div className="sub">Productos a cobrar:</div>
            {pedidosPendientesMesa(cobrarModal.id).map((p) => (
              <div className="list-item" key={p.id} style={{ padding: 10 }}>
                <div className="body">
                  <div className="title">{p.codigo}</div>
                  <div className="meta">{p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(', ')}</div>
                </div>
                <span style={{ fontWeight: 700 }}>{fmt(p.total)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 16, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(totalPendienteMesa(cobrarModal.id))}</span>
            </div>
            <label>Medio de pago</label>
            <select value={cobrarMetodo} onChange={(e) => setCobrarMetodo(e.target.value)}>
              {METODOS_TODOS.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={cobrarMesa}>
              Confirmar cobro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
