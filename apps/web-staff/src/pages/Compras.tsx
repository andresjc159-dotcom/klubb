import { useCallback, useEffect, useState } from 'react';
import { PackagePlus, Plus, Trash2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

export default function Compras() {
  const toast = useToast();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [provForm, setProvForm] = useState<{ id?: string; nombre: string; telefono: string } | null>(null);
  const [ordenForm, setOrdenForm] = useState<any>(null);

  const cargar = useCallback(() => {
    api<any[]>('/compras/proveedores').then(setProveedores).catch(console.error);
    api<any[]>('/compras/ordenes').then(setOrdenes).catch(console.error);
    api<any[]>('/productos').then(setProductos).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarProveedor() {
    if (!provForm?.nombre.trim()) return;
    try {
      if (provForm.id) {
        await api(`/compras/proveedores/${provForm.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: provForm.nombre, telefono: provForm.telefono }) });
        toast('Proveedor actualizado', 'ok');
      } else {
        await api('/compras/proveedores', { method: 'POST', body: JSON.stringify({ nombre: provForm.nombre, telefono: provForm.telefono }) });
        toast('Proveedor creado', 'ok');
      }
      setProvForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarProveedor(id: string) {
    if (!window.confirm('¿Eliminar este proveedor?')) return;
    try {
      await api(`/compras/proveedores/${id}`, { method: 'DELETE' });
      toast('Proveedor eliminado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarOrden() {
    if (!ordenForm?.proveedorId || !ordenForm.items.length) {
      toast('Selecciona proveedor y al menos un producto', 'bad');
      return;
    }
    try {
      await api('/compras/ordenes', {
        method: 'POST',
        body: JSON.stringify({ proveedorId: ordenForm.proveedorId, items: ordenForm.items }),
      });
      toast('Orden creada', 'ok');
      setOrdenForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function recibirOrden(id: string) {
    if (!window.confirm('¿Marcar como recibida? Se sumará al inventario.')) return;
    try {
      await api(`/compras/ordenes/${id}/recibir`, { method: 'PATCH' });
      toast('Orden recibida. Stock actualizado.', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarOrden(id: string) {
    if (!window.confirm('¿Eliminar esta orden?')) return;
    try {
      await api(`/compras/ordenes/${id}`, { method: 'DELETE' });
      toast('Orden eliminada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  function toggleItem(productoId: string) {
    if (!ordenForm) return;
    const exists = ordenForm.items.some((i: any) => i.productoId === productoId);
    const items = exists
      ? ordenForm.items.filter((i: any) => i.productoId !== productoId)
      : [...ordenForm.items, { productoId, cantidad: 1 }];
    setOrdenForm({ ...ordenForm, items });
  }

  function setCantidad(productoId: string, cantidad: number) {
    if (!ordenForm) return;
    const items = ordenForm.items.map((i: any) => (i.productoId === productoId ? { ...i, cantidad } : i));
    setOrdenForm({ ...ordenForm, items });
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Compras y proveedores</h1>
          <div className="sub">Gestiona proveedores y órdenes de compra</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setProvForm({ nombre: '', telefono: '' })}><Plus size={16} /> Proveedor</button>
          <button className="btn primary" onClick={() => setOrdenForm({ proveedorId: proveedores[0]?.id || '', items: [] })}>
            <PackagePlus size={16} /> Orden de compra
          </button>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Proveedores</h3>
          {proveedores.length === 0 && <div className="sub">Sin proveedores.</div>}
          {proveedores.map((p) => (
            <div className="list-item" key={p.id}>
              <div className="emoji-tile"><Truck size={18} color="#8b95a6" /></div>
              <div className="body">
                <div className="title">{p.nombre}</div>
                {p.telefono && <div className="meta">{p.telefono}</div>}
              </div>
              <button className="btn sm" onClick={() => setProvForm({ id: p.id, nombre: p.nombre, telefono: p.telefono || '' })}>Editar</button>
              <button className="btn sm danger" onClick={() => eliminarProveedor(p.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Órdenes de compra</h3>
          {ordenes.length === 0 && <div className="sub">Sin órdenes.</div>}
          {ordenes.map((o) => (
            <div className="list-item" key={o.id}>
              <div className="emoji-tile"><PackagePlus size={18} color="#38bdf8" /></div>
              <div className="body">
                <div className="title">{o.proveedor?.nombre || 'Proveedor'}</div>
                <div className="meta">
                  {o.items?.length || 0} productos · {new Date(o.createdAt).toLocaleDateString('es-CO')}
                </div>
              </div>
              <span className={`pill ${o.estado === 'recibida' ? 'ok' : 'warn'}`}>
                {o.estado === 'recibida' ? 'Recibida' : 'Pendiente'}
              </span>
              {o.estado !== 'recibida' && (
                <button className="btn primary sm" onClick={() => recibirOrden(o.id)}>Recibir</button>
              )}
              <button className="btn sm danger" onClick={() => eliminarOrden(o.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      {provForm && (
        <div className="modal-bg" onClick={() => setProvForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{provForm.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
            <label>Nombre</label>
            <input value={provForm.nombre} onChange={(e) => setProvForm({ ...provForm, nombre: e.target.value })} placeholder="Distribuidora XYZ" autoFocus />
            <label>Teléfono</label>
            <input value={provForm.telefono} onChange={(e) => setProvForm({ ...provForm, telefono: e.target.value })} placeholder="3001234567" />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarProveedor}>Guardar</button>
          </div>
        </div>
      )}

      {ordenForm && (
        <div className="modal-bg" onClick={() => setOrdenForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva orden de compra</h2>
            <label>Proveedor</label>
            <select value={ordenForm.proveedorId} onChange={(e) => setOrdenForm({ ...ordenForm, proveedorId: e.target.value })}>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <label style={{ marginTop: 12 }}>Productos</label>
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 8 }}>
              {productos.map((pr) => {
                const item = ordenForm.items.find((i: any) => i.productoId === pr.id);
                return (
                  <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <input type="checkbox" checked={!!item} onChange={() => toggleItem(pr.id)} />
                    <span style={{ flex: 1 }}>{pr.emoji || '🍸'} {pr.nombre}</span>
                    {item && (
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => setCantidad(pr.id, Number(e.target.value))}
                        style={{ width: 70 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarOrden}>Crear orden</button>
          </div>
        </div>
      )}
    </div>
  );
}
