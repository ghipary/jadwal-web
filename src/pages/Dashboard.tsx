// Dashboard: ringkasan data, progres penjadwalan, beban guru, konflik terbaru.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../store';
import { useAuth } from '../lib/auth';
import { checkConflicts } from '../scheduler';
import { Banner, Btn, Card, Icon, PageHead } from '../ui';

export function Dashboard() {
  const { project } = useProject();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const keluar = async () => {
    await signOut();
    navigate('/landing', { replace: true });
  };

  const totalKebutuhan = project.kebutuhan.reduce((a, r) => a + r.jumlahJam, 0);
  const terjadwal = project.jadwal.length;
  const tetap = project.jadwal.filter((j) => j.tetap).length;
  const persen = totalKebutuhan ? Math.min(100, Math.round((terjadwal / totalKebutuhan) * 100)) : 0;

  const konflik = useMemo(() => checkConflicts(project), [project]);
  const jumlahError = konflik.filter((k) => k.tingkat === 'error').length;
  const jumlahWarning = konflik.filter((k) => k.tingkat === 'peringatan').length;
  const konflikTerkini = konflik.filter((k) => k.id !== 'aman').slice(0, 5);

  const bebanGuru = project.guru
    .map((g) => ({ g, n: project.jadwal.filter((j) => j.guruId === g.id).length }))
    .sort((a, b) => b.n - a.n);

  const stats = [
    { label: 'Guru', val: project.guru.length, ic: 'guru', cls: 'i-brand' },
    { label: 'Kelas', val: project.kelas.length, ic: 'kelas', cls: 'i-biru' },
    { label: 'Siswa', val: project.siswa.length, ic: 'siswa', cls: 'i-pink' },
    { label: 'Mata Pelajaran', val: project.mapel.length, ic: 'mapel', cls: 'i-sukses' },
    { label: 'Jam/Minggu Dibutuhkan', val: totalKebutuhan, ic: 'daftar', cls: 'i-brand' },
  ];

  return (
    <>
      <PageHead
        title={`Selamat datang di ${project.info.nama || 'Aplikasi Jadwal'}`}
        desc={`Tahun Ajaran ${project.info.tahunAjaran} — kelola data sekolah, generate jadwal otomatis, periksa konflik, lalu bagikan hasilnya.`}
        actions={
          <>
            {user ? (
              <span className="badge badge-abu" title={`Masuk sebagai ${user.email}`}>
                <Icon name="siswa" size={13} />
                {user.nama || user.email}
              </span>
            ) : null}
            <Btn variant="ghost" icon="jadwal" onClick={() => navigate('/jadwal')}>
              Buka Jadwal
            </Btn>
            <Btn variant="ghost" icon="keluar" onClick={() => void keluar()} title="Keluar dari akun">
              Keluar
            </Btn>
            <Btn variant="primary" icon="generate" onClick={() => navigate('/generate')}>
              {terjadwal ? 'Generate Ulang' : 'Generate Jadwal'}
            </Btn>
          </>
        }
      />

      {terjadwal === 0 ? (
        <Banner
          tone="info"
          icon="generate"
          action={
            <Btn size="sm" variant="primary" onClick={() => navigate('/generate')}>
              Mulai Generate
            </Btn>
          }
        >
          Data contoh sudah siap — {totalKebutuhan} jam kebutuhan menunggu dijadwalkan. Tekan{' '}
          <b>Generate Jadwal</b> untuk menyusun otomatis.
        </Banner>
      ) : jumlahError > 0 ? (
        <Banner
          tone="bahaya"
          icon="konflik"
          action={
            <Btn size="sm" variant="ghost" onClick={() => navigate('/konflik')}>
              Lihat Konflik
            </Btn>
          }
        >
          Ada <b>{jumlahError}</b> konflik keras pada jadwal saat ini.
        </Banner>
      ) : (
        <Banner
          tone="sukses"
          icon="cek"
          action={
            <Btn size="sm" variant="ghost" onClick={() => navigate('/publikasi')}>
              Publikasikan
            </Btn>
          }
        >
          Jadwal aktif tanpa konflik keras. Bagikan ke siswa/guru lewat halaman Publikasi.
        </Banner>
      )}

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className={`stat-ic ${s.cls}`}>
              <Icon name={s.ic} size={19} />
            </div>
            <div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card>
          <div className="card-title">Progres Penjadwalan</div>
          <div className="card-sub">
            {terjadwal} dari {totalKebutuhan} jam kebutuhan sudah masuk grid.
          </div>
          <div className="bar" style={{ marginBottom: 12 }}>
            <div style={{ width: `${persen}%` }} />
          </div>
          <div className="kv">
            <span className="k">Persentase terpenuhi</span>
            <span className="v">{persen}%</span>
          </div>
          <div className="kv">
            <span className="k">Jadwal tetap (terkunci)</span>
            <span className="v">{tetap} jam</span>
          </div>
          <div className="kv">
            <span className="k">Konflik keras / peringatan</span>
            <span className="v">
              <span className={`badge ${jumlahError ? 'badge-merah' : 'badge-hijau'}`}>{jumlahError}</span>{' '}
              <span className={`badge ${jumlahWarning ? 'badge-kuning' : 'badge-hijau'}`}>{jumlahWarning}</span>
            </span>
          </div>
        </Card>

        <Card>
          <div className="card-title">Kebutuhan per Kelas</div>
          <div className="card-sub">Perbandingan jam terjadwal terhadap jam yang dibutuhkan.</div>
          <ul className="mini-list">
            {project.kelas.map((c) => {
              const butuh = project.kebutuhan
                .filter((k) => k.kelasId === c.id)
                .reduce((a, k) => a + k.jumlahJam, 0);
              const ada = project.jadwal.filter((j) => j.kelasId === c.id).length;
              const p = butuh ? Math.min(100, Math.round((ada / butuh) * 100)) : 0;
              return (
                <li key={c.id}>
                  <b style={{ minWidth: 60 }}>{c.nama}</b>
                  <div className="bar" style={{ flex: 1 }}>
                    <div style={{ width: `${p}%` }} />
                  </div>
                  <span className="kanan">
                    {ada}/{butuh} jam
                  </span>
                </li>
              );
            })}
            {project.kelas.length === 0 ? <li className="hint">Belum ada data kelas.</li> : null}
          </ul>
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card>
          <div className="card-title">Beban Jam Guru</div>
          <div className="card-sub">Jam terjadwal dibanding batas maksimum tiap guru.</div>
          <ul className="mini-list">
            {bebanGuru.slice(0, 8).map(({ g, n }) => (
              <li key={g.id}>
                <span style={{ minWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.nama.split(',')[0]}
                </span>
                <div className="bar" style={{ flex: 1 }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((n / Math.max(1, g.maxJam)) * 100))}%`,
                      background: n > g.maxJam ? '#e5484d' : undefined,
                    }}
                  />
                </div>
                <span className={`kanan ${n > g.maxJam ? 'badge badge-merah' : ''}`}>
                  {n}/{g.maxJam}
                </span>
              </li>
            ))}
            {bebanGuru.length === 0 ? <li className="hint">Belum ada data guru.</li> : null}
          </ul>
        </Card>

        <Card>
          <div className="card-title">Konflik Terbaru</div>
          <div className="card-sub">Pelanggaran yang terdeteksi pada pemeriksaan terakhir.</div>
          {konflikTerkini.length === 0 ? (
            <div className="banner banner-sukses" style={{ marginBottom: 0 }}>
              <Icon name="cek" size={17} />
              <div className="banner-body">Tidak ada konflik — jadwal bersih.</div>
            </div>
          ) : (
            <ul className="mini-list">
              {konflikTerkini.map((k) => (
                <li key={k.id}>
                  <span className={`badge ${k.tingkat === 'error' ? 'badge-merah' : 'badge-kuning'}`}>
                    {k.tingkat === 'error' ? 'Keras' : 'Info'}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.pesan}
                  </span>
                </li>
              ))}
              <li>
                <Btn size="sm" variant="soft" icon="kanan" onClick={() => navigate('/konflik')}>
                  Semua Konflik ({konflik.filter((k) => k.id !== 'aman').length})
                </Btn>
              </li>
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
