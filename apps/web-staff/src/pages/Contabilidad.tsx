import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { api } from '../lib/api';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

function csvDe(d: any) {
  const rows: string[][] = [];
  rows.push(['Cierre contable', d.mes]);
  rows.push([]);
  rows.push(['Ingresos', fmt(d.ingresos.total)]);
  rows.push(['Subtotal', fmt(d.ingresos.subtotal)]);
  rows.push(['Propinas', fmt(d.ingresos.propinas)]);
  rows.push(['Costo de ventas', fmt(d.costoVentas)]);
  rows.push(['Margen bruto', fmt(d.margenBruto)]);
  rows.push(['Nómina neta', fmt(d.nomina.neto)]);
  rows.push(['Aportes', fmt(d.nomina.aportes)]);
  rows.push(['Provisiones', fmt(d.nomina.provisiones)]);
  rows.push(['Margen neto', fmt(d.margenNeto)]);
  rows.push(['Cierres de caja', String(d.cajas.cierres)]);
  rows.push(['Recaudado en caja', fmt(d.cajas.total)]);
  rows.push(['Pedidos', String(d.pedidos)]);
  rows.push([]);
  rows.push(['Método', 'Monto']);
  Object.entries(d.porMetodo || {}).forEach(([m, v]: any) => rows.push([m, fmt(v)]));
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function Contabilidad() {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api<any>(`/contabilidad/cierre?mes=${mes}`).then(setData).catch(() => {});
  }, [mes]);

  function descargar(ext: 'csv' | 'xls') {
    if (!data) return;
    if (ext === 'csv') {
      const blob = new Blob(['\uFEFF' + csvDe(data)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cierre-${data.mes}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = csvDe(data)
      .split('\n')
      .map((r) => r.split(',').map((c) => c.replace(/^"|"$/g, '')));
    const xml =
      `<?xml version="1.0"?>\n` +
      `<?mso-application progid="Excel.Sheet"?>\n` +
      `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
      `<Worksheet ss:Name="Cierre"><Table>` +
      rows.map((r) => `<Row>${r.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`).join('') +
      `</Table></Worksheet></Workbook>`;
    const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cierre-${data.mes}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={22} color="#f5b301" /> Contabilidad
          </h1>
          <div className="sub">Cierre mensual para el contador</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button className="btn" onClick={() => descargar('csv')} disabled={!data}>CSV</button>
          <button className="btn" onClick={() => descargar('xls')} disabled={!data}>Excel</button>
        </div>
      </div>

      {!data && <div className="card"><div className="sub">Cargando…</div></div>}

      {data && (
        <>
          <div className="grid cols-3">
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}><span>💰</span></div>
              <div>
                <div className="stat-val">{fmt(data.ingresos.total)}</div>
                <div className="stat-label">Ingresos (ventas)</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(239,68,68,.14)' }}><span>📦</span></div>
              <div>
                <div className="stat-val" style={{ color: '#f87171' }}>{fmt(data.costoVentas)}</div>
                <div className="stat-label">Costo de ventas</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(46,204,113,.14)' }}><span>📈</span></div>
              <div>
                <div className="stat-val" style={{ color: '#4ade80' }}>{fmt(data.margenBruto)}</div>
                <div className="stat-label">Margen bruto</div>
              </div>
            </div>
          </div>

          <div className="grid cols-3" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Nómina del mes</h3>
              <div className="list-item"><div className="body"><div className="title">Neto a pagar</div></div><b>{fmt(data.nomina.neto)}</b></div>
              <div className="list-item"><div className="body"><div className="title">Aportes</div></div><b>{fmt(data.nomina.aportes)}</b></div>
              <div className="list-item"><div className="body"><div className="title">Provisiones</div></div><b>{fmt(data.nomina.provisiones)}</b></div>
            </div>
            <div className="card">
              <h3>Caja</h3>
              <div className="list-item"><div className="body"><div className="title">Cierres realizados</div></div><b>{data.cajas.cierres}</b></div>
              <div className="list-item"><div className="body"><div className="title">Total recaudado</div></div><b>{fmt(data.cajas.total)}</b></div>
              <div className="list-item"><div className="body"><div className="title">Pedidos del mes</div></div><b>{data.pedidos}</b></div>
            </div>
            <div className="card">
              <h3>Resultado</h3>
              <div className="list-item"><div className="body"><div className="title">Margen neto (bruto − nómina)</div></div><b style={{ color: data.margenNeto >= 0 ? '#4ade80' : '#f87171' }}>{fmt(data.margenNeto)}</b></div>
              <div className="list-item"><div className="body"><div className="title">Propinas</div></div><b>{fmt(data.ingresos.propinas)}</b></div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Ingresos por método de pago</h3>
            {Object.keys(data.porMetodo || {}).length === 0 && <div className="sub">Sin pagos en el período.</div>}
            {Object.entries(data.porMetodo || {}).map(([m, v]: any) => (
              <div className="list-item" key={m}>
                <div className="body"><div className="title">{m}</div></div>
                <b>{fmt(v)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
