import { useCallback, useEffect, useState } from 'react';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

export default function Puntos() {
  const toast = useToast();
  const [config, setConfig] = useState<any>(null);
  const [montoBase, setMontoBase] = useState('1000');
  const [puntosBase, setPuntosBase] = useState('1');
  const [nivelModal, setNivelModal] = useState<{ id?: string; nombre: string; puntosRequeridos: string } | null>(null);

  const cargar = useCallback(() => {
    api<any>('/puntos').then((c) => {
      setConfig(c);
      setMontoBase(String(c.montoBase ?? 1000));
      setPuntosBase(String(c.puntosBase ?? 1));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(parcial: any) {
    try {
      await api('/puntos', { method: 'PATCH', body: JSON.stringify(parcial) });
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarNumeros() {
    await guardar({ montoBase: Number(montoBase || 0), puntosBase: Number(puntosBase || 0) });
    toast('Valores guardados', 'ok');
  }

  async function guardarNivel() {
    if (!nivelModal?.nombre.trim()) return;
    const body = {
      nombre: nivelModal.nombre,
      puntosRequeridos: Number(nivelModal.puntosRequeridos || 0),
    };
    try {
      if (nivelModal.id) {
        await api(`/puntos/niveles/${nivelModal.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('Nivel actualizado', 'ok');
      } else {
        await api('/puntos/niveles', { method: 'POST', body: JSON.stringify(body) });
        toast('Nivel creado', 'ok');
      }
      setNivelModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarNivel(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar el nivel "${nombre}"?`)) return;
    try {
      await api(`/puntos/niveles/${id}`, { method: 'DELETE' });
      toast('Nivel eliminado', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  const niveles = config?.niveles ?? [];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Sistema de Puntos</h1>
          <div className="sub">Configura cómo tus clientes acumulan y suben de nivel</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Habilitación</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!config?.habilitado}
            onChange={(e) => guardar({ habilitado: e.target.checked })}
          />
          Habilitar sistema de puntos
        </label>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Modo de acumulación</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`pill ${config?.modo === 'CONSUMO' ? 'ok' : 'mute'}`} style={{ cursor: 'pointer' }} onClick={() => guardar({ modo: 'CONSUMO' })}>
            Por consumo ($)
          </button>
          <button className={`pill ${config?.modo === 'PRODUCTO' ? 'ok' : 'mute'}`} style={{ cursor: 'pointer' }} onClick={() => guardar({ modo: 'PRODUCTO' })}>
            Por producto
          </button>
        </div>
        {config?.modo === 'CONSUMO' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginTop: 14, alignItems: 'end' }}>
            <div>
              <label>Cada X pesos consumidos</label>
              <input type="number" value={montoBase} onChange={(e) => setMontoBase(e.target.value)} placeholder="1000" />
            </div>
            <div>
              <label>Otorga Y puntos</label>
              <input type="number" value={puntosBase} onChange={(e) => setPuntosBase(e.target.value)} placeholder="1" />
            </div>
            <button className="btn primary" onClick={guardarNumeros}>Guardar</button>
          </div>
        )}
        {config?.modo === 'PRODUCTO' && (
          <div className="sub" style={{ marginTop: 10 }}>
            En este modo, cada producto define sus propios puntos (se edita en la página de Productos).
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Niveles (categorías)</h3>
          <button className="btn primary" onClick={() => setNivelModal({ nombre: '', puntosRequeridos: '0' })}>
            <Plus size={16} /> Nivel
          </button>
        </div>
        <div className="sub" style={{ marginBottom: 10 }}>Define los nombres y cuántos puntos se requieren para cada nivel.</div>
        {niveles.length === 0 && <div className="sub">Aún no has creado niveles.</div>}
        {niveles.map((n: any) => (
          <div className="list-item" key={n.id}>
            <div className="emoji-tile"><Award size={18} color="#f5b301" /></div>
            <div className="body">
              <div className="title">{n.nombre}</div>
              <div className="meta">Requiere {n.puntosRequeridos} puntos</div>
            </div>
            <button className="btn sm" onClick={() => setNivelModal({ id: n.id, nombre: n.nombre, puntosRequeridos: String(n.puntosRequeridos) })}>
              <Pencil size={13} />
            </button>
            <button className="btn sm danger" onClick={() => eliminarNivel(n.id, n.nombre)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {nivelModal && (
        <div className="modal-bg" onClick={() => setNivelModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{nivelModal.id ? 'Editar nivel' : 'Nuevo nivel'}</h2>
            <label>Nombre</label>
            <input value={nivelModal.nombre} onChange={(e) => setNivelModal({ ...nivelModal, nombre: e.target.value })} placeholder="Oro" autoFocus />
            <label>Puntos requeridos</label>
            <input type="number" value={nivelModal.puntosRequeridos} onChange={(e) => setNivelModal({ ...nivelModal, puntosRequeridos: e.target.value })} placeholder="500" />
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarNivel}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
