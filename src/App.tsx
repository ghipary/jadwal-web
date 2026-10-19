// Kerangka aplikasi: sidebar, topbar, dan pemetaan rute.

import { useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useProject } from './store';
import { checkConflicts } from './scheduler';
import { Icon, Btn } from './ui';
import { Dashboard } from './pages/Dashboard';
import { HalBlokir, HalGuru, HalJam, HalKelas, HalMapel, HalRuang, HalSiswa } from './pages/entities';
import { HalSekolah } from './pages/Sekolah';
import { HalKebutuhan } from './pages/Kebutuhan';
import { HalGenerate } from './pages/Generate';
import { HalJadwal } from './pages/Jadwal';
import { HalMatriks } from './pages/Matriks';
import { HalKonflik } from './pages/Konflik';
import { HalBerkas } from './pages/Berkas';
import { HalPublikasi, PublikasiReadonly } from './pages/Publikasi';
import { Landing } from './pages/Landing';
import { Login, Register } from './pages/auth';
import { useAuth } from './lib/auth';
import { PublicOnly, RequireAuth } from './lib/RequireAuth';

interface NavItem {
  to: string;
  label: string;
  ikon: string;
}

const NAV: { grup: string; items: NavItem[] }[] = [
  {
    grup: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', ikon: 'home' },
      { to: '/generate', label: 'Generator Jadwal', ikon: 'generate' },
      { to: '/jadwal', label: 'Grid Jadwal', ikon: 'jadwal' },
      { to: '/konflik', label: 'Pemeriksa Konflik', ikon: 'konflik' },
    ],
  },
  {
    grup: 'Data Sekolah',
    items: [
      { to: '/sekolah', label: 'Identitas Sekolah', ikon: 'sekolah' },
      { to: '/guru', label: 'Guru', ikon: 'guru' },
      { to: '/kelas', label: 'Kelas', ikon: 'kelas' },
      { to: '/siswa', label: 'Siswa', ikon: 'siswa' },
      { to: '/mapel', label: 'Mata Pelajaran', ikon: 'mapel' },
      { to: '/ruang', label: 'Ruang', ikon: 'ruang' },
      { to: '/jam', label: 'Jam Pelajaran', ikon: 'jam' },
      { to: '/kebutuhan', label: 'Kebutuhan Jam', ikon: 'daftar' },
      { to: '/batasan', label: 'Batasan & Blokir', ikon: 'blokir' },
    ],
  },
  {
    grup: 'Hasil',
    items: [
      { to: '/jadwal-matriks', label: 'Matriks & Cetak', ikon: 'sekolah' },
      { to: '/berkas', label: 'Berkas & Data', ikon: 'berkas' },
      { to: '/publikasi', label: 'Publikasi', ikon: 'bagikan' },
    ],
  },
];

function Layout() {
  const { project } = useProject();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [menu, setMenu] = useState(false);

  // Dibuka lewat tautan publikasi → tampilan penuh tanpa sidebar.
  if (location.pathname === '/publikasi' && new URLSearchParams(location.search).has('d')) {
    return <PublikasiReadonly />;
  }

  const jumlahError = useMemo(
    () => checkConflicts(project).filter((k) => k.tingkat === 'error').length,
    [project],
  );

  const judul = NAV.flatMap((g) => g.items).find(
    (i) => i.to === location.pathname,
  )?.label ?? 'Dashboard';

  return (
    <div className="app">
      <div
        className={`overlay-sidelayer ${menu ? 'buka' : ''}`}
        onClick={() => setMenu(false)}
      />
      <aside className={`sidebar ${menu ? 'buka' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <img src="/logo-sekolah.png" alt="Logo sekolah" />
          </div>
          <div>
            <div className="brand-name">Jadwal Sekolah</div>
            <div className="brand-sub">{project.info.nama || 'Perencana Jadwal'}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.grup}>
              <div className="nav-group">{g.grup}</div>
              {g.items.map((it) => (
                <button
                  key={it.to}
                  className={`nav-link ${location.pathname === it.to ? 'aktif' : ''}`}
                  onClick={() => {
                    window.location.hash = `#${it.to}`;
                    setMenu(false);
                  }}
                >
                  <Icon name={it.ikon} size={17} />
                  {it.label}
                  {it.to === '/konflik' && jumlahError > 0 ? (
                    <span className="nav-badge">{jumlahError}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          Tahun Ajaran {project.info.tahunAjaran || '—'}
          <br />
          {user ? `${user.nama} · ${user.mode === 'cloud' ? 'Tersinkron cloud' : 'Tersimpan di perangkat'}` : 'Tersimpan otomatis di perangkat ini'}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu">
            <span style={{ fontSize: 16, lineHeight: 1 }}>☰</span>
          </button>
          <div>
            <div className="topbar-title">{judul}</div>
            <div className="topbar-crumb">{project.info.nama || 'Aplikasi Jadwal'} · Perencana jadwal pelajaran</div>
          </div>
          <div className="topbar-right">
            <span className="badge badge-abu">{project.jadwal.length} jam terjadwal</span>
            <span className={`badge ${jumlahError ? 'badge-merah' : 'badge-hijau'}`}>
              {jumlahError ? `${jumlahError} konflik` : 'Tanpa konflik'}
            </span>
            {user ? (
              <Btn size="sm" variant="ghost" icon="keluar" title={`${user.email}`} onClick={() => void signOut()}>
                Keluar
              </Btn>
            ) : null}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Rute publik — hanya untuk pengunjung yang belum masuk. */}
      <Route element={<PublicOnly><Outlet /></PublicOnly>}>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Rute aplikasi — terlindungi: bila belum masuk, diarahkan ke Landing. */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sekolah" element={<HalSekolah />} />
        <Route path="/guru" element={<HalGuru />} />
        <Route path="/kelas" element={<HalKelas />} />
        <Route path="/siswa" element={<HalSiswa />} />
        <Route path="/mapel" element={<HalMapel />} />
        <Route path="/ruang" element={<HalRuang />} />
        <Route path="/jam" element={<HalJam />} />
        <Route path="/kebutuhan" element={<HalKebutuhan />} />
        <Route path="/batasan" element={<HalBlokir />} />
        <Route path="/generate" element={<HalGenerate />} />
        <Route path="/jadwal" element={<HalJadwal />} />
        <Route path="/jadwal-matriks" element={<HalMatriks />} />
        <Route path="/konflik" element={<HalKonflik />} />
        <Route path="/berkas" element={<HalBerkas />} />
        <Route path="/publikasi" element={<HalPublikasi />} />
      </Route>

      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}
