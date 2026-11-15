import { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

export default function Nomina() {
  const toast = useToast();
  const [conceptos, setConceptos] = useState<any[]>([]);
  const [nominas, setNominas] = useState<any[]>([]);
  const [conceptoForm, setConceptoForm] = useState<any>(null);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [detalle, setDetalle] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  const cargar = useCallback(() => {
    api<any[]>('/nomina/conceptos').then(setConceptos).catch(() => {});
    api<any[]>('/nomina/nominas').then(setNominas).catch(() => {});
    api<any>('/nomina/config').then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarConcepto() {
    if (!conceptoForm?.nombre.trim()) return;
    try {
      if (conceptoForm.id) {
        await api(`/nomina/conceptos/${conceptoForm.id}`, { method: 'PATCH', body: JSON.stringify(conceptoForm) });
      } else {
        await api('/nomina/conceptos', { method: 'POST', body: JSON.stringify(conceptoForm) });
      }
      toast('Concepto guardado', 'ok');
      setConceptoForm(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarConcepto(id: string) {
    if (!window.confirm('¿Eliminar concepto?')) return;
    try {
      await api(`/nomina/conceptos/${id}`, { method: 'DELETE' });
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarConfig() {
    try {
      await api('/nomina/config', { method: 'PATCH', body: JSON.stringify(config) });
      toast('Configuración guardada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function generarNomina() {
    try {
      const n = await api('/nomina/nominas', {
        method: 'POST',
        body: JSON.stringify({ fechaInicio, fechaFin }),
      });
      toast('Nómina generada', 'ok');
      setDetalle(n);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function verNomina(id: string) {
    try {
      setDetalle(await api(`/nomina/nominas/${id}`));
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  function descargarCSV(n: any) {
    const rows: string[][] = [];
    rows.push(['Nómina', n.periodo]);
    rows.push([]);
    rows.push(['Empleado', 'Base', 'Propinas', 'Comisiones', 'Otros', 'Deducciones', 'Prestaciones', 'Aportes', 'Neto']);
    (n.items || []).forEach((i: any) =>
      rows.push([
        i.user?.nombre,
        String(i.base),
        String(i.propinas),
        String(i.comisiones),
        String(i.otrosIngresos),
        String(i.deducciones),
        String(i.provisiones ?? 0),
        String(i.aportes ?? 0),
        String(i.neto),
      ]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina-${n.periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Nómina</h1>
          <div className="sub">Conceptos, liquidación e historial</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Conceptos de nómina</h3>
            <button className="btn primary sm" onClick={() => setConceptoForm({ nombre: '', tipo: 'INGRESO', calculo: 'FIJO', valor: '0' })}>
              <Plus size={14} />
            </button>
          </div>
          {conceptos.length === 0 && <div className="sub">Sin conceptos.</div>}
          {conceptos.map((c) => (
            <div className="list-item" key={c.id}>
              <div className="body">
                <div className="title">{c.nombre}</div>
                <div className="meta">
                  {c.tipo === 'INGRESO' ? 'Ingreso' : 'Deducción'} · {c.calculo} · {c.calculo === 'FIJO' ? fmt(c.valor) : `${c.valor}%`}
                </div>
              </div>
              <button className="btn sm" onClick={() => setConceptoForm({ id: c.id, nombre: c.nombre, tipo: c.tipo, calculo: c.calculo, valor: String(c.valor) })}>
                <Pencil size={13} />
              </button>
              <button className="btn sm danger" onClick={() => eliminarConcepto(c.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Generar nómina</h3>
          <label>Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          <label>Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          <button className="btn primary block" style={{ marginTop: 14 }} onClick={generarNomina}>Generar nómina</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Prestaciones, recargos y aportes</h3>
        <div className="sub" style={{ marginBottom: 12 }}>Porcentajes usados en la liquidación (ajústalos a tu necesidad).</div>
        {config && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {([
                ['prima', 'Prima (%)'],
                ['cesantias', 'Cesantías (%)'],
                ['interesesCesantias', 'Intereses cesantías (%)'],
                ['vacaciones', 'Vacaciones (%)'],
                ['recargoNocturno', 'Recargo nocturno (%)'],
                ['recargoDominical', 'Recargo dominical (%)'],
                ['horaExtraDiurna', 'Hora extra diurna (%)'],
                ['horaExtraNocturna', 'Hora extra nocturna (%)'],
                ['aporteSalud', 'Aporte salud (%)'],
                ['aportePension', 'Aporte pensión (%)'],
                ['aporteArl', 'ARL (%)'],
                ['aporteCaja', 'Caja de compensación (%)'],
              ] as Array<[string, string]>).map(([key, label]) => (
                <div key={key}>
                  <label>{label}</label>
                  <input type="number" step="0.01" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={guardarConfig}>Guardar configuración</button>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Historial de nóminas</h3>
        {nominas.length === 0 && <div className="sub">Aún no hay nóminas.</div>}
        {nominas.map((n) => (
          <div className="list-item" key={n.id}>
            <div className="body">
              <div className="title">Nómina {n.periodo}</div>
              <div className="meta">{n.items?.length || 0} empleados · {new Date(n.createdAt).toLocaleDateString('es-CO')}</div>
            </div>
            <button className="btn sm" onClick={() => verNomina(n.id)}>Ver</button>
            <button className="btn sm" onClick={() => descargarCSV(n)}><Download size={13} /></button>
          </div>
        ))}
      </div>

      {conceptoForm && (
        <div className="modal-bg" onClick={() => setConceptoForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{conceptoForm.id ? 'Editar concepto' : 'Nuevo concepto'}</h2>
            <label>Nombre</label>
            <input value={conceptoForm.nombre} onChange={(e) => setConceptoForm({ ...conceptoForm, nombre: e.target.value })} placeholder="Bono, adelanto, comisión..." autoFocus />
            <label>Tipo</label>
            <select value={conceptoForm.tipo} onChange={(e) => setConceptoForm({ ...conceptoForm, tipo: e.target.value })}>
              <option value="INGRESO">Ingreso</option>
              <option value="DEDUCCION">Deducción</option>
            </select>
            <label>Cálculo</label>
            <select value={conceptoForm.calculo} onChange={(e) => setConceptoForm({ ...conceptoForm, calculo: e.target.value })}>
              <option value="FIJO">Monto fijo</option>
              <option value="PORCENTAJE_BASE">% del sueldo base</option>
              <option value="PORCENTAJE_VENTAS">% de las ventas</option>
            </select>
            <label>Valor {conceptoForm.calculo === 'FIJO' ? '(COP)' : '(%)'}</label>
            <input type="number" value={conceptoForm.valor} onChange={(e) => setConceptoForm({ ...conceptoForm, valor: e.target.value })} placeholder="0" />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarConcepto}>Guardar</button>
          </div>
        </div>
      )}

      {detalle && (
        <div className="modal-bg" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h2>Nómina {detalle.periodo}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 6 }}>Empleado</th>
                    <th style={{ padding: 6 }}>Base</th>
                    <th style={{ padding: 6 }}>Propinas</th>
                    <th style={{ padding: 6 }}>Comisiones</th>
                    <th style={{ padding: 6 }}>Otros</th>
                    <th style={{ padding: 6 }}>Deduc.</th>
                    <th style={{ padding: 6 }}>Prest.</th>
                    <th style={{ padding: 6 }}>Aportes</th>
                    <th style={{ padding: 6 }}>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((i: any) => (
                    <tr key={i.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: 6 }}>{i.user?.nombre}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.base)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.propinas)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.comisiones)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.otrosIngresos)}</td>
                      <td style={{ padding: 6, textAlign: 'right', color: '#f87171' }}>−{fmt(i.deducciones)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.provisiones ?? 0)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmt(i.aportes ?? 0)}</td>
                      <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{fmt(i.neto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn primary block" onClick={() => descargarCSV(detalle)}><Download size={15} /> Descargar CSV</button>
              <button className="btn block" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
