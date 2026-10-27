import { useEffect, useState } from 'react';
import { Lightbulb, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../lib/api';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');

export default function Reportes() {
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api(`/reportes?desde=${desde}&hasta=${hasta}`);
      setData(r);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const horasConVentas = (data?.ventasPorHora || []).filter((h: any) => h.total > 0);
  const maxHora = Math.max(1, ...horasConVentas.map((h: any) => h.total));
  const maxDia = Math.max(1, ...(data?.ventasPorDia || []).map((d: any) => d.total));
  const maxTop = Math.max(1, ...(data?.topProductos || []).map((p: any) => p.cantidad));

  function descargarCSV() {
    if (!data) return;
    const rows: string[][] = [];
    rows.push(['Reporte KLUBB', `${data.rango.desde} a ${data.rango.hasta}`]);
    rows.push([]);
    rows.push(['Ventas totales', String(data.ventas.total)]);
    rows.push(['Pedidos', String(data.ventas.pedidos)]);
    rows.push(['Ticket promedio', String(data.ventas.ticketPromedio)]);
    rows.push(['Ganancia', String(data.margen.ganancia)]);
    rows.push(['Margen %', String(data.margen.porcentaje)]);
    rows.push([]);
    rows.push(['Top productos', '', '']);
    rows.push(['Producto', 'Cantidad', 'Total']);
    data.topProductos.forEach((p: any) => rows.push([p.nombre, String(p.cantidad), String(p.total)]));
    rows.push([]);
    rows.push(['Ventas por día', '', '']);
    rows.push(['Fecha', 'Total', 'Pedidos']);
    data.ventasPorDia.forEach((d: any) => rows.push([d.fecha, String(d.total), String(d.pedidos)]));
    rows.push([]);
    rows.push(['Ventas por hora', '', '']);
    rows.push(['Hora', 'Total', '']);
    data.ventasPorHora.forEach((h: any) => rows.push([String(h.hora), String(h.total), '']));
    rows.push([]);
    rows.push(['Por mesero', '', '']);
    rows.push(['Mesero', 'Total', 'Pedidos']);
    data.ventasPorMesero.forEach((m: any) => rows.push([m.nombre, String(m.total), String(m.pedidos)]));

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${data.rango.desde}-${data.rango.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Reportes e Informes</h1>
          <div className="sub">Estadísticas de ventas, márgenes e inventario</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span className="sub">a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <button className="btn" onClick={descargarCSV}>Descargar CSV</button>
          <button className="btn primary" onClick={cargar} disabled={cargando}>
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {!data && (
        <div className="card"><div className="sub">Cargando reporte…</div></div>
      )}

      {data && (
        <>
          <div className="grid cols-3">
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}><Wallet size={22} color="#f5b301" /></div>
              <div>
                <div className="stat-val">{fmt(data.ventas.total)}</div>
                <div className="stat-label">Ventas</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(46,204,113,.14)' }}><TrendingUp size={22} color="#4ade80" /></div>
              <div>
                <div className="stat-val" style={{ color: '#4ade80' }}>{fmt(data.margen.ganancia)}</div>
                <div className="stat-label">Ganancia ({data.margen.porcentaje}%)</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(167,139,250,.14)' }}><ShoppingBag size={22} color="#c4b5fd" /></div>
              <div>
                <div className="stat-val">{data.ventas.pedidos}</div>
                <div className="stat-label">Pedidos · ticket {fmt(data.ventas.ticketPromedio)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Tiempos promedio</h3>
            <div className="list-item">
              <div className="body">
                <div className="title">Ocupación de mesas</div>
                <div className="meta">Desde que se ocupa hasta que se libera</div>
              </div>
              <b>{data.tiempos.ocupacionPromedio} min</b>
            </div>
            <div className="list-item">
              <div className="body">
                <div className="title">Entre pedidos por mesa</div>
                <div className="meta">Cada cuánto pide una mesa</div>
              </div>
              <b>{data.tiempos.entrePedidosPromedio} min</b>
            </div>
            <div className="list-item">
              <div className="body">
                <div className="title">Entrega (Listo → Entregado)</div>
                <div className="meta">Cuánto tarda el mesero en entregar</div>
              </div>
              <b>{data.tiempos.entregaPromedio} min</b>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3><Lightbulb size={16} color="#f5b301" /> Sugerencias</h3>
            {data.sugerencias.map((s: string, i: number) => (
              <div className="list-item" key={i}>
                <div className="body"><div className="title" style={{ fontWeight: 500 }}>{s}</div></div>
              </div>
            ))}
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Top 5 productos más vendidos</h3>
              {data.topProductos.length === 0 && <div className="sub">Sin ventas en el período.</div>}
              {data.topProductos.map((p: any, i: number) => (
                <div key={p.nombre} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span>#{i + 1} {p.nombre}</span>
                    <span>{p.cantidad} und · {fmt(p.total)}</span>
                  </div>
                  <div style={{ background: 'var(--line)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--accent)', height: '100%', width: `${(p.cantidad / maxTop) * 100}%`, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Productividad por mesero</h3>
              {data.ventasPorMesero.length === 0 && <div className="sub">Sin entregas.</div>}
              {data.ventasPorMesero.map((m: any) => (
                <div className="list-item" key={m.nombre}>
                  <div className="body">
                    <div className="title">{m.nombre}</div>
                    <div className="meta">{m.pedidos} pedidos</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>{fmt(m.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Ventas por día</h3>
              {data.ventasPorDia.length === 0 && <div className="sub">Sin ventas.</div>}
              {data.ventasPorDia.map((d: any) => (
                <div key={d.fecha} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{d.fecha}</span>
                    <span>{fmt(d.total)}</span>
                  </div>
                  <div style={{ background: 'var(--line)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: '#4ade80', height: '100%', width: `${(d.total / maxDia) * 100}%`, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Ventas por hora</h3>
              {horasConVentas.length === 0 && <div className="sub">Sin ventas.</div>}
              {horasConVentas.map((h: any) => (
                <div key={h.hora} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{h.hora}:00</span>
                    <span>{fmt(h.total)}</span>
                  </div>
                  <div style={{ background: 'var(--line)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: '#c4b5fd', height: '100%', width: `${(h.total / maxHora) * 100}%`, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Inventario (mínimos y máximos)</h3>
            <div className="sub" style={{ marginBottom: 8 }}>
              {data.inventario.totalActivos} productos activos · {data.inventario.agotados.length} agotados · {data.inventario.bajoMinimo.length} bajo mínimo · {data.inventario.sobreStock.length} sobre stock
            </div>
            {data.inventario.agotados.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                <b style={{ color: '#f87171' }}>Agotados:</b>{' '}
                {data.inventario.agotados.map((p: any) => `${p.emoji || ''} ${p.nombre}`).join(' · ')}
              </div>
            )}
            {data.inventario.bajoMinimo.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                <b style={{ color: '#f5b301' }}>Bajo mínimo:</b>{' '}
                {data.inventario.bajoMinimo.map((p: any) => `${p.nombre} (${p.stock}/${p.stockMinimo})`).join(' · ')}
              </div>
            )}
            {data.inventario.sobreStock.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <b style={{ color: '#4ade80' }}>Sobre stock:</b>{' '}
                {data.inventario.sobreStock.map((p: any) => `${p.nombre} (${p.stock})`).join(' · ')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
