import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../lib/api';

export default function Encuestas() {
  const [data, setData] = useState<any>(null);

  const cargar = useCallback(() => {
    api<any>('/encuestas').then(setData).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Encuestas de satisfacción</h1>
          <div className="sub">Lo que opinan tus clientes</div>
        </div>
      </div>

      {!data && <div className="card"><div className="sub">Cargando…</div></div>}

      {data && (
        <>
          <div className="grid cols-2">
            <div className="card hover stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,179,1,.14)' }}>
                <Star size={22} color="#f5b301" />
              </div>
              <div>
                <div className="stat-val" style={{ color: '#f5b301' }}>{data.promedio} / 5</div>
                <div className="stat-label">Calificación promedio</div>
              </div>
            </div>
            <div className="card hover stat-card">
              <div style={{ fontSize: 32, fontWeight: 800 }}>{data.total}</div>
              <div className="stat-label">Encuestas recibidas</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Comentarios</h3>
            {data.encuestas.length === 0 && <div className="sub">Aún no hay encuestas.</div>}
            {data.encuestas.map((e: any) => (
              <div className="list-item" key={e.id}>
                <div className="emoji-tile" style={{ background: 'rgba(245,179,1,.14)' }}>
                  <Star size={18} color="#f5b301" />
                </div>
                <div className="body">
                  <div className="title">
                    {'★'.repeat(e.estrellas)}{'☆'.repeat(5 - e.estrellas)}
                    <span className="meta" style={{ marginLeft: 8 }}>{e.pedido?.codigo} · Mesa {e.pedido?.mesa?.nombre}</span>
                  </div>
                  {e.comentario && <div className="meta">{e.comentario}</div>}
                </div>
                <span className="meta">{new Date(e.createdAt).toLocaleString('es-CO')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
