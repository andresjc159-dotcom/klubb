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
  descuento: number;
  productos: Producto[];
}
interface Menu {
  abierto?: boolean;
  mensaje?: string;
  tenant: { id: string; nombre: string; mensajeBienvenida: string; logoUrl?: string };
  mesa: { id: string; nombre: string; zona: string };
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
  const [cerrado, setCerrado] = useState<{ mensaje: string; nombre?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!qr) {
      setError('Escanea el QR de tu mesa para comenzar.');
      return;
    }
    fetch(`/api/public/menu?qr=${encodeURIComponent(qr)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return setError('Mesa no encontrada');
        if (data.abierto === false) return setCerrado({ mensaje: data.mensaje, nombre: data.tenant?.nombre });
        setMenu(data);
      })
      .catch(() => setError('No se pudo cargar el menú'));
  }, [qr]);

  return { qr, menu, cerrado, error };
}

export default function App() {
  const { qr, menu, cerrado, error } = useMenu();

  const [miembro, setMiembro] = useState<Miembro | null>(null);
  const [tab, setTab] = useState<'menu' | 'cuenta' | 'musica'>('menu');
  const [catId, setCatId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
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
    socket.on('pedido:estado', (d: any) => setEstado(d.estado));
    socket.on('mesa:actualizada', () => cargarSesion());
    socket.on('cancion:nueva', refrescarCanciones);
    socket.on('cancion:actualizada', refrescarCanciones);
    socket.on('cliente:subio-nivel', (d: any) => {
      if (d.miembroId === miembro.miembroId) {
        setNivelUp(d);
        setCliente((c: any) => (c ? { ...c, puntos: d.puntos, nivel: d.nuevoNivel } : c));
      }
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
    if (!res.ok) return alert(data.message || 'Código incorrecto');
    const m: Miembro = { miembroId: data.miembroId, sesionId: data.sesionId, alias: nombreAlias, token: data.token };
    localStorage.setItem(LS(menu.mesa.id), JSON.stringify(m));
    setMiembro(m);
    setAlias('');
    setCodigo('');
  }

  async function loginCliente() {
    setAuthErr('');
    if (!tel.trim() || !pass || !menu) return setAuthErr('Completa todos los campos');
    const res = await fetch('/api/public/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: menu.mesa.id, telefono: tel.trim(), password: pass }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthErr(data.message || 'Error al iniciar sesión');
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
    if (!nom.trim() || !tel.trim() || !pass || !menu) return setAuthErr('Completa todos los campos');
    const res = await fetch('/api/public/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: menu.mesa.id, nombre: nom.trim(), telefono: tel.trim(), password: pass }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthErr(data.message || 'Error al registrarte');
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

  const items = Object.entries(cart)
    .map(([id, q]) => {
      const p = menu?.categorias.flatMap((c) => c.productos).find((x) => x.id === id);
      return p ? { productoId: id, cantidad: q, nombre: p.nombre, precio: p.precio } : null;
    })
    .filter(Boolean) as Array<{ productoId: string; cantidad: number; nombre: string; precio: number }>;

  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalPropina = Math.round((subtotal * propina) / 100);
  const total = subtotal + totalPropina;

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
        items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Error al procesar');
    setResultado({ codigo: data.codigo, pin: data.pin });
    setPedidoActivo({ id: data.id, codigo: data.codigo });
    setEstado('RECIBIDO');
    setCart({});
    setCheckout(false);
    cargarSesion();
  }

  async function cancelarPedido() {
    if (!pedidoActivo || !miembro) return;
    if (!window.confirm('¿Cancelar tu pedido?')) return;
    await fetch(`/api/public/pedido/${pedidoActivo.id}/cancelar`, {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    setPedidoActivo(null);
    setEstado('CANCELADO');
    cargarSesion();
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
    setAviso('El mesero fue notificado');
    setTimeout(() => setAviso(''), 2500);
  }

  async function solicitarPago() {
    if (!miembro) return;
    await fetch('/api/public/solicitar-pago', {
      method: 'POST',
      headers: miembro.token ? { Authorization: `Bearer ${miembro.token}` } : {},
    });
    setAviso('El mesero fue notificado para cobrar');
    setTimeout(() => setAviso(''), 2500);
  }

  // ---------- RENDER ----------
  if (cerrado) {
    return (
      <div className="app">
        <div className="centered">
          <h2 style={{ marginBottom: 8 }}>{cerrado.nombre || 'Local'}</h2>
          <div className="subtitle" style={{ color: '#8b95a6' }}>{cerrado.mensaje}</div>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="app">
        <div className="centered">
          <h2 style={{ marginBottom: 8 }}>KLUBB</h2>
          <div className="subtitle" style={{ color: '#8b95a6' }}>{error || 'Cargando…'}</div>
          {!qr && (
            <a className="btn primary block" style={{ marginTop: 16 }} href="/?qr=la-noche-m1">Ver demo (Mesa 1)</a>
          )}
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
            <button className="back" onClick={() => setAuthStep(null)}><ChevronLeft size={16} /> Volver</button>
            <div className="brand-mark">{menu.tenant.nombre[0]}</div>
            <h1>Iniciar sesión</h1>
            <div className="welcome">Ingresa con tu teléfono y contraseña.</div>
            <div className="opts">
              <input value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))} inputMode="tel" placeholder="Teléfono" />
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" />
              {authErr && <div className="pill bad" style={{ alignSelf: 'center' }}>{authErr}</div>}
              <button className="btn primary block" onClick={loginCliente}><LogIn size={18} /> Entrar</button>
            </div>
          </div>
        </div>
      );
    }

    if (authStep === 'registro') {
      return (
        <div className="app">
          <div className="landing">
            <button className="back" onClick={() => setAuthStep(null)}><ChevronLeft size={16} /> Volver</button>
            <div className="brand-mark">{menu.tenant.nombre[0]}</div>
            <h1>Crear cuenta</h1>
            <div className="welcome">Nombre, teléfono y contraseña. ¡Y listo!</div>
            <div className="opts">
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nombre" />
              <input value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))} inputMode="tel" placeholder="Teléfono" />
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" />
              {authErr && <div className="pill bad" style={{ alignSelf: 'center' }}>{authErr}</div>}
              <button className="btn primary block" onClick={registrarCliente}><UserPlus size={18} /> Crear cuenta</button>
            </div>
          </div>
        </div>
      );
    }

    if (joinStep === 'landing' && menu.sesion === null) {
      return (
        <div className="app">
          <div className="landing">
            <div className="brand-mark">{menu.tenant.nombre[0]}</div>
            <h1>{menu.tenant.nombre}</h1>
            <div className="mesa-pill">
              <Armchair size={14} /> {menu.mesa.nombre} · {menu.mesa.zona}
            </div>
            <div className="welcome">{menu.tenant.mensajeBienvenida}</div>
            <div className="opts">
              <button className="btn primary block" onClick={() => { setJoinCtx('crear'); setJoinStep('alias'); }}>
                <User size={18} /> Entrar como invitado <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
              </button>
              <button className="btn block" onClick={() => setAuthStep('login')}>
                <LogIn size={18} /> Iniciar sesión
              </button>
              <button className="btn block" onClick={() => setAuthStep('registro')}>
                <UserPlus size={18} /> Crear cuenta
              </button>
            </div>
            <div className="divider">serás el anfitrión</div>
            <div className="welcome" style={{ fontSize: 12 }}>
              Recibirás un código de 4 dígitos para invitar a los demás a la mesa.
            </div>
          </div>
        </div>
      );
    }

    if (joinStep === 'codigo') {
      return (
        <div className="app">
          <div className="landing">
            <div className="brand-mark">{menu.tenant.nombre[0]}</div>
            <h1>Unirse a {menu.mesa.nombre}</h1>
            <div className="welcome">Esta mesa ya está en curso. Pide el código al anfitrión.</div>
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
                <KeyRound size={18} /> Continuar
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
          <button className="back" onClick={() => setJoinStep(joinCtx === 'crear' ? 'landing' : 'codigo')}>
            <ChevronLeft size={16} /> Volver
          </button>
          <div className="brand-mark">{menu.tenant.nombre[0]}</div>
          <h1>{joinCtx === 'crear' ? '¿Cómo te llamas?' : 'Tu nombre en la mesa'}</h1>
          <div className="welcome">Así te identificarán los demás en la mesa.</div>
          <div className="opts">
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Ana" autoFocus />
            <button className="btn primary block" onClick={joinCtx === 'crear' ? crearSesion : unirse}>
              <ArrowRight size={18} /> Entrar a la mesa
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
          <div className="avatar">{menu.tenant.nombre[0]}</div>
          <div style={{ flex: 1 }}>
            <div className="title">{menu.tenant.nombre}</div>
            <div className="subtitle">{menu.mesa.nombre} · {menu.mesa.zona}</div>
          </div>
          {miembro.codigo && (
            <button className="code-badge" onClick={() => setVerCodigo(true)}>
              Código {miembro.codigo}
            </button>
          )}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 10, display: 'flex', gap: 8 }}>
          <span className="pill purple">Tú: {miembro.alias}</span>
          <button className="btn sm outline" onClick={llamarMesero}>Llamar mesero</button>
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
                <b>Happy Hour</b> · 2x1 en cocteles hasta las 8pm
              </div>
            </div>
            {menu.configPuntos?.habilitado && cliente && (() => {
              const prog = progresoNivel(cliente, menu.niveles || []);
              return (
                <div className="pcard" style={{ borderColor: 'var(--accent)', marginBottom: 12 }}>
                  <div className="pinfo">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <div className="subtitle">Nivel actual</div>
                        <div className="pname" style={{ color: '#f5b301' }}>⭐ {prog.nivel}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="subtitle">{prog.puntos} puntos</div>
                        {prog.siguiente && (
                          <div className="subtitle">Te faltan {prog.faltan} para {prog.siguiente}</div>
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
                <span className="ico">🎁</span>Promociones
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
                  <div className="cdesc">No hay promociones activas.</div>
                )}
                {(menu.promociones || []).map((promo) => (
                  <div key={promo.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <b style={{ fontSize: 15 }}>🎁 {promo.nombre}</b>
                      {promo.descuento > 0 && <span className="pill ok">-{promo.descuento}%</span>}
                    </div>
                    {promo.descripcion && <div className="cdesc" style={{ marginBottom: 8 }}>{promo.descripcion}</div>}
                    {promo.productos.map((p) => (
                      <div className="carta-card" key={p.id}>
                        <div className="pimg">{p.emoji || '🍸'}</div>
                        <div className="cbody">
                          <div className="cname">{p.nombre}</div>
                          <div className="cdesc">{p.descripcion || promo.nombre}</div>
                        </div>
                        <div className="cfoot">
                          <span className="cprice">${p.precio.toLocaleString('es-CO')}</span>
                          {cantidad(p.id) > 0 ? (
                            <div className="qty">
                              <button onClick={() => toggle(p.id, -1)}>−</button>
                              <span>{cantidad(p.id)}</span>
                              <button onClick={() => toggle(p.id, 1)}>+</button>
                            </div>
                          ) : (
                            <button className="add-btn" onClick={() => toggle(p.id, 1)}>+</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="carta">
                {cat?.productos.map((p) => (
                  <div className="carta-card" key={p.id}>
                    <div className="pimg">{p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.emoji || '🍸'}</div>
                    <div className="cbody">
                      <div className="cname">{p.nombre}</div>
                      <div className="cdesc">{p.descripcion || cat.nombre}</div>
                    </div>
                    <div className="cfoot">
                      <span className="cprice">${p.precio.toLocaleString('es-CO')}</span>
                      {cantidad(p.id) > 0 ? (
                        <div className="qty">
                          <button onClick={() => toggle(p.id, -1)}>−</button>
                          <span>{cantidad(p.id)}</span>
                          <button onClick={() => toggle(p.id, 1)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => toggle(p.id, 1)}>+</button>
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
            <div className="section">Mi pedido</div>
            {pedidoActivo ? (
              <div className="pcard" style={{ borderColor: 'var(--accent)' }}>
                <div className="pinfo">
                  <div className="pname">Tu pedido {pedidoActivo.codigo}</div>
                  <div className="pdesc" style={{ marginTop: 4 }}>
                    <span className={`pill ${ESTADO_PILL[estado] || 'warn'}`}>
                      {ESTADO_LABEL[estado] || 'Recibido'}
                    </span>
                  </div>
                </div>
                {(estado === 'RECIBIDO' || estado === '') && (
                  <button className="btn sm danger" onClick={cancelarPedido}>Cancelar</button>
                )}
              </div>
            ) : (
              <div className="subtitle">Aún no has pedido nada.</div>
            )}
            {items.length > 0 && (
              <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setCheckout(true)}>
                Revisar carrito ({items.length} art.)
              </button>
            )}

            <div className="section" style={{ marginTop: 22 }}>La mesa</div>
            <div className="banner" style={{ marginTop: 0 }}>
              Total de la cuenta: <b>${totalMesa.toLocaleString('es-CO')}</b>
            </div>
            <button className="btn primary block" style={{ marginBottom: 14 }} onClick={solicitarPago}>
              💳 Pagar / pedir cuenta
            </button>
            {(sesion?.miembros || []).map((m: any) => {
              const t = m.pedidos?.reduce((s: number, p: any) => s + p.total, 0) || 0;
              return (
                <div key={m.id} style={{ marginBottom: 14 }}>
                  <div className="member-row">
                    <span className="dot" style={{ background: m.id === miembro.miembroId ? 'var(--accent)' : 'var(--muted)' }} />
                    <b style={{ flex: 1 }}>{m.alias}{m.id === miembro.miembroId ? ' (tú)' : ''}</b>
                    <span style={{ fontWeight: 700 }}>${t.toLocaleString('es-CO')}</span>
                  </div>
                  {(m.pedidos || []).map((p: any) => (
                    <div key={p.id} style={{ fontSize: 13, color: '#8b95a6', paddingLeft: 19, marginBottom: 4 }}>
                      {p.codigo} · {p.detalles?.map((d: any) => `${d.cantidad}x ${d.producto?.nombre}`).join(', ')}
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
            <div className="section">Pedir una canción</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Artista — Canción" />
              <button className="btn primary" onClick={pedirCancion}>Pedir</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {canciones.slice(0, 6).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', fontSize: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{c.tema}</span>
                  {c.estado === 'SONANDO' && <span className="pill ok">Sonando</span>}
                  <button className="btn sm" onClick={() => votarCancion(c.id)}>Votar ({c.votos})</button>
                </div>
              ))}
              {canciones.length === 0 && <div className="subtitle">No hay canciones en cola.</div>}
            </div>
          </>
        )}

      </div>

      {items.length > 0 && tab === 'menu' && (
        <div className="cartbar">
          <div className="inner">
            <span style={{ fontSize: 14 }}><b>{items.length} art.</b> · ${total.toLocaleString('es-CO')}</span>
            <button className="btn primary" onClick={() => setCheckout(true)}>Enviar pedido</button>
          </div>
        </div>
      )}

      <div className="tabbar">
        <button className={`tab ${tab === 'menu' ? 'on' : ''}`} onClick={() => setTab('menu')}><span className="ico">🍽️</span>Menú</button>
        <button className={`tab ${tab === 'cuenta' ? 'on' : ''}`} onClick={() => setTab('cuenta')}><span className="ico">🧾</span>Cuenta</button>
        <button className={`tab ${tab === 'musica' ? 'on' : ''}`} onClick={() => setTab('musica')}><span className="ico">🎵</span>Música</button>
      </div>

      {checkout && (
        <div className="modal-bg" onClick={() => setCheckout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Confirmar pedido</h2>
            {items.map((i) => (
              <div key={i.productoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
                <span>{i.cantidad}x {i.nombre}</span><span>${(i.precio * i.cantidad).toLocaleString('es-CO')}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0' }} />
            <label>Modo de entrega</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn sm ${modo === 'MESA' ? 'primary' : ''}`} onClick={() => setModo('MESA')}>A la mesa</button>
              <button className={`btn sm ${modo === 'PICKUP' ? 'primary' : ''}`} onClick={() => setModo('PICKUP')}>Pick-up</button>
            </div>
            <label>Propina</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 10, 15, 20].map((t) => (
                <button key={t} className={`btn sm ${propina === t ? 'primary' : ''}`} onClick={() => setPropina(t)}>
                  {t === 0 ? 'Nada' : `${t}%`}
                </button>
              ))}
            </div>
            <label>Medio de pago</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(menu.metodosPago || ['EFECTIVO', 'TARJETA', 'NEQUI', 'PSE', 'WOMPI']).map((m) => (
                <button key={m} className={`btn sm ${metodoPago === m ? 'primary' : ''}`} onClick={() => setMetodoPago(m)}>
                  {METODO_LABEL[m] || m}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}><span>Subtotal</span><span>${subtotal.toLocaleString('es-CO')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}><span>Propina</span><span>${totalPropina.toLocaleString('es-CO')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, padding: '8px 0' }}><span>Total</span><span>${total.toLocaleString('es-CO')}</span></div>
            <button className="btn primary block" onClick={pagar}>Enviar pedido</button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="modal-bg" onClick={() => setResultado(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pedido enviado</h2>
            <div className="pin">{resultado.codigo}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#8b95a6' }}>
              PIN de entrega: <b style={{ letterSpacing: 3 }}>{resultado.pin}</b>
            </div>
            <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => { setResultado(null); setAvisoPrep(true); }}>Listo</button>
          </div>
        </div>
      )}

      {verCodigo && (
        <div className="modal-bg" onClick={() => setVerCodigo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>Código de la mesa</h2>
            <div className="subtitle" style={{ marginBottom: 14 }}>
              Comparte este código para que tus amigos se unan a la mesa {menu.mesa.nombre}.
            </div>
            <div className="pin">{miembro.codigo}</div>
            <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => setVerCodigo(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {avisoPrep && (
        <div className="modal-bg" onClick={() => setAvisoPrep(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2>Importante</h2>
            <div className="subtitle" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 6 }}>
              Una vez tu pedido esté <b style={{ color: 'var(--accent)' }}>en preparación</b>, no podrás cancelarlo.
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => setAvisoPrep(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {nivelUp && (
        <div className="modal-bg" onClick={() => setNivelUp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
            <h2 style={{ color: 'var(--accent)' }}>¡Subiste de nivel!</h2>
            <div className="subtitle" style={{ fontSize: 15, marginTop: 8 }}>
              Ahora eres <b>{nivelUp.nuevoNivel}</b>
            </div>
            <div className="subtitle" style={{ marginTop: 6, color: '#8b95a6' }}>
              Tienes {nivelUp.puntos} puntos acumulados
            </div>
            <button className="btn primary block" style={{ marginTop: 20 }} onClick={() => setNivelUp(null)}>
              ¡Genial!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
