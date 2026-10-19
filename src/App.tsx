// Kerangka aplikasi: sidebar, topbar, dan pemetaan rute.

import { useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useProject } from './store';
import { checkConflicts } from './scheduler';
import { Icon } from './ui';
import { Dashboard } from './pages/Dashboard';
import { HalBlokir, HalGuru, HalJam, HalKelas, HalMapel, HalRuang, HalSiswa } from './pages/entities';
import { HalKebutuhan } from './pages/Kebutuhan';
import { HalGenerate } from './pages/Generate';
import { HalJadwal } from './pages/Jadwal';
import { HalKonflik } from './pages/Konflik';
import { HalBerkas } from './pages/Berkas';
import { HalPublikasi, PublikasiReadonly } from './pages/Publikasi';

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
      { to: '/berkas', label: 'Berkas & Data', ikon: 'berkas' },
      { to: '/publikasi', label: 'Publikasi', ikon: 'bagikan' },
    ],
  },
];

function Layout() {
  const { project } = useProject();
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
            <Icon name="jadwal" size={20} />
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
          Tersimpan otomatis di perangkat ini
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
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
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
        <Route path="/konflik" element={<HalKonflik />} />
        <Route path="/berkas" element={<HalBerkas />} />
        <Route path="/publikasi" element={<HalPublikasi />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
