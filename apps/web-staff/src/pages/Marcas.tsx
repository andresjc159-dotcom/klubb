import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2, UserPlus, MoveRight } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Marcas() {
  const toast = useToast();
  const [marcas, setMarcas] = useState<any[]>([]);
  const [marcaForm, setMarcaForm] = useState<{ id?: string; nombre: string } | null>(null);
  const [masterForm, setMasterForm] = useState<{ marcaId: string; nombre: string; email: string; password: string } | null>(null);
  const [moverForm, setMoverForm] = useState<{ marcaId: string; marcaNombre: string; tenantId: string } | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/marcas').then(setMarcas).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const todosLosTenants = marcas.flatMap((m) =>
    (m.tenants || []).map((t: any) => ({ ...t, marcaNombre: m.nombre })),
  );

  async function moverTenant() {
    if (!moverForm?.tenantId) return;
    try {
      await api(`/marcas/${moverForm.marcaId}/tenants/${moverForm.tenantId}`, { method: 'PATCH' });
      toast('Local movido', 'ok');
      setMoverForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarMarca() {
    if (!marcaForm?.nombre.trim()) return;
    try {
      if (marcaForm.id) {
        await api(`/marcas/${marcaForm.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: marcaForm.nombre }) });
      } else {
        await api('/marcas', { method: 'POST', body: JSON.stringify({ nombre: marcaForm.nombre }) });
      }
      toast('Marca guardada', 'ok');
      setMarcaForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarMarca(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar la marca "${nombre}"?`)) return;
    try {
      await api(`/marcas/${id}`, { method: 'DELETE' });
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarMaster() {
    if (!masterForm?.nombre.trim() || !masterForm.email.trim() || !masterForm.password) {
      return toast('Completa todos los campos', 'bad');
    }
    try {
      await api(`/marcas/${masterForm.marcaId}/masters`, {
        method: 'POST',
        body: JSON.stringify({ nombre: masterForm.nombre, email: masterForm.email, password: masterForm.password }),
      });
      toast('Master creado', 'ok');
      setMasterForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Marcas y franquicias</h1>
          <div className="sub">Administra las marcas de la plataforma</div>
        </div>
        <button className="btn primary" onClick={() => setMarcaForm({ nombre: '' })}>
          <Plus size={16} /> Nueva marca
        </button>
      </div>

      {marcas.length === 0 && <div className="card"><div className="sub">Aún no hay marcas.</div></div>}

      {marcas.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stat-icon" style={{ background: 'rgba(167,139,250,.14)' }}>
                <Building2 size={20} color="#a78bfa" />
              </div>
              <div>
                <div className="title" style={{ fontSize: 16, fontWeight: 700 }}>{m.nombre}</div>
                <div className="meta">{(m.tenants || []).length} locales</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={() => setMoverForm({ marcaId: m.id, marcaNombre: m.nombre, tenantId: '' })}>
                <MoveRight size={14} /> Mover local
              </button>
              <button className="btn sm" onClick={() => setMasterForm({ marcaId: m.id, nombre: '', email: '', password: '' })}>
                <UserPlus size={14} /> Master
              </button>
              <button className="btn sm" onClick={() => setMarcaForm({ id: m.id, nombre: m.nombre })}>
                <Pencil size={13} />
              </button>
              {(!m.tenants || m.tenants.length === 0) && (
                <button className="btn sm danger" onClick={() => eliminarMarca(m.id, m.nombre)}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {(m.tenants || []).length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="sub" style={{ marginBottom: 6 }}>Locales</div>
              {m.tenants.map((t: any) => (
                <div key={t.id} style={{ fontSize: 13, padding: '3px 0' }}>🏪 {t.nombre}</div>
              ))}
            </div>
          )}

          {m.masters?.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="sub" style={{ marginBottom: 6 }}>Masters de esta marca</div>
              {m.masters.map((ms: any) => (
                <div key={ms.id} style={{ fontSize: 13, padding: '3px 0' }}>👤 {ms.nombre} · {ms.email}</div>
              ))}
            </div>
          )}
        </div>
      ))}

      {marcaForm && (
        <div className="modal-bg" onClick={() => setMarcaForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{marcaForm.id ? 'Editar marca' : 'Nueva marca'}</h2>
            <label>Nombre de la marca</label>
            <input value={marcaForm.nombre} onChange={(e) => setMarcaForm({ ...marcaForm, nombre: e.target.value })} placeholder="La Noche" autoFocus />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarMarca}>Guardar</button>
          </div>
        </div>
      )}

      {masterForm && (
        <div className="modal-bg" onClick={() => setMasterForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo master</h2>
            <div className="sub" style={{ marginBottom: 10 }}>Dueño de la marca (podrá crear locales)</div>
            <label>Nombre</label>
            <input value={masterForm.nombre} onChange={(e) => setMasterForm({ ...masterForm, nombre: e.target.value })} autoFocus />
            <label>Email</label>
            <input type="email" value={masterForm.email} onChange={(e) => setMasterForm({ ...masterForm, email: e.target.value })} />
            <label>Contraseña</label>
            <input type="password" value={masterForm.password} onChange={(e) => setMasterForm({ ...masterForm, password: e.target.value })} />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarMaster}>Crear master</button>
          </div>
        </div>
      )}

      {moverForm && (
        <div className="modal-bg" onClick={() => setMoverForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Mover local a "{moverForm.marcaNombre}"</h2>
            <div className="sub" style={{ marginBottom: 10 }}>Elige el local que quieres traer a esta marca</div>
            <label>Local</label>
            <select value={moverForm.tenantId} onChange={(e) => setMoverForm({ ...moverForm, tenantId: e.target.value })}>
              <option value="">Selecciona…</option>
              {todosLosTenants.map((t: any) => (
                <option key={t.id} value={t.id}>{t.nombre} (en {t.marcaNombre})</option>
              ))}
            </select>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={moverTenant}>Mover local</button>
          </div>
        </div>
      )}
    </div>
  );
}
