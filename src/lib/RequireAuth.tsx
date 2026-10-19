import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 16 }}>Memuat...</div>;
  if (!user) return <Navigate to="/landing" replace />;
  return <>{children ?? <Outlet />}</>;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 16 }}>Memuat...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
