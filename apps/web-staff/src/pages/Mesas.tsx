import { useCallback, useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Armchair, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const CLIENT_URL = window.location.origin;

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function Mesas() {
  const toast = useToast();
  const [zonas, setZonas] = useState<any[]>([]);
  const [meseros, setMeseros] = useState<any[]>([]);
  const [asignacionMesa, setAsignacionMesa] = useState<Record<string, string>>({});

  const [zonaModal, setZonaModal] = useState<{ id?: string; nombre: string } | null>(null);
  const [mesaModal, setMesaModal] = useState<{ id?: string; zonaId: string; nombre: string; capacidad: number; meseroId?: string } | null>(null);
  const [qrModal, setQrModal] = useState<{ mesa: any; qr: string } | null>(null);

  const cargar = useCallback(() => {
    Promise.all([api<any[]>('/zonas'), api<any[]>('/asignaciones')])
      .then(([z, a]) => {
        setZonas(z);
        setMeseros(a);
        const mapa: Record<string, string> = {};
        for (const m of a) for (const mesa of m.mesas) mapa[mesa.id] = m.id;
        setAsignacionMesa(mapa);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarZona() {
    if (!zonaModal?.nombre.trim()) return;
    try {
      if (zonaModal.id) {
        await api(`/zonas/${zonaModal.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: zonaModal.nombre }) });
        toast('Zona actualizada', 'ok');
      } else {
        await api('/zonas', { method: 'POST', body: JSON.stringify({ nombre: zonaModal.nombre }) });
        toast('Zona creada', 'ok');
      }
      setZonaModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function guardarMesa() {
    if (!mesaModal?.nombre.trim() || !mesaModal.zonaId) return;
    try {
      let mesaId = mesaModal.id;
      if (mesaModal.id) {
        await api(`/mesas/${mesaModal.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre: mesaModal.nombre, zonaId: mesaModal.zonaId, capacidad: mesaModal.capacidad }),
        });
      } else {
        const creada = await api<any>('/mesas', {
          method: 'POST',
          body: JSON.stringify({ zonaId: mesaModal.zonaId, nombre: mesaModal.nombre, capacidad: mesaModal.capacidad }),
        });
        mesaId = creada.id;
      }
      if (mesaId && mesaModal.meseroId !== undefined) {
        await api(`/mesas/${mesaId}/asignar`, {
          method: 'POST',
          body: JSON.stringify({ meseroId: mesaModal.meseroId || null }),
        });
      }
      toast('Mesa guardada', 'ok');
      setMesaModal(null);
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarZona(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar la zona "${nombre}"?`)) return;
    try {
      await api(`/zonas/${id}`, { method: 'DELETE' });
      toast('Zona eliminada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function eliminarMesa(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar la mesa "${nombre}"?`)) return;
    try {
      await api(`/mesas/${id}`, { method: 'DELETE' });
      toast('Mesa eliminada', 'ok');
      cargar();
    } catch (e: any) {
      toast(e.message || 'Error', 'bad');
    }
  }

  async function verQR(mesa: any) {
    const url = `${CLIENT_URL}/?qr=${mesa.qrToken}`;
    const qr = await QRCode.toDataURL(url, { width: 400 });
    setQrModal({ mesa, qr });
  }

  const totalMesas = zonas.reduce((a, z) => a + z.mesas.length, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Mesas y Zonas</h1>
          <div className="sub">
            {zonas.length} zonas · {totalMesas} mesas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setZonaModal({ nombre: '' })}><Plus size={16} /> Nueva zona</button>
          <button className="btn primary" onClick={() => setMesaModal({ zonaId: zonas[0]?.id || '', nombre: '', capacidad: 4 })}>
            <Plus size={16} /> Crear mesa
          </button>
        </div>
      </div>

      <div className="zone-grid">
        {zonas.map((z) => (
          <div className="card" key={z.id}>
            <h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="#8b95a6" /> {z.nombre}
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="pill mute">{z.mesas.length} mesas</span>
                <button className="btn sm" onClick={() => setMesaModal({ zonaId: z.id, nombre: '', capacidad: 4 })}><Plus size={14} /> Mesa</button>
                <button className="btn sm" onClick={() => setZonaModal({ id: z.id, nombre: z.nombre })}><Pencil size={13} /></button>
                <button className="btn sm danger" onClick={() => eliminarZona(z.id, z.nombre)}><Trash2 size={13} /></button>
              </span>
            </h3>
            <div className="mesa-grid">
              {z.mesas.map((m: any) => (
                <div className={`mesa ${m.estado.toLowerCase()}`} key={m.id} onClick={() => verQR(m)}>
                  <div className="num">{m.nombre}</div>
                  <div className="zona">{m.capacidad} personas</div>
                  <div className="zona" style={{ color: asignacionMesa[m.id] ? '#f5b301' : 'var(--muted)' }}>
                    {asignacionMesa[m.id] ? meseros.find((x) => x.id === asignacionMesa[m.id])?.nombre : 'Sin mesero'}
                  </div>
                  <div className="estado">
                    <span className={`pill ${m.estado === 'LIBRE' ? 'ok' : m.estado === 'OCUPADA' ? 'warn' : 'info'}`}>
                      {m.estado.toLowerCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMesaModal({ id: m.id, zonaId: m.zonaId, nombre: m.nombre, capacidad: m.capacidad, meseroId: asignacionMesa[m.id] || '' }); }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); eliminarMesa(m.id, m.nombre); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {z.mesas.length === 0 && <div className="sub">Sin mesas en esta zona.</div>}
            </div>
          </div>
        ))}
        {zonas.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Armchair size={40} color="#8b95a6" /></div>
            <div className="sub">Aún no tienes zonas. Crea la primera zona y empieza a armar tu mapa.</div>
          </div>
        )}
      </div>

      {zonaModal && (
        <Modal onClose={() => setZonaModal(null)}>
          <h2>{zonaModal.id ? 'Editar zona' : 'Nueva zona'}</h2>
          <div className="sub">Ej: VIP, Terraza, Barra principal, Palcos</div>
          <label>Nombre de la zona</label>
          <input value={zonaModal.nombre} onChange={(e) => setZonaModal({ ...zonaModal, nombre: e.target.value })} placeholder="VIP" autoFocus />
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarZona}>
            Guardar zona
          </button>
        </Modal>
      )}

      {mesaModal && (
        <Modal onClose={() => setMesaModal(null)}>
          <h2>{mesaModal.id ? 'Editar mesa' : 'Crear mesa'}</h2>
          <div className="sub">El QR se genera automáticamente y es único.</div>
          <label>Nombre / número</label>
          <input value={mesaModal.nombre} onChange={(e) => setMesaModal({ ...mesaModal, nombre: e.target.value })} placeholder="Mesa 9" autoFocus />
          <label>Zona</label>
          <select value={mesaModal.zonaId} onChange={(e) => setMesaModal({ ...mesaModal, zonaId: e.target.value })}>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>{z.nombre}</option>
            ))}
          </select>
          <label>Capacidad</label>
          <input type="number" value={mesaModal.capacidad} onChange={(e) => setMesaModal({ ...mesaModal, capacidad: Number(e.target.value) })} min={1} />
          <label>Mesero asignado</label>
          <select value={mesaModal.meseroId || ''} onChange={(e) => setMesaModal({ ...mesaModal, meseroId: e.target.value || undefined })}>
            <option value="">Sin asignar</option>
            {meseros.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={guardarMesa}>
            Guardar mesa
          </button>
        </Modal>
      )}

      {qrModal && (
        <Modal onClose={() => setQrModal(null)}>
          <h2>{qrModal.mesa.nombre}</h2>
          <div className="sub">Escanea para pedir desde la mesa · token {qrModal.mesa.qrToken}</div>
          <div style={{ textAlign: 'center' }}>
            <div className="qr-box">
              <img src={qrModal.qr} alt="QR" />
            </div>
          </div>
          <a className="btn primary block" style={{ marginTop: 16 }} href={qrModal.qr} download={`${qrModal.mesa.qrToken}.png`}>
            ⬇ Descargar QR
          </a>
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => setQrModal(null)}>
            Cerrar
          </button>
        </Modal>
      )}
    </div>
  );
}
