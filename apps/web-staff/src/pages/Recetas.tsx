import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Recetas() {
  const toast = useToast();
  const [productos, setProductos] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [costos, setCostos] = useState<any[]>([]);
  const [selId, setSelId] = useState('');
  const [receta, setReceta] = useState<Array<{ insumoId: string; cantidad: string }>>([]);
  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevaCant, setNuevaCant] = useState('');

  const cargarProductos = useCallback(() => {
    api<any[]>('/productos').then(setProductos).catch(console.error);
    api<any[]>('/productos/costos').then(setCostos).catch(console.error);
  }, []);

  useEffect(() => {
    cargarProductos();
    api<any[]>('/insumos').then(setInsumos).catch(console.error);
  }, [cargarProductos]);

  useEffect(() => {
    if (!selId) return;
    api<any[]>(`/productos/${selId}/receta`).then((r) => {
      setReceta(r.map((x) => ({ insumoId: x.insumoId, cantidad: String(x.cantidad) })));
    }).catch(console.error);
  }, [selId]);

  const insumoNombre = (id: string) => insumos.find((i) => i.id === id)?.nombre || '—';
  const insumoUnidad = (id: string) => insumos.find((i) => i.id === id)?.unidad || '';
  const costoDe = (id: string) => costos.find((c) => c.id === id);
  const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

  const producto = productos.find((p) => p.id === selId);
  const costoProducto = selId ? costoDe(selId) : null;

  function agregar() {
    if (!nuevoInsumo || !nuevaCant) return;
    if (receta.some((r) => r.insumoId === nuevoInsumo)) return;
    setReceta([...receta, { insumoId: nuevoInsumo, cantidad: nuevaCant }]);
    setNuevoInsumo('');
    setNuevaCant('');
  }

  function quitar(insumoId: string) {
    setReceta(receta.filter((r) => r.insumoId !== insumoId));
  }

  async function guardar() {
    if (!selId) return;
    await api(`/productos/${selId}/receta`, {
      method: 'PUT',
      body: JSON.stringify({
        items: receta.map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) })),
      }),
    });
    toast('Receta guardada', 'ok');
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChefHat size={22} color="#f5b301" /> Recetas
          </h1>
          <div className="sub">Amarrar cada producto del menú a los insumos que consume</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Productos del menú</h3>
          {productos.map((p) => (
            <div
              className="list-item"
              key={p.id}
              style={{ cursor: 'pointer', borderColor: selId === p.id ? 'var(--accent)' : undefined }}
              onClick={() => setSelId(p.id)}
            >
              <div className="emoji-tile">{p.imagenUrl ? <img src={p.imagenUrl} alt="" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'cover' }} /> : p.emoji || '🍽️'}</div>
              <div className="body">
                <div className="title">{p.nombre}</div>
                <div className="meta">
                  {(() => {
                    const c = costoDe(p.id);
                    return c
                      ? `Costo receta ${fmt(c.costoReceta)} · margen ${c.margenPct}%`
                      : 'Sin insumos asignados';
                  })()}
                </div>
              </div>
            </div>
          ))}
          {productos.length === 0 && <div className="sub">Sin productos.</div>}
        </div>

        <div className="card">
          <h3>{producto ? `Receta de ${producto.nombre}` : 'Selecciona un producto'}</h3>
          {!producto && <div className="sub">Elige un producto para armar su receta.</div>}

          {producto && (
            <>
              {costoProducto && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '12px 14px',
                    background: 'rgba(245,179,1,.07)',
                    border: '1px solid rgba(245,179,1,.3)',
                    borderRadius: 12,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div className="sub">Precio</div>
                    <b>{fmt(costoProducto.precio)}</b>
                  </div>
                  <div>
                    <div className="sub">Costo receta</div>
                    <b>{fmt(costoProducto.costoReceta)}</b>
                  </div>
                  <div>
                    <div className="sub">Margen</div>
                    <b style={{ color: costoProducto.margenPct >= 0 ? '#4ade80' : '#f87171' }}>
                      {fmt(costoProducto.margen)} ({costoProducto.margenPct}%)
                    </b>
                  </div>
                </div>
              )}
              {receta.length === 0 && (
                <div className="sub" style={{ marginBottom: 10 }}>Aún no tiene insumos asignados.</div>
              )}
              {receta.map((r) => (
                <div className="list-item" key={r.insumoId}>
                  <div className="body">
                    <div className="title">{insumoNombre(r.insumoId)}</div>
                    <div className="meta">por cada unidad</div>
                  </div>
                  <span className="pill ok">{r.cantidad} {insumoUnidad(r.insumoId)}</span>
                  <button className="btn sm danger" onClick={() => quitar(r.insumoId)}><Trash2 size={13} /></button>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0', paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={nuevoInsumo} onChange={(e) => setNuevoInsumo(e.target.value)} style={{ flex: 2 }}>
                    <option value="">Elegir insumo…</option>
                    {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                  </select>
                  <input type="number" step="0.1" value={nuevaCant} onChange={(e) => setNuevaCant(e.target.value)} placeholder="Cant." style={{ flex: 1 }} />
                  <button className="btn" onClick={agregar}><Plus size={15} /></button>
                </div>
              </div>

              <button className="btn primary block" onClick={guardar}>
                <Save size={16} /> Guardar receta
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, background: 'rgba(56,189,248,.05)', borderColor: 'rgba(56,189,248,.25)' }}>
        <h3>¿Cómo se calcula el costo de la receta?</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: '#8b95a6' }}>
          <li>Cada insumo tiene un <b style={{ color: '#cbd5e1' }}>costo por unidad</b> (lo defines en la sección "Insumos").</li>
          <li>La <b style={{ color: '#cbd5e1' }}>cantidad</b> es lo que ese producto consume del insumo (ej. <b>0.03</b> de una botella de ron).</li>
          <li>
            <b style={{ color: '#cbd5e1' }}>Costo receta</b> = suma de (cantidad × costo del insumo) de todos los insumos.
          </li>
          <li>
            <b style={{ color: '#cbd5e1' }}>Margen</b> = precio de venta − costo receta. El porcentaje se muestra en verde si es positivo.
          </li>
          <li>
            Si un producto <b style={{ color: '#cbd5e1' }}>no tiene insumos</b>, su costo receta es $0 y su margen aparece como 100%.
          </li>
          <li>
            Usa cantidades en <b style={{ color: '#cbd5e1' }}>fracción de la unidad</b> del insumo: si compras una botella y usas una copa, escribe la fracción (0.03), no "1 botella".
          </li>
        </ul>
      </div>
    </div>
  );
}
