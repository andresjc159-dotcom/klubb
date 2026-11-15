import { useCallback, useEffect, useState } from 'react';
import { Camera, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const TIPOS = [
  { value: 'DESCUENTO', label: 'Descuento (%)' },
  { value: 'PRECIO_FIJO', label: 'Oferta (precio fijo)' },
  { value: 'COMBO', label: 'Combo' },
];

const ESTACIONES = [
  { value: 'BARRA', label: 'Barra (bebidas directas)' },
  { value: 'BARMAN', label: 'Barman (coctelería)' },
  { value: 'COCINA', label: 'Cocina (comida)' },
];

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

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

  function nuevoModal(tipo = 'DESCUENTO') {
    setModal({
      nombre: '',
      descripcion: '',
      tipo,
      descuento: '0',
      precio: '',
      estacion: 'BARRA',
      activa: true,
      productoIds: [],
      items: [],
    });
  }

  function editarModal(p: any) {
    setModal({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      tipo: p.tipo || 'DESCUENTO',
      descuento: String(p.descuento ?? 0),
      precio: p.precio != null ? String(p.precio) : '',
      estacion: p.estacion || 'BARRA',
      activa: p.activa,
      productoIds: p.productos?.map((x: any) => x.id) || [],
      items: p.items?.map((i: any) => ({ productoId: i.productoId, cantidad: String(i.cantidad) })) || [],
    });
  }

  async function guardar() {
    if (!modal?.nombre.trim()) return toast('El nombre es requerido', 'bad');
    if (modal.tipo === 'COMBO' && !modal.precio) return toast('El precio del combo es requerido', 'bad');
    if (modal.tipo === 'PRECIO_FIJO' && !modal.precio) return toast('El precio de oferta es requerido', 'bad');
    const body: any = {
      nombre: modal.nombre,
      descripcion: modal.descripcion,
      tipo: modal.tipo,
      descuento: Number(modal.descuento || 0),
      precio: modal.precio != null && modal.precio !== '' ? Number(modal.precio) : undefined,
      estacion: modal.estacion,
      activa: modal.activa,
      productoIds: modal.productoIds,
      items: modal.items.map((i: any) => ({ productoId: i.productoId, cantidad: Number(i.cantidad || 1) })),
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

  async function subirFoto(id: string, file: File) {
    const token = localStorage.getItem('klubb_token');
    const form = new FormData();
    form.append('foto', file);
    try {
      const res = await fetch(`/api/promociones/${id}/foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error('Error al subir la foto');
      toast('Foto subida', 'ok');
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

  function agregarItemCombo(productoId: string) {
    if (!modal || modal.items.some((i: any) => i.productoId === productoId)) return;
    setModal({ ...modal, items: [...modal.items, { productoId, cantidad: '1' }] });
  }

  function quitarItemCombo(productoId: string) {
    if (!modal) return;
    setModal({ ...modal, items: modal.items.filter((i: any) => i.productoId !== productoId) });
  }

  function setCantidadCombo(productoId: string, cantidad: number) {
    if (!modal) return;
    setModal({
      ...modal,
      items: modal.items.map((i: any) =>
        i.productoId === productoId ? { ...i, cantidad: String(Math.max(1, cantidad)) } : i,
      ),
    });
  }

  const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label || t;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Promociones</h1>
          <div className="sub">Ofertas por precio, descuentos y combos para tus clientes</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => nuevoModal('COMBO')}><Plus size={16} /> Combo</button>
          <button className="btn primary" onClick={() => nuevoModal('PRECIO_FIJO')}><Plus size={16} /> Oferta</button>
        </div>
      </div>

      {promos.length === 0 && (
        <div className="card"><div className="sub">Aún no hay promociones.</div></div>
      )}

      {promos.map((p: any) => (
        <div className="card" key={p.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {p.imagenUrl ? (
                <img src={p.imagenUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
              ) : (
                <div className="stat-icon"><Tag size={16} color="#f5b301" /></div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{p.nombre}</h3>
                  <span className={`pill ${p.activa ? 'ok' : 'mute'}`}>{p.activa ? 'Activa' : 'Inactiva'}</span>
                  <span className="pill info">{tipoLabel(p.tipo)}</span>
                </div>
                <div className="meta" style={{ marginTop: 2 }}>
                  {p.tipo === 'COMBO'
                    ? `${fmt(p.precio ?? 0)} · ${p.items?.length || 0} productos`
                    : p.tipo === 'PRECIO_FIJO'
                      ? `Oferta a ${fmt(p.precio ?? 0)} · ${p.productos?.length || 0} producto(s)`
                      : `${p.descuento}% de descuento · ${p.productos?.length || 0} productos`}
                  {p.estacion && p.tipo === 'COMBO' ? ` · ${p.estacion}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <label className="btn sm" style={{ cursor: 'pointer' }} title="Subir foto">
                <Camera size={13} />
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) subirFoto(p.id, f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button className="btn sm" onClick={() => editarModal(p)}><Pencil size={13} /></button>
              <button className="btn sm danger" onClick={() => eliminar(p.id, p.nombre)}><Trash2 size={13} /></button>
            </div>
          </div>
          {p.descripcion && <div className="sub" style={{ marginTop: 6 }}>{p.descripcion}</div>}
          {p.tipo === 'COMBO' && p.items?.length > 0 && (
            <div className="meta" style={{ marginTop: 6 }}>
              Incluye: {p.items.map((i: any) => `${i.cantidad}x ${i.producto?.nombre || '—'}`).join(', ')}
            </div>
          )}
        </div>
      ))}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Editar promoción' : 'Nueva promoción'}</h2>
            <label>Tipo</label>
            <select value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label>Nombre</label>
            <input value={modal.nombre} onChange={(e) => setModal({ ...modal, nombre: e.target.value })} placeholder="Ej: Cubetazo de 6" autoFocus />
            <label>Descripción</label>
            <input value={modal.descripcion} onChange={(e) => setModal({ ...modal, descripcion: e.target.value })} placeholder="Válido jueves y viernes" />

            {modal.tipo === 'DESCUENTO' && (
              <>
                <label>Descuento (%)</label>
                <input type="number" value={modal.descuento} onChange={(e) => setModal({ ...modal, descuento: e.target.value })} placeholder="0" />
              </>
            )}

            {(modal.tipo === 'PRECIO_FIJO' || modal.tipo === 'COMBO') && (
              <>
                <label>{modal.tipo === 'COMBO' ? 'Precio del combo (COP)' : 'Precio de oferta (COP)'}</label>
                <input type="number" value={modal.precio} onChange={(e) => setModal({ ...modal, precio: e.target.value })} placeholder="80000" />
              </>
            )}

            {modal.tipo === 'COMBO' && (
              <label>Zona de despacho</label>
            )}
            {modal.tipo === 'COMBO' && (
              <select value={modal.estacion} onChange={(e) => setModal({ ...modal, estacion: e.target.value })}>
                {ESTACIONES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={modal.activa} onChange={(e) => setModal({ ...modal, activa: e.target.checked })} />
              Activa
            </label>

            {modal.tipo === 'COMBO' ? (
              <>
                <label style={{ marginTop: 12 }}>Productos del combo</label>
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 8, marginBottom: 8 }}>
                  {productos.map((pr: any) => {
                    const item = modal.items.find((i: any) => i.productoId === pr.id);
                    return (
                      <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        {!item ? (
                          <button className="btn sm" onClick={() => agregarItemCombo(pr.id)}>+</button>
                        ) : (
                          <button className="btn sm danger" onClick={() => quitarItemCombo(pr.id)}>✕</button>
                        )}
                        <span style={{ flex: 1, fontSize: 13 }}>{pr.emoji || '🍸'} {pr.nombre}</span>
                        {item && (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button className="btn sm" onClick={() => setCantidadCombo(pr.id, Number(item.cantidad) - 1)}>−</button>
                            <b>{item.cantidad}</b>
                            <button className="btn sm" onClick={() => setCantidadCombo(pr.id, Number(item.cantidad) + 1)}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <label style={{ marginTop: 12 }}>Productos incluidos</label>
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 8 }}>
                  {productos.map((pr: any) => (
                    <label key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <input type="checkbox" checked={modal.productoIds.includes(pr.id)} onChange={() => toggleProducto(pr.id)} />
                      {pr.emoji || '🍸'} {pr.nombre} <span className="sub">({fmt(pr.precio)})</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
