import { useCallback, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowRight,
  Armchair,
  ChevronLeft,
  KeyRound,
  LogIn,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { useI18n } from './i18n';

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  emoji: string;
  imagenUrl?: string;
  descripcion?: string;
}
interface Categoria {
  id: string;
  nombre: string;
  icono: string;
  productos: Producto[];
}
interface Promocion {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  descuento: number;
  precio?: number;
  imagenUrl?: string;
  productos: Producto[];
  items?: Array<{ productoId: string; cantidad: number; producto?: Producto }>;
}
interface Menu {
  abierto?: boolean;
  mensaje?: string;
  tenant: { id: string; nombre: string; mensajeBienvenida: string; logoUrl?: string; colorPrimario?: string; colorMarca?: string };
  mesa: { id: string; nombre: string; zona: string };
  mesero?: { nombre: string; fotoUrl?: string } | null;
  sesion: null | { id: string; activo: boolean; miembros: { id: string; alias: string }[] };
  metodosPago?: string[];
  categorias: Categoria[];
  promociones: Promocion[];
  configPuntos?: { habilitado: boolean; modo: string; montoBase: number; puntosBase: number } | null;
  niveles?: { id: string; nombre: string; puntosRequeridos: number }[];
}
interface Miembro {
  miembroId: string;
  sesionId: string;
  alias: string;
  codigo?: string;
  token?: string;
}

const LS = (mesaId: string) => `klubb_miembro_${mesaId}`;

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const lighten = (hex: string, amt = 0.2) => {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
};

function BrandLogo({ logo, nombre }: { logo?: string; nombre: string }) {
  return logo ? (
    <img src={logo} alt={nombre} style={{ width: 84, height: 84, borderRadius: 24, objectFit: 'cover', margin: '0 auto 18px', boxShadow: '0 0 44px rgba(0,0,0,.25)' }} />
  ) : (
    <div className="brand-mark">{nombre[0]}</div>
  );
}

function LangToggle({ lang, setLang }: { lang: string; setLang: (l: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
      {['ES', 'EN'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l.toLowerCase())}
          style={{
            background: lang === l.toLowerCase() ? 'var(--accent)' : 'rgba(255,255,255,.08)',
            color: lang === l.toLowerCase() ? '#1a1204' : 'var(--text)',
            border: 'none',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  DAVIPLATA: 'Daviplata',
  TRANSFERENCIA: 'Transferencia',
  WOMPI: 'Wompi (online)',
};

function progresoNivel(cliente: any, niveles: any[]) {
  const ordenados = (niveles || []).slice().sort((a, b) => a.puntosRequeridos - b.puntosRequeridos);
  const puntos = cliente?.puntos || 0;
  const actual = ordenados.find((n) => n.nombre === cliente?.nivel);
  const base = actual?.puntosRequeridos || 0;
  const siguiente = ordenados.find((n) => n.puntosRequeridos > puntos);
  let pct = 100;
  let faltan = 0;
  if (siguiente) {
    const rango = siguiente.puntosRequeridos - base;
    pct = rango > 0 ? Math.min(100, Math.round(((puntos - base) / rango) * 100)) : 100;
    faltan = Math.max(0, siguiente.puntosRequeridos - puntos);
  }
  return { nivel: cliente?.nivel || 'Sin nivel', puntos, siguiente: siguiente?.nombre, faltan, pct };
}

const ESTADO_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const ESTADO_PILL: Record<string, string> = {
  RECIBIDO: 'warn',
  EN_PREPARACION: 'info',
  LISTO: 'ok',
  ENTREGADO: 'ok',
  CANCELADO: 'bad',
};

function useMenu() {
  const qr = useMemo(() => new URLSearchParams(window.location.search).get('qr'), []);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cerrado, setCerrado] = useState<{ mensaje: string; nombre?: string; logoUrl?: string; colorPrimario?: string; colorMarca?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!qr) {
      setError('scan.qr');
      return;
    }
    fetch(`/api/public/menu?qr=${encodeURIComponent(qr)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return setError('mesa.noEncontrada');
        if (data.abierto === false) return setCerrado({ mensaje: data.mensaje, nombre: data.tenant?.nombre, logoUrl: data.tenant?.logoUrl, colorPrimario: data.tenant?.colorPrimario, colorMarca: data.tenant?.colorMarca });
        setMenu(data);
      })
      .catch(() => setError('menu.error'));
  }, [qr]);

  return { qr, menu, cerrado, error };
}

export default function App() {
  const { qr, menu, cerrado, error } = useMenu();
  const { t, lang, setLang } = useI18n();

  useEffect(() => {
    const color = menu?.tenant?.colorPrimario || cerrado?.colorPrimario;
    if (color) {
      const root = document.documentElement;
      root.style.setProperty('--accent', color);
      root.style.setProperty('--accent2', lighten(color));
    }
    const letra = menu?.tenant?.colorMarca || cerrado?.colorMarca;
    if (letra) document.documentElement.style.setProperty('--marca-letra', letra);
  }, [menu, cerrado]);

  const [miembro, setMiembro] = useState<Miembro | null>(null);
  const [tab, setTab] = useState<'menu' | 'cuenta' | 'musica'>('menu');
  const [catId, setCatId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartPromos, setCartPromos] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [modo, setModo] = useState<'MESA' | 'PICKUP'>('MESA');
  const [propina, setPropina] = useState(0);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [resultado, setResultado] = useState<{ codigo: string; pin: number } | null>(null);
  const [estado, setEstado] = useState('');
  const [pedidoActivo, setPedidoActivo] = useState<{ id: string; codigo: string } | null>(null);
  const [canciones, setCanciones] = useState<any[]>([]);
  const [tema, setTema] = useState('');
  const [aviso, setAviso] = useState('');
  const [nivelUp, setNivelUp] = useState<any>(null);
  const [productoModal, setProductoModal] = useState<any>(null);
  const [encuestaModal, setEncuestaModal] = useState(false);
  const [despedida, setDespedida] = useState(false);
  const [localCerrado, setLocalCerrado] = useState(false);
  const [bienvenida, setBienvenida] = useState(false);
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState('');
  const [verCodigo, setVerCodigo] = useState(false);
  const [avisoPrep, setAvisoPrep] = useState(false);
  const [sesion, setSesion] = useState<any>(null);

  // flujo de ingreso
  const [joinStep, setJoinStep] = useState<'landing' | 'alias' | 'codigo'>('landing');
  const [alias, setAlias] = useState('');
  const [codigo, setCodigo] = useState('');
  const [joinCtx, setJoinCtx] = useState<'crear' | 'unirse'>('crear');
  const [cliente, setCliente] = useState<any>(null);
  const [clienteToken, setClienteToken] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'login' | 'registro' | null>(null);
  const [tel, setTel] = useState('');
  const [pass, setPass] = useState('');
  const [nom, setNom] = useState('');
  const [authErr, setAuthErr] = useState('');

  // cargar miembro guardado
  useEffect(() => {
    if (!menu) return;
    const c = localStorage.getItem('klubb_cliente');
    if (c) {
      try { setCliente(JSON.parse(c)); } catch { localStorage.removeItem('klubb_cliente'); }
    }
    setClienteToken(localStorage.getItem('klubb_cliente_token'));
    const raw = localStorage.getItem(LS(menu.mesa.id));
    if (raw) {
      try {
        const m = JSON.parse(raw);
        if (m.sesionId === menu.sesion?.id) setMiembro(m);
        else localStorage.removeItem(LS(menu.mesa.id));
      } catch {
        localStorage.removeItem(LS(menu.mesa.id));
      }
    }
    if (menu.sesion === null) setJoinStep('landing');
    else setJoinStep('codigo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  useEffect(() => {
    if (miembro && menu?.mesero) setBienvenida(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembro, menu]);

  useEffect(() => {
    if (menu && menu.categorias.length && !catId) setCatId(menu.categorias[0].id);
  }, [menu, catId]);

  const cargarSesion = useCallback(() => {
    if (!miembro) return;
    fetch(`/api/public/sesion/${miembro.sesionId}`, {
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSesion(d);
      })
      .catch(() => {});
  }, [miembro]);

  useEffect(() => {
    if (miembro) cargarSesion();
  }, [miembro, cargarSesion]);

  // socket
  useEffect(() => {
    if (!menu || !miembro) return;
    const socket: Socket = io('/ws', { auth: { token: miembro.token } });
    socket.on('connect', () => socket.emit('join-mesa', { mesaId: menu.mesa.id }));
    socket.on('pedido:estado', (d: any) => {
      setEstado(d.estado);
      if (d.estado === 'ENTREGADO') setEncuestaModal(true);
      if ((d.estado === 'LISTO' || d.estado === 'ENTREGADO') && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(t('notif.listo.titulo'), {
          body: d.estado === 'LISTO' ? t('notif.listo') : t('notif.entregado'),
        });
      }
    });
    socket.on('mesa:actualizada', () => cargarSesion());
    socket.on('cancion:nueva', refrescarCanciones);
    socket.on('cancion:actualizada', refrescarCanciones);
    socket.on('cliente:subio-nivel', (d: any) => {
      if (d.miembroId === miembro.miembroId) {
        setNivelUp(d);
        setCliente((c: any) => (c ? { ...c, puntos: d.puntos, nivel: d.nuevoNivel } : c));
      }
    });
    socket.on('pedido:pagado', () => {
      setPedidoActivo(null);
      setEstado('');
      setAviso(t('pago.recibido'));
      setTimeout(() => setAviso(''), 3000);
    });
    socket.on('mesa:liberada', () => {
      if (menu) localStorage.removeItem(LS(menu.mesa.id));
      setMiembro(null);
      setDespedida(true);
    });
    socket.on('local:cerrado', () => {
      if (menu) localStorage.removeItem(LS(menu.mesa.id));
      setMiembro(null);
      setLocalCerrado(true);
    });
    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, miembro, cargarSesion]);

  function refrescarCanciones() {
    if (!miembro) return;
    fetch('/api/public/canciones', {
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCanciones(Array.isArray(data) ? data : []))
      .catch(() => setCanciones([]));
  }

  useEffect(() => {
    if (menu && miembro) refrescarCanciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, miembro]);

  async function crearSesion() {
    if (!alias.trim() || !menu) return;
    const res = await fetch('/api/public/sesion/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: menu.mesa.id, alias: alias.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Error');
    const m: Miembro = { miembroId: data.miembroId, sesionId: data.sesionId, alias: alias.trim(), codigo: data.codigo, token: data.token };
    localStorage.setItem(LS(menu.mesa.id), JSON.stringify(m));
    setMiembro(m);
    setAlias('');
  }

  async function crearSesionCon(c: any) {
    if (!menu) return;
    const res = await fetch('/api/public/sesion/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(clienteToken ? { Authorization: `Bearer ${clienteToken}` } : {}) },
      body: JSON.stringify({ mesaId: menu.mesa.id, alias: c.nombre }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Error');
    const m: Miembro = { miembroId: data.miembroId, sesionId: data.sesionId, alias: c.nombre, codigo: data.codigo, token: data.token };
    localStorage.setItem(LS(menu.mesa.id), JSON.stringify(m));
    setMiembro(m);
  }

  async function unirse() {
    if (!codigo.trim() || !menu) return;
    const nombreAlias = cliente ? cliente.nombre : alias.trim();
    if (!nombreAlias) return;
    const res = await fetch('/api/public/sesion/unirse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(clienteToken ? { Authorization: `Bearer ${clienteToken}` } : {}) },
      body: JSON.stringify({ mesaId: menu.mesa.id, codigo: codigo.trim(), alias: nombreAlias }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || t('codigo.incorrecto'));
    const m: Miembro = { miembroId: data.miembroId, sesionId: data.sesionId, alias: nombreAlias, token: data.token };
    localStorage.setItem(LS(menu.mesa.id), JSON.stringify(m));
    setMiembro(m);
    setAlias('');
    setCodigo('');
  }

  async function loginCliente() {
    setAuthErr('');
    if (!tel.trim() || !pass || !menu) return setAuthErr(t('completa.campos'));
    const res = await fetch('/api/public/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: menu.mesa.id, telefono: tel.trim(), password: pass }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthErr(data.message || t('error.login'));
    localStorage.setItem('klubb_cliente', JSON.stringify(data));
    localStorage.setItem('klubb_cliente_token', data.token);
    setCliente(data);
    setClienteToken(data.token);
    setAuthStep(null);
    if (menu.sesion === null) await crearSesionCon(data);
    else setJoinStep('codigo');
  }

  async function registrarCliente() {
    setAuthErr('');
    if (!nom.trim() || !tel.trim() || !pass || !menu) return setAuthErr(t('completa.campos'));
    const res = await fetch('/api/public/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: menu.mesa.id, nombre: nom.trim(), telefono: tel.trim(), password: pass }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthErr(data.message || t('error.registro'));
    localStorage.setItem('klubb_cliente', JSON.stringify(data));
    localStorage.setItem('klubb_cliente_token', data.token);
    setCliente(data);
    setClienteToken(data.token);
    setAuthStep(null);
    if (menu.sesion === null) await crearSesionCon(data);
    else setJoinStep('codigo');
  }

  const cat = menu?.categorias.find((c) => c.id === catId) || menu?.categorias[0];
  const cantidad = (id: string) => cart[id] || 0;
  const toggle = (id: string, d: number) =>
    setCart((prev) => {
      const n = { ...prev };
      const q = (n[id] || 0) + d;
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  const cantidadCombo = (id: string) => cartPromos[id] || 0;
  const toggleCombo = (id: string, d: number) =>
    setCartPromos((prev) => {
      const n = { ...prev };
      const q = (n[id] || 0) + d;
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });

  const items = Object.entries(cart)
    .map(([id, q]) => {
      const p = menu?.categorias.flatMap((c) => c.productos).find((x) => x.id === id);
      return p ? { productoId: id, cantidad: q, nombre: p.nombre, precio: p.precio } : null;
    })
    .filter(Boolean) as Array<{ productoId: string; cantidad: number; nombre: string; precio: number }>;

  const comboItems = Object.entries(cartPromos)
    .map(([id, q]) => {
      const promo = menu?.promociones.find((p) => p.id === id);
      return promo ? { promocionId: id, cantidad: q, nombre: promo.nombre, precio: promo.precio ?? 0 } : null;
    })
    .filter(Boolean) as Array<{ promocionId: string; cantidad: number; nombre: string; precio: number }>;

  const subtotal =
    items.reduce((s, i) => s + i.precio * i.cantidad, 0) +
    comboItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalArticulos = items.length + comboItems.length;
  const totalPropina = Math.round((subtotal * propina) / 100);
  const total = subtotal + totalPropina;

  function limpiarSesion() {
    if (menu) localStorage.removeItem(LS(menu.mesa.id));
    setMiembro(null);
    setJoinStep('landing');
    setPedidoActivo(null);
    setCart({});
    setCartPromos({});
    setCheckout(false);
  }

  async function pagar() {
    if (!menu || !miembro) return;
    setResultado(null);
    const res = await fetch('/api/public/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${miembro.token}` },
      body: JSON.stringify({
        modo,
        propina: totalPropina,
        metodoPago,
        items: [
          ...items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
          ...comboItems.map((c) => ({ promocionId: c.promocionId, cantidad: c.cantidad })),
        ],
      }),
    });
    const data = await res.json();
    if (res.status === 401) {
      limpiarSesion();
      alert(t('sesion.expiro'));
      return;
    }
    if (!res.ok) return alert(data.message || t('error.procesar'));
    setResultado({ codigo: data.codigo, pin: data.pin });
    setPedidoActivo({ id: data.id, codigo: data.codigo });
    setEstado('RECIBIDO');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setCart({});
    setCartPromos({});
    setCheckout(false);
    cargarSesion();
  }

  async function cancelarPedido() {
    if (!pedidoActivo || !miembro) return;
    if (!window.confirm(t('cancelar.pedido.confirm'))) return;
    await fetch(`/api/public/pedido/${pedidoActivo.id}/cancelar`, {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    setPedidoActivo(null);
    setEstado('CANCELADO');
    cargarSesion();
  }

  async function enviarEncuesta() {
    if (!pedidoActivo) return;
    try {
      await fetch('/api/public/encuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: pedidoActivo.id, estrellas, comentario }),
      });
      setEncuestaModal(false);
      setAviso(t('gracias.calificacion'));
      setTimeout(() => setAviso(''), 2500);
    } catch {
      /* ignore */
    }
  }

  async function pedirCancion() {
    if (!tema.trim() || !miembro) return;
    await fetch('/api/public/cancion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {}) },
      body: JSON.stringify({ tema: tema.trim() }),
    });
    setTema('');
    refrescarCanciones();
  }
  async function votarCancion(id: string) {
    await fetch(`/api/public/cancion/${id}/votar`, {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    refrescarCanciones();
  }
  async function llamarMesero() {
    if (!miembro) return;
    await fetch('/api/public/llamar', {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    setAviso(t('mesero.notificado'));
    setTimeout(() => setAviso(''), 2500);
  }

  async function solicitarPago() {
    if (!miembro) return;
    await fetch('/api/public/solicitar-pago', {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    setAviso(t('mesero.cobrar'));
    setTimeout(() => setAviso(''), 2500);
  }

  // ---------- RENDER ----------
  if (cerrado) {
    return (
      <div className="app">
        <div className="centered">
          {cerrado.logoUrl && (
            <img src={cerrado.logoUrl} alt="logo" style={{ width: 120, height: 120, borderRadius: 24, objectFit: 'cover', marginBottom: 14 }} />
          )}
          <h2 style={{ marginBottom: 8, color: 'var(--marca-letra)' }}>{cerrado.nombre || t('local')}</h2>
          <div className="subtitle" style={{ color: '#8b95a6' }}>{t('local.cerrado.mensaje')}</div>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="app">
        <div className="centered">
          <h2 style={{ marginBottom: 8 }}>KLUBB</h2>
          <div className="subtitle" style={{ color: '#8b95a6' }}>{error ? t(error) : t('cargando')}</div>
          {!qr && (
            <a className="btn primary block" style={{ marginTop: 16 }} href="/?qr=la-noche-m1">{t('ver.demo')}</a>
          )}
        </div>
      </div>
    );
  }

  if (despedida) {
    return (
      <div className="app">
        <div className="centered">
          <div style={{ fontSize: 56 }}>👋</div>
          <h2 style={{ marginTop: 8 }}>{t('gracias')}</h2>
          <div className="subtitle" style={{ marginTop: 8, color: '#8b95a6' }}>{t('esperamos.verte')}</div>
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => { setDespedida(false); setJoinStep('landing'); }}>
            {t('entendido')}
          </button>
        </div>
      </div>
    );
  }

  if (localCerrado) {
    return (
      <div className="app">
        <div className="centered">
          <div style={{ fontSize: 56 }}>🔒</div>
          <h2 style={{ marginTop: 8 }}>{t('local.cerrado')}</h2>
          <div className="subtitle" style={{ marginTop: 8, color: '#8b95a6' }}>{t('vuelve.pronto')}</div>
          <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => { setLocalCerrado(false); setJoinStep('landing'); }}>
            {t('entendido')}
          </button>
        </div>
      </div>
    );
  }

  // ---- Pantallas de ingreso ----
  if (!miembro) {
    if (authStep === 'login') {
      return (
        <div className="app">
          <div className="landing">
            <LangToggle lang={lang} setLang={setLang} />
            <button className="back" onClick={() => setAuthStep(null)}><ChevronLeft size={16} /> {t('volver')}</button>
            <BrandLogo logo={menu.tenant.logoUrl} nombre={menu.tenant.nombre} />
            <h1>{t('login')}</h1>
            <div className="welcome">{t('login.sub')}</div>
            <div className="opts">
              <input value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))} inputMode="tel" placeholder={t('telefono')} />
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('contrasena')} />
              {authErr && <div className="pill bad" style={{ alignSelf: 'center' }}>{authErr}</div>}
              <button className="btn primary block" onClick={loginCliente}><LogIn size={18} /> {t('entrar')}</button>
            </div>
          </div>
        </div>
      );
    }

    if (authStep === 'registro') {
      return (
        <div className="app">
          <div className="landing">
            <LangToggle lang={lang} setLang={setLang} />
            <button className="back" onClick={() => setAuthStep(null)}><ChevronLeft size={16} /> {t('volver')}</button>
            <BrandLogo logo={menu.tenant.logoUrl} nombre={menu.tenant.nombre} />
            <h1>{t('registro')}</h1>
            <div className="welcome">{t('registro.sub')}</div>
            <div className="opts">
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('nombre')} />
              <input value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))} inputMode="tel" placeholder={t('telefono')} />
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('contrasena')} />
              {authErr && <div className="pill bad" style={{ alignSelf: 'center' }}>{authErr}</div>}
              <button className="btn primary block" onClick={registrarCliente}><UserPlus size={18} /> {t('registro')}</button>
            </div>
          </div>
        </div>
      );
    }

    if (joinStep === 'landing' && menu.sesion === null) {
      return (
        <div className="app">
          <div className="landing">
            <LangToggle lang={lang} setLang={setLang} />
            <BrandLogo logo={menu.tenant.logoUrl} nombre={menu.tenant.nombre} />
            <h1 style={{ color: 'var(--marca-letra)' }}>{menu.tenant.nombre}</h1>
            <div className="mesa-pill">
              <Armchair size={14} /> {menu.mesa.nombre} · {menu.mesa.zona}
            </div>
            <div className="welcome">{menu.tenant.mensajeBienvenida}</div>
            <div className="opts">
              <button className="btn primary block" onClick={() => { setJoinCtx('crear'); setJoinStep('alias'); }}>
                <User size={18} /> {t('invitado')} <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
              </button>
              <button className="btn block" onClick={() => setAuthStep('login')}>
                <LogIn size={18} /> {t('login')}
              </button>
              <button className="btn block" onClick={() => setAuthStep('registro')}>
                <UserPlus size={18} /> {t('registro')}
              </button>
            </div>
            <div className="divider">{t('anfitrion')}</div>
            <div className="welcome" style={{ fontSize: 12 }}>
              {t('anfitrion.sub')}
            </div>
          </div>
        </div>
      );
    }

    if (joinStep === 'codigo') {
      return (
        <div className="app">
          <div className="landing">
            <LangToggle lang={lang} setLang={setLang} />
            <BrandLogo logo={menu.tenant.logoUrl} nombre={menu.tenant.nombre} />
            <h1>{t('unirse.mesa', { mesa: menu.mesa.nombre })}</h1>
            <div className="welcome">{t('unirse.sub')}</div>
            <div className="opts">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                style={{ textAlign: 'center', letterSpacing: 10, fontSize: 26, fontWeight: 700 }}
              />
              <button
                className="btn primary block"
                onClick={() => {
                  if (cliente) return unirse();
                  setJoinCtx('unirse');
                  setJoinStep('alias');
                }}
              >
                <KeyRound size={18} /> {t('continuar')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // alias
    return (
      <div className="app">
        <div className="landing">
          <LangToggle lang={lang} setLang={setLang} />
          <button className="back" onClick={() => setJoinStep(joinCtx === 'crear' ? 'landing' : 'codigo')}>
            <ChevronLeft size={16} /> {t('volver')}
          </button>
          <BrandLogo logo={menu.tenant.logoUrl} nombre={menu.tenant.nombre} />
          <h1>{t(joinCtx === 'crear' ? 'como.llamas' : 'nombre.mesa')}</h1>
          <div className="welcome">{t('nombre.sub')}</div>
          <div className="opts">
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder={t('ej.ana')} autoFocus />
            <button className="btn primary block" onClick={joinCtx === 'crear' ? crearSesion : unirse}>
              <ArrowRight size={18} /> {t('entrar.mesa')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- APP (menú) ----
  const totalMesa = sesion?.miembros?.reduce((acc: number, m: any) => {
    const t = m.pedidos?.reduce((s: number, p: any) => s + p.total, 0) || 0;
    return acc + t;
  }, 0) || 0;

  return (
    <div className="app">
      <div className="hero">
        <div className="hero-top">
          {menu.tenant.logoUrl ? (
            <img src={menu.tenant.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div className="avatar">{menu.tenant.nombre[0]}</div>
          )}
          <div style={{ flex: 1 }}>
            <div className="title" style={{ color: 'var(--marca-letra)' }}>{menu.tenant.nombre}</div>
            <div className="subtitle">{menu.mesa.nombre} · {menu.mesa.zona}</div>
          </div>
          {miembro.codigo && (
            <button className="code-badge" onClick={() => setVerCodigo(true)}>
              {t('codigo.mesa', { codigo: miembro.codigo })}
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text)', cursor: 'pointer' }}
          >
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 10, display: 'flex', gap: 8 }}>
          <span className="pill purple">{t('tu', { alias: miembro.alias })}</span>
          <button className="btn sm outline" onClick={llamarMesero}>{t('llamar.mesero')}</button>
        </div>
      </div>

      <div className="body">
        {aviso && (
          <div className="pcard" style={{ borderColor: 'var(--ok)' }}>
            <div className="pinfo"><div className="pname" style={{ color: '#4ade80' }}>{aviso}</div></div>
          </div>
        )}

        {tab === 'menu' && (
          <>
            <div className="banner">
              <Sparkles size={22} color="#f5b301" className="ico" />
              <div className="txt" style={{ fontSize: 13 }}>
                <b>{t('happy.hour')}</b> · {t('happy.hour.sub')}
              </div>
            </div>
            {menu.configPuntos?.habilitado && cliente && (() => {
              const prog = progresoNivel(cliente, menu.niveles || []);
              return (
                <div className="pcard" style={{ borderColor: 'var(--accent)', marginBottom: 12 }}>
                  <div className="pinfo">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <div className="subtitle">{t('nivel.actual')}</div>
                        <div className="pname" style={{ color: '#f5b301' }}>⭐ {prog.nivel}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="subtitle">{t('puntos', { n: prog.puntos })}</div>
                        {prog.siguiente && (
                          <div className="subtitle">{t('te.faltan', { n: prog.faltan, nivel: prog.siguiente })}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ background: 'var(--line)', borderRadius: 99, height: 8, width: '100%', marginTop: 10, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--accent)', height: '100%', width: `${prog.pct}%`, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="chips">
              <button className={`chip ${catId === '__promo__' ? 'on' : ''}`} onClick={() => setCatId('__promo__')}>
                <span className="ico">🎁</span>{t('promociones')}
              </button>
              {menu.categorias.map((c) => (
                <button key={c.id} className={`chip ${c.id === cat?.id ? 'on' : ''}`} onClick={() => setCatId(c.id)}>
                  <span className="ico">{c.icono || '🍽️'}</span>{c.nombre}
                </button>
              ))}
            </div>
            {catId === '__promo__' ? (
              <div className="carta">
                {(menu.promociones || []).length === 0 && (
                  <div className="cdesc">{t('sin.promos')}</div>
                )}
                {(menu.promociones || []).map((promo) => {
                  if (promo.tipo === 'COMBO') {
                    return (
                      <div key={promo.id} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <b style={{ fontSize: 15 }}>🎁 {promo.nombre}</b>
                          <span className="pill ok">Combo</span>
                        </div>
                        {promo.descripcion && <div className="cdesc" style={{ marginBottom: 8 }}>{promo.descripcion}</div>}
                        <div className="carta-card">
                          <div className="pimg">
                            {promo.imagenUrl ? (
                              <img src={promo.imagenUrl} alt={promo.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '🎁'
                            )}
                          </div>
                          <div className="cbody">
                            <div className="cname">{promo.nombre}</div>
                            <div className="cdesc">
                              {(promo.items || []).map((it) => `${it.cantidad}x ${it.producto?.nombre || ''}`).join(' · ')}
                            </div>
                          </div>
                          <div className="cfoot">
                            <span className="cprice">${(promo.precio ?? 0).toLocaleString('es-CO')}</span>
                            {cantidadCombo(promo.id) > 0 ? (
                              <div className="qty">
                                <button onClick={(e) => { e.stopPropagation(); toggleCombo(promo.id, -1); }}>−</button>
                                <span>{cantidadCombo(promo.id)}</span>
                                <button onClick={(e) => { e.stopPropagation(); toggleCombo(promo.id, 1); }}>+</button>
                              </div>
                            ) : (
                              <button className="add-btn" onClick={(e) => { e.stopPropagation(); toggleCombo(promo.id, 1); }}>+</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const precioPromo = promo.tipo === 'PRECIO_FIJO' ? promo.precio : null;
                  return (
                    <div key={promo.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <b style={{ fontSize: 15 }}>🎁 {promo.nombre}</b>
                        {promo.descuento > 0 && <span className="pill ok">-{promo.descuento}%</span>}
                        {promo.tipo === 'PRECIO_FIJO' && <span className="pill ok">Oferta</span>}
                      </div>
                      {promo.descripcion && <div className="cdesc" style={{ marginBottom: 8 }}>{promo.descripcion}</div>}
                      {promo.productos.map((p) => (
                        <div className="carta-card" key={p.id} onClick={() => setProductoModal(p)}>
                          <div className="pimg">{p.emoji || '🍸'}</div>
                          <div className="cbody">
                            <div className="cname">{p.nombre}</div>
                            <div className="cdesc">{p.descripcion || promo.nombre}</div>
                          </div>
                          <div className="cfoot">
                            <span className="cprice">
                              {precioPromo != null ? (
                                <>
                                  ${precioPromo.toLocaleString('es-CO')}{' '}
                                  <s style={{ color: '#8b95a6', fontSize: 12 }}>${p.precio.toLocaleString('es-CO')}</s>
                                </>
                              ) : (
                                <>${p.precio.toLocaleString('es-CO')}</>
                              )}
                            </span>
                            {cantidad(p.id) > 0 ? (
                              <div className="qty">
                                <button onClick={(e) => { e.stopPropagation(); toggle(p.id, -1); }}>−</button>
                                <span>{cantidad(p.id)}</span>
                                <button onClick={(e) => { e.stopPropagation(); toggle(p.id, 1); }}>+</button>
                              </div>
                            ) : (
                              <button className="add-btn" onClick={(e) => { e.stopPropagation(); toggle(p.id, 1); }}>+</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="carta">
                {cat?.productos.map((p) => (
                  <div className="carta-card" key={p.id} onClick={() => setProductoModal(p)}>
                    <div className="pimg">{p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.emoji || '🍸'}</div>
                    <div className="cbody">
                      <div className="cname">{p.nombre}</div>
                      <div className="cdesc">{p.descripcion || cat.nombre}</div>
                    </div>
                    <div className="cfoot">
                      <span className="cprice">${p.precio.toLocaleString('es-CO')}</span>
                      {cantidad(p.id) > 0 ? (
                        <div className="qty">
                          <button onClick={(e) => { e.stopPropagation(); toggle(p.id, -1); }}>−</button>
                          <span>{cantidad(p.id)}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggle(p.id, 1); }}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={(e) => { e.stopPropagation(); toggle(p.id, 1); }}>+</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'cuenta' && (
          <>
            <div className="section">{t('mi.pedido')}</div>
            {pedidoActivo ? (
              <div className="pcard" style={{ borderColor: 'var(--accent)' }}>
                <div className="pinfo">
                  <div className="pname">{t('tu.pedido', { codigo: pedidoActivo.codigo })}</div>
                  <div className="pdesc" style={{ marginTop: 4 }}>
                    <span className={`pill ${ESTADO_PILL[estado] || 'warn'}`}>
                      {t(estado ? `estado.${estado}` : 'estado.RECIBIDO')}
                    </span>
                  </div>
                </div>
                {(estado === 'RECIBIDO' || estado === '') && (
                  <button className="btn sm danger" onClick={cancelarPedido}>{t('cancelar')}</button>
                )}
              </div>
            ) : (
              <div className="subtitle">{t('sin.pedir')}</div>
            )}
            {totalArticulos > 0 && (
              <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setCheckout(true)}>
                {t('revisar.carrito', { n: totalArticulos })}
              </button>
            )}

            <div className="section" style={{ marginTop: 22 }}>{t('la.mesa')}</div>
            <div className="banner" style={{ marginTop: 0 }}>
              {t('total.cuenta')} <b>${totalMesa.toLocaleString('es-CO')}</b>
            </div>
            <button className="btn primary block" style={{ marginBottom: 14 }} onClick={solicitarPago}>
              💳 {t('pagar.pedir')}
            </button>
            {(sesion?.miembros || []).map((m: any) => {
              const tot = m.pedidos?.reduce((s: number, p: any) => s + p.total, 0) || 0;
              return (
                <div key={m.id} style={{ marginBottom: 14 }}>
                  <div className="member-row">
                    <span className="dot" style={{ background: m.id === miembro.miembroId ? 'var(--accent)' : 'var(--muted)' }} />
                    <b style={{ flex: 1 }}>{m.alias}{m.id === miembro.miembroId ? ` ${t('tu2')}` : ''}</b>
                    <span style={{ fontWeight: 700 }}>${tot.toLocaleString('es-CO')}</span>
                  </div>
                  {(m.pedidos || []).map((p: any) => (
                    <div key={p.id} style={{ fontSize: 13, color: '#8b95a6', paddingLeft: 19, marginBottom: 4 }}>
                      {p.codigo} · {p.detalles?.map((d: any) => `${d.cantidad}x ${d.nombre || d.producto?.nombre}`).join(', ')}
                      <span style={{ color: 'var(--text)', marginLeft: 6 }}>${p.total.toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {tab === 'musica' && (
          <>
            <div className="section">{t('pedir.cancion')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder={t('artista.cancion')} />
              <button className="btn primary" onClick={pedirCancion}>{t('pedir')}</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {canciones.slice(0, 6).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', fontSize: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{c.tema}</span>
                  {c.estado === 'SONANDO' && <span className="pill ok">{t('sonando')}</span>}
                  <button className="btn sm" onClick={() => votarCancion(c.id)}>{t('votar', { n: c.votos })}</button>
                </div>
              ))}
              {canciones.length === 0 && <div className="subtitle">{t('sin.canciones')}</div>}
            </div>
          </>
        )}

      </div>

      {totalArticulos > 0 && tab === 'menu' && (
        <div className="cartbar">
          <div className="inner">
            <span style={{ fontSize: 14 }}><b>{totalArticulos} {t('art')}</b> · ${total.toLocaleString('es-CO')}</span>
            <button className="btn primary" onClick={() => setCheckout(true)}>{t('enviar.pedido')}</button>
          </div>
        </div>
      )}

      <div className="tabbar">
        <button className={`tab ${tab === 'menu' ? 'on' : ''}`} onClick={() => setTab('menu')}><span className="ico">🍽️</span>{t('tab.menu')}</button>
        <button className={`tab ${tab === 'cuenta' ? 'on' : ''}`} onClick={() => setTab('cuenta')}><span className="ico">🧾</span>{t('tab.cuenta')}</button>
        <button className={`tab ${tab === 'musica' ? 'on' : ''}`} onClick={() => setTab('musica')}><span className="ico">🎵</span>{t('tab.musica')}</button>
      </div>

      {checkout && (
        <div className="modal-bg" onClick={() => setCheckout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('confirmar.pedido')}</h2>
            {items.map((i) => (
              <div key={i.productoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
                <span>{i.cantidad}x {i.nombre}</span><span>${(i.precio * i.cantidad).toLocaleString('es-CO')}</span>
              </div>
            ))}
            {comboItems.map((c) => (
              <div key={c.promocionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
                <span>{c.cantidad}x {c.nombre} 🎁</span><span>${(c.precio * c.cantidad).toLocaleString('es-CO')}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0' }} />
            <label>{t('modo.entrega')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn sm ${modo === 'MESA' ? 'primary' : ''}`} onClick={() => setModo('MESA')}>{t('a.la.mesa')}</button>
              <button className={`btn sm ${modo === 'PICKUP' ? 'primary' : ''}`} onClick={() => setModo('PICKUP')}>{t('pickup')}</button>
            </div>
            <label>{t('propina')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 10, 15, 20].map((tip) => (
                <button key={tip} className={`btn sm ${propina === tip ? 'primary' : ''}`} onClick={() => setPropina(tip)}>
                  {tip === 0 ? t('nada') : `${tip}%`}
                </button>
              ))}
            </div>
            <label>{t('medio.pago')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(menu.metodosPago || ['EFECTIVO', 'TARJETA', 'NEQUI', 'PSE', 'WOMPI']).map((m) => (
                <button key={m} className={`btn sm ${metodoPago === m ? 'primary' : ''}`} onClick={() => setMetodoPago(m)}>
                  {t(`metodo.${m}`) || m}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}><span>{t('subtotal')}</span><span>${subtotal.toLocaleString('es-CO')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}><span>{t('propina')}</span><span>${totalPropina.toLocaleString('es-CO')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, padding: '8px 0' }}><span>{t('total')}</span><span>${total.toLocaleString('es-CO')}</span></div>
            <button className="btn primary block" onClick={pagar}>{t('enviar.pedido')}</button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="modal-bg" onClick={() => setResultado(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('pedido.enviado')}</h2>
            <div className="pin">{resultado.codigo}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#8b95a6' }}>
              {t('pin.entrega')} <b style={{ letterSpacing: 3 }}>{resultado.pin}</b>
            </div>
            <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => { setResultado(null); setAvisoPrep(true); }}>{t('listo')}</button>
          </div>
        </div>
      )}

      {verCodigo && (
        <div className="modal-bg" onClick={() => setVerCodigo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>{t('codigo.mesa.titulo')}</h2>
            <div className="subtitle" style={{ marginBottom: 14 }}>
              {t('codigo.mesa.sub', { mesa: menu.mesa.nombre })}
            </div>
            <div className="pin">{miembro.codigo}</div>
            <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => setVerCodigo(false)}>
              {t('entendido')}
            </button>
          </div>
        </div>
      )}

      {avisoPrep && (
        <div className="modal-bg" onClick={() => setAvisoPrep(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>{t('importante')}</h2>
            <div className="subtitle" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 6 }}>
              {t('importante.sub')}
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => setAvisoPrep(false)}>
              {t('entendido')}
            </button>
          </div>
        </div>
      )}

      {nivelUp && (
        <div className="modal-bg" onClick={() => setNivelUp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
            <h2 style={{ color: 'var(--accent)' }}>{t('subiste.nivel')}</h2>
            <div className="subtitle" style={{ fontSize: 15, marginTop: 8 }}>
              {t('ahora.eres', { nivel: nivelUp.nuevoNivel })}
            </div>
            <div className="subtitle" style={{ marginTop: 6, color: '#8b95a6' }}>
              {t('tienes.puntos', { n: nivelUp.puntos })}
            </div>
            <button className="btn primary block" style={{ marginTop: 20 }} onClick={() => setNivelUp(null)}>
              {t('genial')}
            </button>
          </div>
        </div>
      )}

      {encuestaModal && (
        <div className="modal-bg" onClick={() => setEncuestaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>{t('experiencia')}</h2>
            <div style={{ fontSize: 32, margin: '12px 0' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEstrellas(n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, color: n <= estrellas ? '#f5b301' : '#3a3f45' }}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={t('cuentanos')}
              style={{ width: '100%', minHeight: 70, marginBottom: 12 }}
            />
            <button className="btn primary block" onClick={enviarEncuesta}>{t('enviar')}</button>
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => setEncuestaModal(false)}>{t('ahora.no')}</button>
          </div>
        </div>
      )}

      {productoModal && (
        <div className="modal-bg" onClick={() => setProductoModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            {productoModal.imagenUrl ? (
              <img src={productoModal.imagenUrl} alt={productoModal.nombre} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 16 }} />
            ) : (
              <div style={{ fontSize: 90 }}>{productoModal.emoji || '🍸'}</div>
            )}
            <h2 style={{ marginTop: 12 }}>{productoModal.nombre}</h2>
            {productoModal.descripcion && (
              <div className="subtitle" style={{ marginTop: 8 }}>{productoModal.descripcion}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 22 }}>
                ${productoModal.precio.toLocaleString('es-CO')}
              </span>
              {cantidad(productoModal.id) > 0 ? (
                <div className="qty">
                  <button onClick={() => toggle(productoModal.id, -1)}>−</button>
                  <span>{cantidad(productoModal.id)}</span>
                  <button onClick={() => toggle(productoModal.id, 1)}>+</button>
                </div>
              ) : (
                <button className="btn primary" onClick={() => toggle(productoModal.id, 1)}>{t('agregar')}</button>
              )}
            </div>
            <button className="btn block" style={{ marginTop: 14 }} onClick={() => setProductoModal(null)}>{t('cerrar')}</button>
          </div>
        </div>
      )}

      {bienvenida && menu?.mesero && (
        <div className="modal-bg" onClick={() => setBienvenida(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: '#8b95a6', marginBottom: 4 }}>{menu.tenant.nombre}</div>
            <div style={{ width: 96, height: 96, borderRadius: '50%', margin: '10px auto', overflow: 'hidden', background: 'linear-gradient(135deg, #f5b301, #7a5b00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {menu.mesero.fotoUrl ? (
                <img src={menu.mesero.fotoUrl} alt={menu.mesero.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 40, fontWeight: 800, color: '#fff' }}>{(menu.mesero.nombre || 'M')[0]}</span>
              )}
            </div>
            <h2 style={{ marginTop: 4 }}>{menu.mesero.nombre}</h2>
            <div className="subtitle" style={{ marginTop: 8, lineHeight: 1.6 }}>
              {t('bienvenida')}
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,179,1,.08)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🛎️</span>
              <span className="subtitle" style={{ fontSize: 13, textAlign: 'left' }}>
                {t('bienvenida.sub')}
              </span>
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => setBienvenida(false)}>
              {t('empecemos')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
