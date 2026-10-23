import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Armchair,
  Award,
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Martini,
  Music2,
  Package,
  Settings,
  Store,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth';

const ROLE_LABELS: Record<string, string> = {
  MASTER: 'Master',
  ADMIN: 'Administrador',
  MESERO: 'Mesero',
  BARRA: 'Barra',
  BARMAN: 'Barman',
  COCINA: 'Cocina',
  DJ: 'DJ',
  CAJERO: 'Cajero',
};

interface Link {
  to: string;
  label: string;
  Icon: LucideIcon;
  show: boolean;
  end?: boolean;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || '';
  const isMaster = role === 'MASTER';
  const esAdminPuro = role === 'ADMIN';
  const masterEnLocal = isMaster && !!user?.tenantActivoId;
  const operaLocal = esAdminPuro || masterEnLocal;
  const esPro = user?.plan !== 'BASICA';
  const isCajero = role === 'CAJERO';
  const isBarra = role === 'BARRA' || role === 'BARMAN' || role === 'COCINA';
  const isMesero = role === 'MESERO';
  const isDj = role === 'DJ';

  const [nivelUp, setNivelUp] = useState<any>(null);

  useEffect(() => {
    if (role !== 'ADMIN' && role !== 'MASTER') return;
    const token = localStorage.getItem('klubb_token');
    if (!token) return;
    const tenantId = user?.tenantActivoId ?? user?.tenantId;
    if (!tenantId) return;
    const socket = io('/ws', { auth: { token } });
    socket.on('connect', () => socket.emit('join-tenant', { tenantId }));
    socket.on('cliente:subio-nivel', (d: any) => setNivelUp(d));
    return () => socket.disconnect();
  }, [role, user]);

  const links: Link[] = [
    { to: '/locales', label: 'Locales', Icon: Store, show: isMaster, end: true },
    { to: '/', label: 'Inicio', Icon: LayoutDashboard, show: operaLocal, end: true },
    { to: '/mesas', label: 'Mesas y QR', Icon: Armchair, show: operaLocal },
    { to: '/productos', label: 'Inventario', Icon: Package, show: operaLocal },
    { to: '/insumos', label: 'Insumos', Icon: Boxes, show: operaLocal },
    { to: '/recetas', label: 'Recetas', Icon: ChefHat, show: operaLocal },
    { to: '/puntos', label: 'Puntos', Icon: Award, show: operaLocal && esPro },
    { to: '/promociones', label: 'Promociones', Icon: Tag, show: operaLocal && esPro },
    { to: '/reportes', label: 'Reportes', Icon: BarChart3, show: operaLocal && esPro },
    { to: '/kds', label: 'Pedidos (KDS)', Icon: Martini, show: operaLocal || isBarra },
    { to: '/caja', label: 'Caja', Icon: Wallet, show: operaLocal || isCajero },
    { to: '/usuarios', label: 'Usuarios', Icon: Users, show: operaLocal },
    { to: '/config', label: 'Configuración', Icon: Settings, show: operaLocal },
    { to: '/mesero', label: 'Mi turno', Icon: ClipboardList, show: isMesero, end: true },
    { to: '/dj', label: 'Canciones', Icon: Music2, show: isDj, end: true },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo-mark">K</div>
          <div>
            KLUB<span className="gold">B</span>
          </div>
        </div>
        {links
          .filter((l) => l.show)
          .map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
            >
              <l.Icon size={18} className="ico" />
              {l.label}
            </NavLink>
          ))}
        <div className="footer">
          <div className="user-chip">
            <div className="user-avatar">{(user?.nombre || 'U')[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre}
              </div>
              <div className="sub" style={{ marginTop: 0 }}>
                {ROLE_LABELS[role] || role}
              </div>
            </div>
          </div>
          <button
            className="btn block"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} style={{ marginRight: 8 }} />
            Salir
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>

      {nivelUp && (
        <div className="modal-bg" onClick={() => setNivelUp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
            <h2 style={{ color: 'var(--accent)' }}>Cliente subió de nivel</h2>
            <div className="sub" style={{ marginTop: 8 }}>
              <b>{nivelUp.clienteNombre}</b> alcanzó el nivel <b>{nivelUp.nuevoNivel}</b>
            </div>
            <div className="sub" style={{ marginTop: 6, color: '#8b95a6' }}>
              {nivelUp.puntos} puntos acumulados
            </div>
            <button className="btn primary block" style={{ marginTop: 20 }} onClick={() => setNivelUp(null)}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
