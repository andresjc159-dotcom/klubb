import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { api } from '../lib/api';

const METODO_COLOR: Record<string, string> = {
  POST: '#4ade80',
  PATCH: '#38bdf8',
  PUT: '#38bdf8',
  DELETE: '#f87171',
};

function resumen(detalle: any): string {
  if (!detalle || typeof detalle !== 'object') return '';
  const keys = Object.keys(detalle);
  if (keys.length === 0) return '';
  const omitir = ['tenantId', 'marcaId'];
  const relevantes = keys.filter((k) => !omitir.includes(k)).slice(0, 4);
  return relevantes
    .map((k) => {
      const v = detalle[k];
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${val.length > 30 ? val.slice(0, 30) + '…' : val}`;
    })
    .join(' · ');
}

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api<any[]>('/auditoria')
      .then(setLogs)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={22} color="#f5b301" /> Auditoría
          </h1>
          <div className="sub">Registro de cambios: quién editó qué y cuándo</div>
        </div>
      </div>

      <div className="card">
        {cargando && <div className="sub">Cargando…</div>}
        {!cargando && logs.length === 0 && (
          <div className="sub">Aún no hay movimientos registrados.</div>
        )}
        {logs.map((l) => (
          <div
            key={l.id}
            className="list-item"
            style={{ alignItems: 'flex-start', padding: '12px 0' }}
          >
            <div
              className="stat-icon"
              style={{
                background: 'rgba(56,189,248,.12)',
                minWidth: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 11, color: METODO_COLOR[l.accion] || '#cbd5e1' }}>
                {l.accion}
              </span>
            </div>
            <div className="body">
              <div className="title" style={{ fontSize: 14 }}>
                {l.userName || 'Sistema'} · <span style={{ color: '#8b95a6' }}>{l.entidad}</span>
              </div>
              <div className="meta">
                {resumen(l.detalle)}
              </div>
            </div>
            <div className="sub" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {new Date(l.createdAt).toLocaleString('es-CO')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
