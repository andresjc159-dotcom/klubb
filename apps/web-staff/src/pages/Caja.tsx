import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  HandCoins,
  Receipt,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth';
import { METODO_LABEL, METODOS_TODOS } from '../lib/metodos';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');
const fecha = (s?: string) => (s ? new Date(s).toLocaleString('es-CO') : '—');

export default function Caja() {
  const toast = useToast();
  const { user } = useAuth();
  const puedeConfigurar = user?.role === 'ADMIN' || user?.role === 'MASTER';
  const [actual, setActual] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [cierreModal, setCierreModal] = useState<any>(null);
  const [base, setBase] = useState('300000');
  const [metodos, setMetodos] = useState<string[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [meseros, setMeseros] = useState<any[]>([]);
  const [pagoModal, setPagoModal] = useState<any>(null);
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO');
  const [movForm, setMovForm] = useState<{ tipo: string; monto: string; concepto: string; productoId: string; cantidad: string; metodo: string } | null>(null);

  const cargarMetodos = useCallback(() => {
    if (!puedeConfigurar) return;
    api<{ metodosPago: string[] }>('/local/metodos-pago')
      .then((d) => setMetodos(d.metodosPago || []))
      .catch(() => {});
  }, [puedeConfigurar]);

  useEffect(() => {
    cargarMetodos();
  }, [cargarMetodos]);

  async function toggleMetodo(key: string) {
    const nuevo = metodos.includes(key)
      ? metodos.filter((m) => m !== key)
      : [...metodos, key];
    setMetodos(nuevo);
    await api('/local/metodos-pago', {
      method: 'PATCH',
      body: JSON.stringify({ metodosPago: nuevo }),
    }).catch((e) => toast(e.message || 'Error', 'bad'));
    toast('Métodos de pago actualizados', 'ok');
  }

  const cargar = useCallback(() => {
    api('/caja/actual').then(setActual).catch(() => setActual(null));
    api('/caja/resumen').then(setResumen).catch(() => {});
    api('/pedidos').then(setPedidos).catch(() => {});
    api('/caja/historial').then(setHistorial).catch(() => {});
    api('/caja/movimientos').then(setMovimientos).catch(() => {});
    api('/productos').then(setProductos).catch(() => {});
    api('/caja/meseros').then(setMeseros).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const porMesa = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of pedidos) {
      const key = p.mesa?.nombre || 'Sin mesa';
      (map[key] = map[key] || []).push(p);
    }
    return map;
  }, [pedidos]);

  async function abrirCaja() {
    try {
      await api('/caja/abrir', { method: 'POST', body: JSON.stringify({ apertura: Number(base) }) });
      toast('Caja abierta', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function cerrarCaja() {
    if (!window.confirm('¿Cerrar el turno y generar el cierre de caja?')) return;
    try {
      const resultado = await api('/caja/cerrar', { method: 'POST' });
      setCierreModal(resultado);
      toast('Turno cerrado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function verCierre(id: string) {
    try {
      const detalle = await api(`/caja/${id}`);
      setCierreModal(detalle);
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function registrarPago() {
    if (!pagoModal) return;
    try {
      await api(`/pedidos/${pagoModal.id}/pagar`, {
        method: 'PATCH',
        body: JSON.stringify({ metodoPago: pagoMetodo }),
      });
      toast('Pago registrado', 'ok');
      setPagoModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function registrarMovimiento() {
    if (!movForm?.monto) return;
    try {
      await api('/caja/movimientos', {
        method: 'POST',
        body: JSON.stringify({
          tipo: movForm.tipo,
          monto: Number(movForm.monto),
          concepto: movForm.concepto,
          metodo: movForm.metodo || undefined,
          productoId: movForm.productoId || undefined,
          cantidad: movForm.productoId ? Number(movForm.cantidad || 0) : undefined,
        }),
      });
      toast('Movimiento registrado', 'ok');
      setMovForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarBaseMesero(id: string, nombre: string, base: number) {
    try {
      await api(`/caja/meseros/${id}`, { method: 'PATCH', body: JSON.stringify({ base }) });
      toast(`Base de ${nombre} actualizada`, 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  const porPagar = pedidos.filter((p) => !p.pagadoEn && p.estado !== 'CANCELADO');

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Caja y Turno</h1>
          <div className="sub">{actual ? 'Caja abierta · turno en curso' : 'Caja cerrada'}</div>
        </div>
        {actual ? (
          <button className="btn danger" onClick={cerrarCaja}>🔒 Cerrar turno</button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="number" value={base} onChange={(e) => setBase(e.target.value)} style={{ width: 160 }} placeholder="Base inicial" />
            <button className="btn primary" onClick={abrirCaja}>Abrir caja</button>
          </div>
        )}
      </div>

      {puedeConfigurar && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Métodos de pago disponibles</h3>
          <div className="sub" style={{ margin: '0 0 10px' }}>
            Estos son los medios que el cliente podrá elegir al pedir.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {METODOS_TODOS.map((m) => {
              const activo = metodos.includes(m);
              return (
                <button
                  key={m}
                  className={`pill ${activo ? 'ok' : 'mute'}`}
                  style={{ cursor: 'pointer', padding: '8px 14px', fontSize: 13 }}
                  onClick={() => toggleMetodo(m)}
                >
                  {METODO_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid cols-3">
        <div className="card hover stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}><Wallet size={22} color="#f5b301" /></div>
          <div>
            <div className="stat-val">{fmt(resumen?.baseTotal ?? 0)}</div>
            <div className="stat-label">Base total</div>
            <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
              Caja {fmt(resumen?.baseInicial ?? 0)} + meseros {fmt(resumen?.sumaBases ?? 0)}
            </div>
          </div>
        </div>
        <div className="card hover stat-card">
          <div className="stat-icon" style={{ background: 'rgba(46,204,113,.14)' }}><TrendingUp size={22} color="#4ade80" /></div>
          <div>
            <div className="stat-val" style={{ color: '#4ade80' }}>{fmt(resumen?.totalRecaudado ?? 0)}</div>
            <div className="stat-label">Recaudado (digital)</div>
          </div>
        </div>
        <div className="card hover stat-card">
          <div className="stat-icon" style={{ background: 'rgba(167,139,250,.14)' }}><HandCoins size={22} color="#c4b5fd" /></div>
          <div>
            <div className="stat-val" style={{ color: '#c4b5fd' }}>{fmt(resumen?.propinas ?? 0)}</div>
            <div className="stat-label">Propinas</div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Recaudo por método de pago</h3>
          {resumen?.porMetodo &&
            Object.entries(resumen.porMetodo).map(([metodo, monto]) => (
              <div className="list-item" key={metodo}>
                <div className="body"><div className="title">{metodo}</div></div>
                <span style={{ fontWeight: 700 }}>{fmt(monto as number)}</span>
              </div>
            ))}
          {!resumen?.porMetodo || Object.keys(resumen.porMetodo).length === 0 ? <div className="sub">Sin pagos.</div> : null}
        </div>

        <div className="card">
          <h3>Recaudo por mesero (turno)</h3>
          {resumen?.porMesero &&
            Object.entries(resumen.porMesero).map(([nombre, data]: any) => (
              <div className="list-item" key={nombre}>
                <div className="emoji-tile"><UserRound size={18} color="#8b95a6" /></div>
                <div className="body">
                  <div className="title">{nombre}</div>
                  <div className="meta">{data.pedidos} pedidos entregados</div>
                </div>
                <span style={{ fontWeight: 700 }}>{fmt(data.total)}</span>
              </div>
            ))}
          {!resumen?.porMesero || Object.keys(resumen.porMesero).length === 0 ? <div className="sub">Sin entregas.</div> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Base de meseros</h3>
        <div className="sub" style={{ marginBottom: 10 }}>
          Define la base (sueldo base) de cada mesero. Déjalo en 0 si no aplica.
        </div>
        {meseros.length === 0 && <div className="sub">No hay meseros activos.</div>}
        {meseros.map((m) => (
          <div className="list-item" key={m.id}>
            <div className="emoji-tile"><UserRound size={18} color="#8b95a6" /></div>
            <div className="body">
              <div className="title">{m.nombre}</div>
              <div className="meta">Base actual: {fmt(m.base ?? 0)}</div>
            </div>
            <input
              key={`${m.id}-${m.base}`}
              type="number"
              defaultValue={m.base ?? 0}
              style={{ width: 120 }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val !== (m.base ?? 0)) guardarBaseMesero(m.id, m.nombre, val);
              }}
            />
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pedidos por mesa</h3>
        {Object.keys(porMesa).length === 0 && <div className="sub">No hay pedidos activos.</div>}
        {Object.entries(porMesa).map(([mesa, ps]) => (
          <div key={mesa} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Armchair size={15} color="#8b95a6" /> {mesa} <span className="pill mute">{ps.length}</span>
            </div>
            {ps.map((p: any) => (
              <div className="list-item" key={p.id}>
                <div className="emoji-tile"><Receipt size={18} color="#8b95a6" /></div>
                <div className="body">
                  <div className="title">{p.codigo}</div>
                  <div className="meta">{p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(' · ')}</div>
                </div>
                <span className={`pill ${p.estado === 'LISTO' ? 'ok' : p.estado === 'RECIBIDO' ? 'bad' : 'warn'}`}>
                  {p.estado.replaceAll('_', ' ').toLowerCase()}
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(p.total)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Pedidos por pagar <span className="pill warn">{porPagar.length}</span></h3>
          {porPagar.length === 0 && <div className="sub">No hay pedidos pendientes de pago.</div>}
          {porPagar.map((p: any) => (
            <div className="list-item" key={p.id}>
              <div className="emoji-tile"><Receipt size={18} color="#8b95a6" /></div>
              <div className="body">
                <div className="title">{p.codigo} · {p.mesa?.nombre}</div>
                <div className="meta">Método elegido: {METODO_LABEL[p.metodoPago] || p.metodoPago || '—'}</div>
              </div>
              <span style={{ fontWeight: 700 }}>{fmt(p.total)}</span>
              <button className="btn primary sm" onClick={() => { setPagoModal(p); setPagoMetodo(p.metodoPago || 'EFECTIVO'); }}>
                Registrar pago
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Movimientos de caja</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn sm" onClick={() => setMovForm({ tipo: 'INGRESO', monto: '', concepto: '', productoId: '', cantidad: '1', metodo: 'EFECTIVO' })}>+ Ingreso</button>
            <button className="btn sm" onClick={() => setMovForm({ tipo: 'EGRESO', monto: '', concepto: '', productoId: '', cantidad: '1', metodo: 'EFECTIVO' })}>− Egreso</button>
          </div>
          {movimientos.length === 0 && <div className="sub">Sin movimientos.</div>}
          {movimientos.map((m: any) => (
            <div className="list-item" key={m.id}>
              <div className="body">
                <div className="title">{m.concepto || (m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso')}</div>
                <div className="meta">{new Date(m.createdAt).toLocaleString('es-CO')}</div>
              </div>
              <span style={{ fontWeight: 700, color: m.tipo === 'INGRESO' ? '#4ade80' : '#f87171' }}>
                {m.tipo === 'INGRESO' ? '+' : '−'}{fmt(m.monto)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Historial de cierres</h3>
        {historial.length === 0 && <div className="sub">Aún no hay cierres registrados.</div>}
        {historial.map((c) => (
          <div className="list-item" key={c.id}>
            <div className="emoji-tile"><Receipt size={18} color="#8b95a6" /></div>
            <div className="body">
              <div className="title">{c.usuario || 'Caja'} · {fecha(c.cerradaEn)}</div>
              <div className="meta">Base {fmt(c.apertura)} · Cierre {fmt(c.cierre ?? 0)}</div>
            </div>
            <button className="btn sm" onClick={() => verCierre(c.id)}>Ver / Reimprimir</button>
          </div>
        ))}
      </div>

      {cierreModal && (
        <div className="modal-bg" onClick={() => setCierreModal(null)}>
          <div className="modal receipt" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>KLUBB</div>
              <div className="sub">Cierre de caja (Z)</div>
              <div className="sub">{fecha(cierreModal.caja?.cerradaEn)}</div>
            </div>
            <div style={{ borderTop: '1px dashed var(--line)', borderBottom: '1px dashed var(--line)', padding: '12px 0', display: 'grid', gap: 6, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base caja</span><b>{fmt(cierreModal.baseInicial)}</b></div>
              {cierreModal.basesMeseros && cierreModal.basesMeseros.length > 0 && (
                <div style={{ fontSize: 12, color: '#8b95a6' }}>
                  {cierreModal.basesMeseros.map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Base {m.nombre}</span><span>{fmt(m.base)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base total</span><b>{fmt(cierreModal.baseTotal)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Recaudado</span><b>{fmt(cierreModal.totalRecaudado)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Propinas</span><b>{fmt(cierreModal.propinas)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Unidades vendidas</span><b>{cierreModal.unidadesVendidas ?? 0}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}><span>Cierre total</span><b>{fmt(cierreModal.cierre ?? 0)}</b></div>
            </div>
            {cierreModal.porMetodo && Object.keys(cierreModal.porMetodo).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>Por método</div>
                {Object.entries(cierreModal.porMetodo).map(([m, v]: any) => (
                  <div key={m} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{m}</span><span>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {cierreModal.porMesero && Object.keys(cierreModal.porMesero).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>Por mesero</div>
                {Object.entries(cierreModal.porMesero).map(([m, d]: any) => (
                  <div key={m} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{m} ({d.pedidos})</span><span>{fmt(d.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {cierreModal.productosVendidos && cierreModal.productosVendidos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>Productos vendidos</div>
                {cierreModal.productosVendidos.map((p: any) => (
                  <div key={p.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{p.nombre}</span><span>{p.cantidad} und · {fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {cierreModal.inventarioFinal && cierreModal.inventarioFinal.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>Inventario (inicio → final)</div>
                {cierreModal.inventarioFinal.map((f: any) => {
                  const ini = (cierreModal.inventarioInicio || []).find((i: any) => i.nombre === f.nombre);
                  return (
                    <div key={f.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{f.nombre}</span>
                      <span>{ini ? ini.stock : '—'} → {f.stock}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {cierreModal.pedidosCancelados && cierreModal.pedidosCancelados.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>Pedidos cancelados</div>
                {cierreModal.pedidosCancelados.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{c.codigo} · Mesa {c.mesa?.nombre}</span>
                    <span>por {c.canceladoPor}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn primary block" onClick={() => window.print()}>Imprimir</button>
              <button className="btn block" onClick={() => setCierreModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {pagoModal && (
        <div className="modal-bg" onClick={() => setPagoModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar pago</h2>
            <div className="sub">{pagoModal.codigo} · Mesa {pagoModal.mesa?.nombre} · {fmt(pagoModal.total)}</div>
            <label>Método de pago</label>
            <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
              {METODOS_TODOS.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={registrarPago}>
              Confirmar pago
            </button>
          </div>
        </div>
      )}

      {movForm && (
        <div className="modal-bg" onClick={() => setMovForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{movForm.tipo === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'}</h2>
            <label>Concepto</label>
            <input value={movForm.concepto} onChange={(e) => setMovForm({ ...movForm, concepto: e.target.value })} placeholder={movForm.tipo === 'INGRESO' ? 'Ej: venta directa, propina, etc.' : 'Ej: compra de hielo'} autoFocus />
            <label>Monto (COP)</label>
            <input type="number" value={movForm.monto} onChange={(e) => setMovForm({ ...movForm, monto: e.target.value })} placeholder="0" />
            <label>Método de pago</label>
            <select value={movForm.metodo} onChange={(e) => setMovForm({ ...movForm, metodo: e.target.value })}>
              {METODOS_TODOS.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
            {movForm.tipo === 'INGRESO' && (
              <>
                <label>¿Qué se vendió? (opcional, descuenta del inventario)</label>
                <select value={movForm.productoId} onChange={(e) => setMovForm({ ...movForm, productoId: e.target.value })}>
                  <option value="">— Sin producto —</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji || '🍸'} {p.nombre} (stock {p.stock})</option>
                  ))}
                </select>
                {movForm.productoId && (
                  <>
                    <label>Cantidad</label>
                    <input type="number" min={1} value={movForm.cantidad} onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })} placeholder="1" />
                  </>
                )}
              </>
            )}
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={registrarMovimiento}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
