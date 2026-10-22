import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Check,
  Heart,
  Music2,
  Play,
  Plus,
  Send,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { api, getToken } from '../lib/api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';

export default function Dj() {
  const { user } = useAuth();
  const toast = useToast();
  const [canciones, setCanciones] = useState<any[]>([]);
  const [preferidos, setPreferidos] = useState<any[]>([]);
  const [tema, setTema] = useState('');
  const [temaPref, setTemaPref] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const cargar = useCallback(() => {
    api<any[]>('/canciones').then(setCanciones).catch(console.error);
  }, []);

  const cargarPreferidos = useCallback(() => {
    api<any[]>('/canciones/preferidos').then(setPreferidos).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
    cargarPreferidos();
    const socket = io('/ws', { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on('connect', () => {
      const tenantId = user?.tenantActivoId ?? user?.tenantId;
      if (tenantId) socket.emit('join-tenant', { tenantId });
    });
    socket.on('cancion:nueva', cargar);
    socket.on('cancion:actualizada', cargar);
    return () => {
      socket.disconnect();
    };
  }, [cargar, cargarPreferidos, user]);

  const sonando = useMemo(() => canciones.filter((c) => c.estado === 'SONANDO'), [canciones]);
  const cola = useMemo(() => canciones.filter((c) => c.estado === 'PENDIENTE'), [canciones]);

  async function cambiarEstado(id: string, estado: string) {
    await api(`/canciones/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) });
    cargar();
  }

  async function proponer() {
    if (!tema.trim()) return;
    await api('/canciones/proponer', { method: 'POST', body: JSON.stringify({ tema: tema.trim() }) });
    setTema('');
    toast('Canción propuesta a votación', 'ok');
    cargar();
  }

  async function agregarPreferido() {
    if (!temaPref.trim()) return;
    await api('/canciones/preferidos', { method: 'POST', body: JSON.stringify({ tema: temaPref.trim() }) });
    setTemaPref('');
    cargarPreferidos();
  }

  async function eliminarPreferido(id: string) {
    await api(`/canciones/preferidos/${id}`, { method: 'DELETE' });
    cargarPreferidos();
  }

  async function enviarPreferido(id: string) {
    await api(`/canciones/preferidos/${id}/enviar`, { method: 'POST' });
    toast('Preferido enviado a la cola', 'ok');
    cargar();
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Music2 size={22} color="#f5b301" /> Cabina del DJ
          </h1>
          <div className="sub">Cola de canciones pedidas y propuestas</div>
        </div>
        <span className="pill ok">● En vivo</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Proponer canción para que vote la gente</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Artista — Canción" />
          <button className="btn primary" onClick={proponer}><Plus size={16} /> Proponer</button>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Sonando ahora</h3>
          {sonando.length === 0 && <div className="sub">Nada sonando.</div>}
          {sonando.map((c) => (
            <div className="list-item" key={c.id}>
              <div className="emoji-tile"><Music2 size={18} color="#f5b301" /></div>
              <div className="body">
                <div className="title">{c.tema}</div>
                <div className="meta">
                  {c.origen === 'DJ' ? 'Propuesta del DJ' : `Mesa ${c.mesa?.nombre}`} · {c.votos} votos
                </div>
              </div>
              <button className="btn sm" onClick={() => cambiarEstado(c.id, 'YA_PUESTA')}>
                <Check size={14} /> Ya la puse
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Cola por votación <span className="pill mute">{cola.length}</span></h3>
          {cola.length === 0 && <div className="sub">Sin canciones en cola.</div>}
          {cola.map((c) => (
            <div className="list-item" key={c.id}>
              <div className="emoji-tile"><Music2 size={18} color="#8b95a6" /></div>
              <div className="body">
                <div className="title">{c.tema}</div>
                <div className="meta">
                  {c.origen === 'DJ' ? 'Propuesta del DJ' : `Mesa ${c.mesa?.nombre}`}
                </div>
              </div>
              <span className="pill info"><ThumbsUp size={12} /> {c.votos}</span>
              <button className="btn primary sm" onClick={() => cambiarEstado(c.id, 'SONANDO')}>
                <Play size={14} /> Poner
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3><Heart size={16} color="#f87171" /> Preferidos</h3>
        <div className="sub" style={{ margin: '0 0 10px' }}>Tu librería de canciones para lanzar a la cola rápidamente.</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input value={temaPref} onChange={(e) => setTemaPref(e.target.value)} placeholder="Añadir a preferidos…" />
          <button className="btn" onClick={agregarPreferido}><Plus size={16} /> Añadir</button>
        </div>
        {preferidos.length === 0 && <div className="sub">Aún no tienes preferidos.</div>}
        {preferidos.map((p) => (
          <div className="list-item" key={p.id}>
            <div className="emoji-tile"><Heart size={18} color="#f87171" /></div>
            <div className="body"><div className="title">{p.tema}</div></div>
            <button className="btn sm" onClick={() => enviarPreferido(p.id)}><Send size={14} /> A la cola</button>
            <button className="btn sm danger" onClick={() => eliminarPreferido(p.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
