import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Recetas() {
  const toast = useToast();
  const [productos, setProductos] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [selId, setSelId] = useState('');
  const [receta, setReceta] = useState<Array<{ insumoId: string; cantidad: string }>>([]);
  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevaCant, setNuevaCant] = useState('');

  const cargarProductos = useCallback(() => {
    api<any[]>('/productos').then(setProductos).catch(console.error);
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

  const producto = productos.find((p) => p.id === selId);

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
              <div className="body"><div className="title">{p.nombre}</div></div>
            </div>
          ))}
          {productos.length === 0 && <div className="sub">Sin productos.</div>}
        </div>

        <div className="card">
          <h3>{producto ? `Receta de ${producto.nombre}` : 'Selecciona un producto'}</h3>
          {!producto && <div className="sub">Elige un producto para armar su receta.</div>}

          {producto && (
            <>
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
    </div>
  );
}
