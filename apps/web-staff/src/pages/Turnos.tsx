import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const TIPOS = ['MAÑANA', 'TARDE', 'NOCHE', 'CIERRE'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function Turnos() {
  const toast = useToast();
  const [semana, setSemana] = useState(() => lunesDe(new Date()));
  const [staff, setStaff] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);

  const dias = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(semana);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [semana]);

  const desde = fmtFecha(dias[0]);
  const hasta = fmtFecha(dias[6]);

  const cargar = useCallback(() => {
    api<any[]>('/usuarios').then(setStaff).catch(() => {});
    api<any[]>(`/nomina/turnos?desde=${desde}&hasta=${hasta}`).then(setTurnos).catch(() => {});
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function turnoDe(userId: string, fecha: string) {
    return turnos.find((t) => t.userId === userId && t.fecha === fecha);
  }

  async function guardar() {
    if (!form?.userId || !form.horaInicio || !form.horaFin) return;
    try {
      await api('/nomina/turnos', { method: 'POST', body: JSON.stringify(form) });
      toast('Turno guardado', 'ok');
      setForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarTurno(id: string) {
    if (!window.confirm('¿Eliminar este turno?')) return;
    try {
      await api(`/nomina/turnos/${id}`, { method: 'DELETE' });
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Cuadro de turnos</h1>
          <div className="sub">Semana del {dias[0].toLocaleDateString('es-CO')} al {dias[6].toLocaleDateString('es-CO')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setSemana(new Date(semana.getTime() - 7 * 86400000))}><ChevronLeft size={16} /></button>
          <button className="btn" onClick={() => setSemana(lunesDe(new Date()))}>Hoy</button>
          <button className="btn" onClick={() => setSemana(new Date(semana.getTime() + 7 * 86400000))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Empleado</th>
              {dias.map((d, i) => (
                <th key={i} style={{ padding: 8, textAlign: 'center', minWidth: 110 }}>
                  {DIAS[i]}<br />
                  <span className="sub">{d.getDate()}/{d.getMonth() + 1}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: 8, fontWeight: 600 }}>{u.nombre}</td>
                {dias.map((d) => {
                  const fecha = fmtFecha(d);
                  const t = turnoDe(u.id, fecha);
                  return (
                    <td key={fecha} style={{ padding: 4, textAlign: 'center', border: '1px solid var(--line)' }}>
                      {t ? (
                        <div>
                          <div className="pill ok">{t.tipo}</div>
                          <div className="sub">{t.horaInicio} - {t.horaFin}</div>
                          <button className="btn sm danger" style={{ marginTop: 4 }} onClick={() => eliminarTurno(t.id)}><Trash2 size={11} /></button>
                        </div>
                      ) : (
                        <button className="btn sm" onClick={() => setForm({ userId: u.id, fecha, horaInicio: '18:00', horaFin: '02:00', tipo: 'NOCHE', valor: '0' })}><Plus size={13} /></button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && <div className="sub" style={{ padding: 12 }}>No hay empleados activos.</div>}
      </div>

      <div className="card" style={{ marginTop: 16, background: 'rgba(56,189,248,.05)', borderColor: 'rgba(56,189,248,.25)' }}>
        <h3>¿Cómo funciona el cuadro de turnos?</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: '#8b95a6' }}>
          <li>Las <b style={{ color: '#cbd5e1' }}>filas</b> son los empleados y las <b style={{ color: '#cbd5e1' }}>columnas</b> los días de la semana.</li>
          <li>Haz clic en el <b style={{ color: '#cbd5e1' }}>+</b> de un día para asignar un turno (tipo + hora de entrada y salida).</li>
          <li>Usa las flechas <b style={{ color: '#cbd5e1' }}>◀ ▶</b> para moverte entre semanas, o <b style={{ color: '#cbd5e1' }}>Hoy</b> para volver a la semana actual.</li>
          <li>Para quitar un turno, haz clic en el <b style={{ color: '#f87171' }}>🗑</b> de esa casilla.</li>
          <li>Estos turnos alimentan la <b style={{ color: '#cbd5e1' }}>asistencia</b> y el cálculo de <b style={{ color: '#cbd5e1' }}>nómina</b>.</li>
        </ul>
      </div>

      {form && (
        <div className="modal-bg" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo turno</h2>
            <label>Empleado</label>
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label>Valor del turno (COP)</label>
            <input type="number" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label>Hora inicio</label>
                <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
              </div>
              <div>
                <label>Hora fin</label>
                <input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} />
              </div>
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardar}>Guardar turno</button>
          </div>
        </div>
      )}
    </div>
  );
}
