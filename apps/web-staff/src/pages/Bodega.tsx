import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const MOTIVOS = ['Dañado', 'Vencido', 'Cambio de referencia', 'Otro'];
const CONCEPTOS = ['Compra', 'Cortesía', 'Bonificación', 'Otro'];

export default function Bodega() {
  const toast = useToast();
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<any>(null);

  const cargar = useCallback(() => {
    api<any[]>('/bodega/documentos').then(setDocumentos).catch(console.error);
    api<any[]>('/productos').then(setProductos).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function toggleItem(productoId: string) {
    if (!form) return;
    const exists = form.items.some((i: any) => i.productoId === productoId);
    const items = exists
      ? form.items.filter((i: any) => i.productoId !== productoId)
      : [...form.items, { productoId, cantidad: 1 }];
    setForm({ ...form, items });
  }

  function setCantidad(productoId: string, cantidad: number) {
    if (!form) return;
    const items = form.items.map((i: any) =>
      i.productoId === productoId ? { ...i, cantidad } : i,
    );
    setForm({ ...form, items });
  }

  async function guardar() {
    if (!form?.items.length) return toast('Agrega al menos un producto', 'bad');
    try {
      await api('/bodega/documentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo: form.tipo,
          factura: form.factura,
          motivo: form.motivo,
          concepto: form.concepto,
          items: form.items,
        }),
      });
      toast('Documento guardado', 'ok');
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  const productosFiltrados = productos.filter((p) =>
    (p.nombre || '').toLowerCase().includes((busqueda || '').toLowerCase()),
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Documentos de bodega</h1>
          <div className="sub">Entradas y salidas de inventario</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => { setBusqueda(''); setForm({ tipo: 'INGRESO', factura: '', motivo: '', concepto: 'Compra', items: [] }); }}>
            <Plus size={16} /> Ingreso
          </button>
          <button className="btn" onClick={() => { setBusqueda(''); setForm({ tipo: 'SALIDA', factura: '', motivo: '', concepto: '', items: [] }); }}>
            <Plus size={16} /> Salida
          </button>
        </div>
      </div>

      {documentos.length === 0 && (
        <div className="card"><div className="sub">Sin documentos de bodega.</div></div>
      )}

      {documentos.map((d) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="stat-icon" style={{ background: d.tipo === 'INGRESO' ? 'rgba(46,204,113,.14)' : 'rgba(239,68,68,.14)' }}>
                {d.tipo === 'INGRESO' ? <ArrowDownToLine size={18} color="#4ade80" /> : <ArrowUpFromLine size={18} color="#f87171" />}
              </div>
              <div>
                <div className="title" style={{ fontWeight: 700 }}>
                  {d.numero} · {d.tipo === 'INGRESO' ? 'Ingreso' : 'Salida'}
                </div>
                <div className="meta">
                  {d.tipo === 'INGRESO'
                    ? `Concepto: ${d.concepto || '—'} · Factura: ${d.factura || '—'}`
                    : `Motivo: ${d.motivo || '—'}`} · {new Date(d.createdAt).toLocaleString('es-CO')}
                </div>
              </div>
            </div>
            <button className="btn sm" onClick={() => setDetalle(d)}>Ver / Imprimir</button>
          </div>
          <div style={{ marginTop: 8 }}>
            {d.items?.map((i: any) => (
              <div key={i.id} style={{ fontSize: 13, padding: '3px 0' }}>
                {i.producto?.emoji || '🍸'} {i.producto?.nombre} · {i.cantidad} und
              </div>
            ))}
          </div>
        </div>
      ))}

      {form && (
        <div className="modal-bg" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{form.tipo === 'INGRESO' ? 'Nuevo ingreso' : 'Nueva salida'}</h2>
            {form.tipo === 'INGRESO' ? (
              <>
                <label>Concepto</label>
                <select value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })}>
                  {CONCEPTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label style={{ marginTop: 12 }}>Número de factura</label>
                <input value={form.factura} onChange={(e) => setForm({ ...form, factura: e.target.value })} placeholder="FAC-001" autoFocus />
              </>
            ) : (
              <>
                <label>Motivo de la salida</label>
                <select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </>
            )}
            <label style={{ marginTop: 12 }}>Productos</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar producto…"
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {productosFiltrados.map((p) => {
                const item = form.items.find((i: any) => i.productoId === p.id);
                const sel = !!item;
                return (
                  <div
                    key={p.id}
                    className="list-item"
                    style={{
                      padding: 10,
                      cursor: 'pointer',
                      background: sel ? 'rgba(245,179,1,.06)' : undefined,
                      borderColor: sel ? 'var(--accent)' : undefined,
                    }}
                    onClick={() => { if (!sel) toggleItem(p.id); }}
                  >
                    <div className="emoji-tile" style={{ fontSize: 20 }}>{p.emoji || '🍸'}</div>
                    <div className="body">
                      <div className="title">{p.nombre}</div>
                      <div className="meta">Stock {p.stock}</div>
                    </div>
                    {sel ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); toggleItem(p.id); }}>✕</button>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); setCantidad(p.id, Math.max(1, item.cantidad - 1)); }}>−</button>
                        <b>{item.cantidad}</b>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); setCantidad(p.id, item.cantidad + 1); }}>+</button>
                      </div>
                    ) : (
                      <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); toggleItem(p.id); }}>+</button>
                    )}
                  </div>
                );
              })}
              {productosFiltrados.length === 0 && (
                <div className="sub" style={{ padding: 16, textAlign: 'center' }}>Sin resultados.</div>
              )}
            </div>
            {form.items.length > 0 && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(245,179,1,.06)', borderRadius: 12 }}>
                <div className="sub" style={{ marginBottom: 6 }}>Agregados ({form.items.length})</div>
                {form.items.map((i: any) => {
                  const p = productos.find((x) => x.id === i.productoId);
                  return (
                    <div key={i.productoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                      <span>{p?.emoji || '🍸'} {p?.nombre}</span>
                      <b>{i.cantidad} und</b>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>Guardar documento</button>
          </div>
        </div>
      )}

      {detalle && (
        <div className="modal-bg" onClick={() => setDetalle(null)}>
          <div className="modal receipt" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>KLUBB</div>
              <div className="sub">Documento de {detalle.tipo === 'INGRESO' ? 'ingreso' : 'salida'}</div>
              <div className="sub">{detalle.numero} · {new Date(detalle.createdAt).toLocaleString('es-CO')}</div>
            </div>
            <div style={{ borderTop: '1px dashed var(--line)', borderBottom: '1px dashed var(--line)', padding: '12px 0', display: 'grid', gap: 6, fontSize: 14 }}>
              {detalle.tipo === 'INGRESO' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Concepto</span><b>{detalle.concepto || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Factura</span><b>{detalle.factura || '—'}</b></div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Motivo</span><b>{detalle.motivo || '—'}</b></div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {detalle.items?.map((i: any) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span>{i.producto?.emoji || '🍸'} {i.producto?.nombre}</span>
                  <b>{i.cantidad} und</b>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn primary block" onClick={() => window.print()}>Imprimir</button>
              <button className="btn block" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
