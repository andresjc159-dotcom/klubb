import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homeForRole, useAuth } from './auth';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mesas from './pages/Mesas';
import Productos from './pages/Productos';
import KDS from './pages/KDS';
import Caja from './pages/Caja';
import Mesero from './pages/Mesero';
import Dj from './pages/Dj';
import Locales from './pages/Locales';
import Usuarios from './pages/Usuarios';
import Insumos from './pages/Insumos';
import Recetas from './pages/Recetas';
import Config from './pages/Config';
import Puntos from './pages/Puntos';
import Promociones from './pages/Promociones';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="sub" style={{ padding: 40 }}>Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter basename="/staff">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<RoleRoute roles={['ADMIN', 'MASTER']}><Dashboard /></RoleRoute>} />
              <Route path="locales" element={<RoleRoute roles={['MASTER']}><Locales /></RoleRoute>} />
              <Route path="mesas" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Mesas /></RoleRoute>} />
              <Route path="productos" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Productos /></RoleRoute>} />
              <Route path="insumos" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Insumos /></RoleRoute>} />
              <Route path="recetas" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Recetas /></RoleRoute>} />
              <Route path="puntos" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Puntos /></RoleRoute>} />
              <Route path="promociones" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Promociones /></RoleRoute>} />
              <Route path="config" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Config /></RoleRoute>} />
              <Route path="kds" element={<RoleRoute roles={['ADMIN', 'MASTER', 'BARRA', 'BARMAN', 'COCINA']}><KDS /></RoleRoute>} />
              <Route path="caja" element={<RoleRoute roles={['ADMIN', 'MASTER', 'CAJERO']}><Caja /></RoleRoute>} />
              <Route path="usuarios" element={<RoleRoute roles={['ADMIN', 'MASTER']}><Usuarios /></RoleRoute>} />
              <Route path="mesero" element={<RoleRoute roles={['MESERO']}><Mesero /></RoleRoute>} />
              <Route path="dj" element={<RoleRoute roles={['DJ']}><Dj /></RoleRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
