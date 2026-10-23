import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const ESTADOS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  asistio: 'Asistió',
};

const fmtFecha = (s: string) => new Date(s).toLocaleString('es-CO');

export default function Reservas() {
  const toast = useToast();
  const [reservas, setReservas] = useState<any[]>([]);
  const [form, setForm] = useState<{ id?: string; cliente: string; fecha: string; personas: string } | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/reservas').then(setReservas).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    if (!form?.cliente.trim() || !form.fecha) return;
    const body = { cliente: form.cliente, fecha: form.fecha, personas: Number(form.personas || 1) };
    try {
      if (form.id) {
        await api(`/reservas/${form.id}`, { method: 'PATCH', body: JSON.stringify({ cliente: form.cliente, fecha: form.fecha, personas: Number(form.personas || 1) }) });
        toast('Reserva actualizada', 'ok');
      } else {
        await api('/reservas', { method: 'POST', body: JSON.stringify(body) });
        toast('Reserva creada', 'ok');
      }
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    try {
      await api(`/reservas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar esta reserva?')) return;
    try {
      await api(`/reservas/${id}`, { method: 'DELETE' });
      toast('Reserva eliminada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Reservas</h1>
          <div className="sub">Gestiona las reservas de mesas</div>
        </div>
        <button className="btn primary" onClick={() => setForm({ cliente: '', fecha: '', personas: '2' })}>
          <Plus size={16} /> Nueva reserva
        </button>
      </div>

      {reservas.length === 0 && (
        <div className="card"><div className="sub">No hay reservas.</div></div>
      )}

      {reservas.map((r) => (
        <div className="card" key={r.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="stat-icon" style={{ background: 'rgba(56,189,248,.14)' }}>
                <CalendarDays size={20} color="#38bdf8" />
              </div>
              <div>
                <div className="title" style={{ fontWeight: 700 }}>{r.cliente}</div>
                <div className="meta">{fmtFecha(r.fecha)} · {r.personas} personas</div>
              </div>
            </div>
            <span className={`pill ${r.estado === 'confirmada' ? 'ok' : r.estado === 'cancelada' ? 'bad' : r.estado === 'asistio' ? 'info' : 'warn'}`}>
              {ESTADOS[r.estado] || r.estado}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {r.estado !== 'confirmada' && r.estado !== 'asistio' && (
              <button className="btn sm" onClick={() => cambiarEstado(r.id, 'confirmada')}><Check size={13} /> Confirmar</button>
            )}
            {r.estado !== 'asistio' && r.estado !== 'cancelada' && (
              <button className="btn sm" onClick={() => cambiarEstado(r.id, 'asistio')}>Asistió</button>
            )}
            {r.estado !== 'cancelada' && r.estado !== 'asistio' && (
              <button className="btn sm danger" onClick={() => cambiarEstado(r.id, 'cancelada')}><X size={13} /> Cancelar</button>
            )}
            <button className="btn sm" onClick={() => setForm({ id: r.id, cliente: r.cliente, fecha: r.fecha.slice(0, 16), personas: String(r.personas) })}><Pencil size={13} /></button>
            <button className="btn sm danger" onClick={() => eliminar(r.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}

      {form && (
        <div className="modal-bg" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{form.id ? 'Editar reserva' : 'Nueva reserva'}</h2>
            <label>Nombre del cliente</label>
            <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Juan Pérez" autoFocus />
            <label>Fecha y hora</label>
            <input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <label>Personas</label>
            <input type="number" min={1} value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} placeholder="2" />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
