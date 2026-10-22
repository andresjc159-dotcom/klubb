import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Boxes, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const UNIDADES = ['unidad', 'mg', 'g', 'kg', 'ml', 'litro', 'botella'];

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

interface Form {
  id?: string;
  nombre: string;
  categoria: string;
  cantidad: string;
  unidad: string;
  stockMinimo: string;
  costo: string;
}

export default function Insumos() {
  const toast = useToast();
  const [insumos, setInsumos] = useState<any[]>([]);
  const [form, setForm] = useState<Form | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/insumos').then(setInsumos).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    if (!form?.nombre.trim()) return;
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      cantidad: Number(form.cantidad || 0),
      unidad: form.unidad || 'unidad',
      stockMinimo: Number(form.stockMinimo || 0),
      costo: Number(form.costo || 0),
    };
    try {
      if (form.id) {
        await api(`/insumos/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Insumo actualizado', 'ok');
      } else {
        await api('/insumos', { method: 'POST', body: JSON.stringify(payload) });
        toast('Insumo creado', 'ok');
      }
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar "${nombre}"?`)) return;
    await api(`/insumos/${id}`, { method: 'DELETE' });
    toast('Insumo eliminado', 'ok');
    cargar();
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Insumos (inventario interno)</h1>
          <div className="sub">Control de materia prima y suministros · no visible para el público</div>
        </div>
        <button
          className="btn primary"
          onClick={() => setForm({ nombre: '', categoria: '', cantidad: '0', unidad: 'unidad', stockMinimo: '0', costo: '0' })}
        >
          <Plus size={16} /> Nuevo insumo
        </button>
      </div>

      <div className="card">
        {insumos.length === 0 && (
          <div className="sub" style={{ textAlign: 'center', padding: 30 }}>
            <Boxes size={40} color="#8b95a6" />
            <div style={{ marginTop: 8 }}>Aún no tienes insumos registrados.</div>
          </div>
        )}
        {insumos.map((i) => {
          const bajo = i.cantidad <= i.stockMinimo && i.stockMinimo > 0;
          return (
            <div className="list-item" key={i.id}>
              <div className="emoji-tile"><Package size={18} color="#8b95a6" /></div>
              <div className="body">
                <div className="title">
                  {i.nombre}
                  {i.categoria && <span className="pill mute" style={{ marginLeft: 8 }}>{i.categoria}</span>}
                </div>
                <div className="meta">
                  Costo ${(i.costo || 0).toLocaleString('es-CO')} · mínimo {i.stockMinimo} {i.unidad}
                </div>
              </div>
              <span className={`pill ${bajo ? 'bad' : 'ok'}`}>
                {i.cantidad} {i.unidad}
              </span>
              <button className="btn sm" onClick={() => setForm({ id: i.id, nombre: i.nombre, categoria: i.categoria || '', cantidad: String(i.cantidad), unidad: i.unidad, stockMinimo: String(i.stockMinimo), costo: String(i.costo ?? 0) })}>
                <Pencil size={13} />
              </button>
              <button className="btn sm danger" onClick={() => eliminar(i.id, i.nombre)}><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <h2>{form.id ? 'Editar insumo' : 'Nuevo insumo'}</h2>
          <label>Nombre</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Ron Viejo de Caldas" autoFocus />
          <label>Categoría</label>
          <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Licores, Abarrotes, Frutas…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Cantidad</label>
              <input type="number" step="0.1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div>
              <label>Unidad</label>
              <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label>Stock mínimo</label>
              <input type="number" step="0.1" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
            </div>
            <div>
              <label>Costo unitario (COP)</label>
              <input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            </div>
          </div>
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>
            Guardar
          </button>
        </Modal>
      )}
    </div>
  );
}
