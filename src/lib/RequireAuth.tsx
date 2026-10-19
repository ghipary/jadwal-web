// Penjaga rute: rute privat hanya untuk akun yang sudah masuk,
// rute publik (landing/login/register) hanya untuk yang belum masuk.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useProject } from '../store';

function Splash({ teks }: { teks: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="splash-spin" />
      <b>Jadwal Sekolah</b>
      <span>{teks}</span>
    </div>
  );
}

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { ownerId } = useProject();
  const location = useLocation();

  // Tautan publikasi (`/publikasi?d=…`) adalah berkas jadwal baca-saja yang
  // memang dibagikan tanpa login — biarkan lewat tanpa sesi.
  const tautanPublikasi =
    location.pathname === '/publikasi' && new URLSearchParams(location.search).has('d');
  if (tautanPublikasi) return <>{children ?? <Outlet />}</>;

  // Selama sesi dipulihkan → tampilan memuat (mencegah salah alih sebentar).
  if (loading) return <Splash teks="Memulihkan sesi…" />;
  // Belum login → halaman Landing.
  if (!user) return <Navigate to="/landing" replace />;
  // Data proyek milik user ini belum selesai dimuat (lokal/cloud) → tampilan memuat.
  // Ini juga yang menjamin tidak ada data akun lain yang sempat tampil/disimpan.
  if (ownerId !== user.id) return <Splash teks="Memuat data Anda…" />;

  return <>{children ?? <Outlet />}</>;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash teks="Memulihkan sesi…" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
