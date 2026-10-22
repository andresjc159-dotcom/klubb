import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, Users, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';

const ROLES = ['ADMIN', 'CAJERO', 'MESERO', 'BARRA', 'BARMAN', 'COCINA', 'DJ'];
const ROLE_LABELS: Record<string, string> = {
  MASTER: 'Master',
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  MESERO: 'Mesero',
  BARRA: 'Barra',
  BARMAN: 'Barman',
  COCINA: 'Cocina',
  DJ: 'DJ',
};

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
  email: string;
  telefono: string;
  password: string;
  role: string;
  tenantId: string;
  base: string;
}

export default function Usuarios() {
  const { user } = useAuth();
  const toast = useToast();
  const esMaster = user?.role === 'MASTER';
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [form, setForm] = useState<Form | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/usuarios').then(setUsuarios).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
    if (esMaster) api<any[]>('/locales').then(setLocales).catch(() => {});
  }, [cargar, esMaster]);

  async function guardar() {
    if (!form?.nombre || !form.email || !form.role) return;
    try {
      if (form.id) {
        const payload: any = { nombre: form.nombre, email: form.email, telefono: form.telefono, role: form.role, base: Number(form.base || 0) };
        if (esMaster) payload.tenantId = form.tenantId || null;
        if (form.password) payload.password = form.password;
        await api(`/usuarios/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Usuario actualizado', 'ok');
      } else {
        await api('/usuarios', {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nombre,
            email: form.email,
            telefono: form.telefono,
            password: form.password,
            role: form.role,
            base: Number(form.base || 0),
            tenantId: esMaster ? form.tenantId || null : undefined,
          }),
        });
        toast('Usuario creado', 'ok');
      }
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function desactivar(id: string, nombre: string) {
    if (!window.confirm(`¿Desactivar a "${nombre}"?`)) return;
    try {
      await api(`/usuarios/${id}`, { method: 'DELETE' });
      toast('Usuario desactivado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  function nombreLocal(tenantId?: string | null) {
    if (!tenantId) return '—';
    return locales.find((l) => l.id === tenantId)?.nombre || tenantId;
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Usuarios y permisos</h1>
          <div className="sub">{usuarios.length} usuarios</div>
        </div>
        <button
          className="btn primary"
          onClick={() => setForm({ nombre: '', email: '', telefono: '', password: '', role: 'MESERO', tenantId: '', base: '0' })}
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="card">
        {usuarios.map((u) => (
          <div className="list-item" key={u.id}>
            <div className="emoji-tile"><ShieldCheck size={18} color={u.role === 'ADMIN' ? '#f5b301' : '#8b95a6'} /></div>
            <div className="body">
              <div className="title">
                {u.nombre}
                {u.role === 'MASTER' && <span className="pill purple" style={{ marginLeft: 8 }}>Master</span>}
              </div>
              <div className="meta">{u.email} · {ROLE_LABELS[u.role] || u.role}{esMaster ? ` · ${nombreLocal(u.tenantId)}` : ''}</div>
            </div>
            <span className={`pill ${u.activo ? 'ok' : 'mute'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
            <button className="btn sm" onClick={() => setForm({ id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono || '', password: '', role: u.role, tenantId: u.tenantId || '', base: String(u.base ?? 0) })}>
              <Pencil size={13} />
            </button>
            {u.activo && u.role !== 'MASTER' && (
              <button className="btn sm danger" onClick={() => desactivar(u.id, u.nombre)}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        {usuarios.length === 0 && (
          <div className="sub" style={{ textAlign: 'center', padding: 30 }}><Users size={40} color="#8b95a6" /></div>
        )}
      </div>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <h2>{form.id ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <label>Nombre</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label>Teléfono</label>
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <label>{form.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={form.id ? 'Dejar vacío para no cambiar' : ''} />
          <label>Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <label>Base (fondo de cambio)</label>
          <input type="number" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} placeholder="0" />
          {esMaster && (
            <>
              <label>Local (bar)</label>
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                <option value="">Sin local (master)</option>
                {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </>
          )}
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>
            Guardar
          </button>
        </Modal>
      )}
    </div>
  );
}
