import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Camera, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface ProductoForm {
  id?: string;
  categoriaId: string;
  nombre: string;
  descripcion: string;
  precio: string;
  costo: string;
  stock: string;
  stockMinimo: string;
  emoji: string;
  estacion: string;
  puntos: string;
}

export default function Productos() {
  const toast = useToast();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [vendidosPorDia, setVendidosPorDia] = useState<any[]>([]);

  const [catModal, setCatModal] = useState<{ nombre: string; icono: string } | null>(null);
  const [prodModal, setProdModal] = useState<ProductoForm | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/categorias').then(setCategorias).catch(console.error);
    api<any[]>('/productos/vendidos-por-dia').then(setVendidosPorDia).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalProductos = categorias.reduce((a, c) => a + c.productos.length, 0);

  async function guardarCategoria() {
    if (!catModal?.nombre.trim()) return;
    try {
      await api('/categorias', { method: 'POST', body: JSON.stringify({ nombre: catModal.nombre, icono: catModal.icono || '🍽️' }) });
      toast('Categoría creada', 'ok');
      setCatModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarProducto() {
    if (!prodModal?.nombre.trim() || !prodModal.categoriaId || !prodModal.precio) return;
    const payload = {
      categoriaId: prodModal.categoriaId,
      nombre: prodModal.nombre,
      descripcion: prodModal.descripcion,
      precio: Number(prodModal.precio),
      costo: Number(prodModal.costo || 0),
      stock: Number(prodModal.stock || 0),
      stockMinimo: Number(prodModal.stockMinimo || 5),
      emoji: prodModal.emoji || '🍸',
      estacion: prodModal.estacion,
      puntos: Number(prodModal.puntos || 0),
    };
    try {
      if (prodModal.id) {
        await api(`/productos/${prodModal.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Producto actualizado', 'ok');
      } else {
        await api('/productos', { method: 'POST', body: JSON.stringify(payload) });
        toast('Producto creado', 'ok');
      }
      setProdModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarProducto(id: string, nombre: string) {
    if (!window.confirm(`¿Desactivar "${nombre}"?`)) return;
    try {
      await api(`/productos/${id}`, { method: 'DELETE' });
      toast('Producto desactivado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  function editar(p: any, categoriaId: string) {
    setProdModal({
      id: p.id,
      categoriaId,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: String(p.precio),
      costo: String(p.costo ?? 0),
      stock: String(p.stock ?? 0),
      stockMinimo: String(p.stockMinimo ?? 5),
      emoji: p.emoji || '',
      estacion: p.estacion || 'BARRA',
      puntos: String(p.puntos ?? 0),
    });
  }

  async function subirFoto(id: string, file: File) {
    const token = localStorage.getItem('klubb_token');
    const form = new FormData();
    form.append('foto', file);
    try {
      const res = await fetch(`/api/productos/${id}/foto`, {
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

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Productos y Categorías</h1>
          <div className="sub">{categorias.length} categorías · {totalProductos} productos</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setCatModal({ nombre: '', icono: '' })}><Plus size={16} /> Categoría</button>
          <button
            className="btn primary"
            onClick={() =>
              setProdModal({ categoriaId: categorias[0]?.id || '', nombre: '', descripcion: '', precio: '', costo: '', stock: '', stockMinimo: '5', emoji: '', estacion: 'BARRA', puntos: '0' })
            }
          >
            <Plus size={16} /> Producto
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Unidades vendidas por día</h3>
        <div className="sub" style={{ marginBottom: 8 }}>Últimos 14 días</div>
        {vendidosPorDia.length === 0 && <div className="sub">Aún no hay ventas registradas.</div>}
        {vendidosPorDia.map((d) => (
          <div key={d.fecha} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{d.fecha}</span>
            <b>{d.unidades} und</b>
          </div>
        ))}
      </div>

      <div className="grid">
        {categorias.map((c) => (
          <div className="card" key={c.id}>
            <h3>
              <span>{c.icono} {c.nombre}</span>
              <span className="pill mute">{c.productos.length}</span>
            </h3>
            {c.productos.map((p: any) => {
              const margen = p.precio > 0 ? Math.round(((p.precio - (p.costo || 0)) / p.precio) * 100) : 0;
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
                    <div className="meta">
                      ${Number(p.precio).toLocaleString('es-CO')} · margen {margen}%
                    </div>
                  </div>
                  <span className={`pill ${p.stock === 0 ? 'bad' : p.stock <= p.stockMinimo ? 'warn' : 'ok'}`}>
                    {p.stock === 0 ? 'Agotado' : `${p.stock}`}
                  </span>
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
                  <button className="btn sm" onClick={() => editar(p, c.id)}><Pencil size={13} /></button>
                  <button className="btn sm danger" onClick={() => eliminarProducto(p.id, p.nombre)}><Trash2 size={13} /></button>
                </div>
              );
            })}
            {c.productos.length === 0 && <div className="sub">Sin productos.</div>}
          </div>
        ))}
        {categorias.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Package size={40} color="#8b95a6" /></div>
            <div className="sub">Crea tu primera categoría y productos.</div>
          </div>
        )}
      </div>

      {catModal && (
        <Modal onClose={() => setCatModal(null)}>
          <h2>Nueva categoría</h2>
          <div className="sub">Ej: Cocteles, Cervezas, Botellas</div>
          <label>Nombre</label>
          <input value={catModal.nombre} onChange={(e) => setCatModal({ ...catModal, nombre: e.target.value })} placeholder="Cocteles" autoFocus />
          <label>Icono (emoji)</label>
          <input value={catModal.icono} onChange={(e) => setCatModal({ ...catModal, icono: e.target.value })} placeholder="🍹" />
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarCategoria}>
            Guardar categoría
          </button>
        </Modal>
      )}

      {prodModal && (
        <Modal onClose={() => setProdModal(null)}>
          <h2>{prodModal.id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <label>Categoría</label>
          <select value={prodModal.categoriaId} onChange={(e) => setProdModal({ ...prodModal, categoriaId: e.target.value })}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <label>Nombre</label>
          <input value={prodModal.nombre} onChange={(e) => setProdModal({ ...prodModal, nombre: e.target.value })} placeholder="Mojito" autoFocus />
          <label>Descripción</label>
          <input value={prodModal.descripcion} onChange={(e) => setProdModal({ ...prodModal, descripcion: e.target.value })} placeholder="Ron, hierbabuena, limón" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Precio (COP)</label>
              <input type="number" value={prodModal.precio} onChange={(e) => setProdModal({ ...prodModal, precio: e.target.value })} placeholder="22000" />
            </div>
            <div>
              <label>Costo (COP)</label>
              <input type="number" value={prodModal.costo} onChange={(e) => setProdModal({ ...prodModal, costo: e.target.value })} placeholder="6000" />
            </div>
            <div>
              <label>Stock</label>
              <input type="number" value={prodModal.stock} onChange={(e) => setProdModal({ ...prodModal, stock: e.target.value })} placeholder="30" />
            </div>
            <div>
              <label>Stock mínimo</label>
              <input type="number" value={prodModal.stockMinimo} onChange={(e) => setProdModal({ ...prodModal, stockMinimo: e.target.value })} placeholder="5" />
            </div>
          </div>
          <label>Emoji</label>
          <input value={prodModal.emoji} onChange={(e) => setProdModal({ ...prodModal, emoji: e.target.value })} placeholder="🍹" />
          <label>Puntos que otorga (si el modo de puntos es "por producto")</label>
          <input type="number" value={prodModal.puntos} onChange={(e) => setProdModal({ ...prodModal, puntos: e.target.value })} placeholder="0" />
          <label>Estación que lo prepara</label>
          <select value={prodModal.estacion} onChange={(e) => setProdModal({ ...prodModal, estacion: e.target.value })}>
            <option value="BARRA">Barra (bebidas directas)</option>
            <option value="BARMAN">Barman (coctelería)</option>
            <option value="COCINA">Cocina (comida)</option>
          </select>
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarProducto}>
            Guardar producto
          </button>
        </Modal>
      )}
    </div>
  );
}
