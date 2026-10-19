// Kerangka bersama halaman autentikasi (Login & Register).

import { ReactNode } from 'react';
import { Btn, Icon } from '../../ui';
import { useAuth } from '../../lib/auth';

export function AuthShell({
  judul,
  sub,
  children,
  bawah,
}: {
  judul: string;
  sub: string;
  children: ReactNode;
  /** Konten tautan bawah (mis. “Belum punya akun? Daftar”). */
  bawah?: ReactNode;
}) {
  const { user, supabaseSiap } = useAuth();

  return (
    <div className="auth-shell">
      <header className="auth-nav">
        <a className="landing-brand" href="#/landing">
          <span className="brand-logo">
            <img src="/logo-sekolah.png" alt="Logo sekolah" />
          </span>
          <span>
            <b>Jadwal Sekolah</b>
            <span>Perencana Jadwal Pelajaran</span>
          </span>
        </a>
        <a className="auth-kembali" href="#/landing">
          <Icon name="kanan" size={14} /> Kembali ke beranda
        </a>
      </header>

      <main className="auth-body">
        <div className="auth-card">
          <div className="auth-ikat">
            <span className="auth-ic">
              <Icon name={judul === 'Daftar' ? 'tambah' : 'masuk'} size={22} />
            </span>
            <h1>{judul}</h1>
            <p>{sub}</p>
          </div>

          {user ? (
            <div className="banner banner-info">
              <Icon name="info" size={17} />
              <div className="banner-body">
                Anda sudah masuk sebagai <b>{user.nama || user.email}</b>.
                <div style={{ marginTop: 8 }}>
                  <Btn size="sm" variant="primary" icon="kanan" onClick={() => (window.location.hash = '#/')}>
                    Buka Aplikasi
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            children
          )}

          {!user && bawah ? <div className="auth-bawah">{bawah}</div> : null}
        </div>

        {!user && !supabaseSiap ? (
          <p className="auth-catatan">
            <Icon name="info" size={13} /> Supabase belum dikonfigurasi — login akan berhasil setelah{' '}
            <code>VITE_SUPABASE_URL</code> &amp; <code>VITE_SUPABASE_ANON_KEY</code> diisi pada berkas{' '}
            <code>.env.local</code>.
          </p>
        ) : null}
      </main>
    </div>
  );
}
