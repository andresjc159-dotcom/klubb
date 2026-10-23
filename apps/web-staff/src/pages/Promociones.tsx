import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Promociones() {
  const toast = useToast();
  const [promos, setPromos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  const cargar = useCallback(() => {
    Promise.all([api<any[]>('/promociones'), api<any[]>('/productos')])
      .then(([p, pr]) => {
        setPromos(p);
        setProductos(pr);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    if (!modal?.nombre.trim()) return;
    const body = {
      nombre: modal.nombre,
      descripcion: modal.descripcion,
      descuento: Number(modal.descuento || 0),
      activa: modal.activa,
      productoIds: modal.productoIds,
    };
    try {
      if (modal.id) {
        await api(`/promociones/${modal.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('Promoción actualizada', 'ok');
      } else {
        await api('/promociones', { method: 'POST', body: JSON.stringify(body) });
        toast('Promoción creada', 'ok');
      }
      setModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      await api(`/promociones/${id}`, { method: 'DELETE' });
      toast('Promoción eliminada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  function toggleProducto(id: string) {
    if (!modal) return;
    const ids = modal.productoIds.includes(id)
      ? modal.productoIds.filter((x: string) => x !== id)
      : [...modal.productoIds, id];
    setModal({ ...modal, productoIds: ids });
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Promociones</h1>
          <div className="sub">Crea promociones que verán tus clientes en el menú</div>
        </div>
        <button
          className="btn primary"
          onClick={() => setModal({ nombre: '', descripcion: '', descuento: '0', activa: true, productoIds: [] })}
        >
          <Plus size={16} /> Promoción
        </button>
      </div>

      {promos.length === 0 && (
        <div className="card"><div className="sub">Aún no hay promociones.</div></div>
      )}
      {promos.map((p: any) => (
        <div className="card" key={p.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag size={16} color="#f5b301" />
              <h3 style={{ margin: 0 }}>{p.nombre}</h3>
              <span className={`pill ${p.activa ? 'ok' : 'mute'}`}>{p.activa ? 'Activa' : 'Inactiva'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn sm"
                onClick={() =>
                  setModal({
                    id: p.id,
                    nombre: p.nombre,
                    descripcion: p.descripcion || '',
                    descuento: String(p.descuento ?? 0),
                    activa: p.activa,
                    productoIds: p.productos?.map((x: any) => x.id) || [],
                  })
                }
              >
                <Pencil size={13} />
              </button>
              <button className="btn sm danger" onClick={() => eliminar(p.id, p.nombre)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {p.descripcion && <div className="sub">{p.descripcion}</div>}
          <div className="meta" style={{ marginTop: 4 }}>
            {p.descuento ? `${p.descuento}% de descuento · ` : ''}
            {p.productos?.length || 0} productos
          </div>
        </div>
      ))}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Editar promoción' : 'Nueva promoción'}</h2>
            <label>Nombre</label>
            <input value={modal.nombre} onChange={(e) => setModal({ ...modal, nombre: e.target.value })} placeholder="2x1 en cervezas" autoFocus />
            <label>Descripción</label>
            <input value={modal.descripcion} onChange={(e) => setModal({ ...modal, descripcion: e.target.value })} placeholder="Válido jueves y viernes" />
            <label>Descuento (%)</label>
            <input type="number" value={modal.descuento} onChange={(e) => setModal({ ...modal, descuento: e.target.value })} placeholder="0" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={modal.activa} onChange={(e) => setModal({ ...modal, activa: e.target.checked })} />
              Activa
            </label>
            <label style={{ marginTop: 12 }}>Productos incluidos</label>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 8 }}>
              {productos.map((pr: any) => (
                <label key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input type="checkbox" checked={modal.productoIds.includes(pr.id)} onChange={() => toggleProducto(pr.id)} />
                  {pr.emoji || '🍸'} {pr.nombre}
                </label>
              ))}
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
