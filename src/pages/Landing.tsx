// Halaman Landing (publik): penjelasan singkat aplikasi + tombol Masuk/Daftar.
// Hanya tampil untuk pengunjung yang belum masuk (lihat PublicOnly).

import { useNavigate } from 'react-router-dom';
import { Btn, Icon } from '../ui';
import { useAuth } from '../lib/auth';

const FITUR = [
  {
    ikon: 'guru',
    judul: 'Data sekolah lengkap',
    teks: 'Guru, kelas, siswa, mata pelajaran, jam pelajaran, dan kebutuhan jam — semuanya terkelola rapi.',
  },
  {
    ikon: 'generate',
    judul: 'Generate otomatis',
    teks: 'Constraint solver menyusun jadwal: kelas dan guru tidak pernah bentrok, jam guru tetap dalam batas.',
  },
  {
    ikon: 'konflik',
    judul: 'Pemeriksa konflik',
    teks: 'Setiap pelanggaran terdeteksi otomatis lengkap dengan tautan “Lihat di Jadwal” untuk perbaikan cepat.',
  },
  {
    ikon: 'jadwal',
    judul: 'Edit seret & lepas',
    teks: 'Ubah grid jadwal secara manual, kunci pelajaran tertentu, atau tambah jam baru langsung dari papan.',
  },
  {
    ikon: 'unduh',
    judul: 'Ekspor & cetak',
    teks: 'Unduh JSON, ekspor CSV per jenis data, siapkan lewat template Excel, lalu cetak lembar jadwal resmi.',
  },
  {
    ikon: 'bagikan',
    judul: 'Bagikan tanpa login',
    teks: 'Hasil jadwal dapat dibagikan lewat tautan baca-saja untuk siswa, guru, dan wali kelas.',
  },
];

const LANGKAH = [
  {
    n: '1',
    judul: 'Isi data sekolah',
    teks: 'Masukkan guru, kelas, mata pelajaran, dan kebutuhan jam per minggu — bisa lewat form atau impor Excel massal.',
  },
  {
    n: '2',
    judul: 'Generate jadwal',
    teks: 'Tekan tombol generate. Solver berjalan beberapa kali dan memilih hasil terbaik tanpa konflik keras.',
  },
  {
    n: '3',
    judul: 'Periksa & bagikan',
    teks: 'Periksa pemeriksa konflik, lalu cetak atau bagikan jadwal final ke warga sekolah.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { user, supabaseSiap } = useAuth();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="brand-logo">
            <img src="/logo-sekolah.png" alt="Logo sekolah" />
          </div>
          <div>
            <b>Jadwal Sekolah</b>
            <span>Perencana Jadwal Pelajaran</span>
          </div>
        </div>
        <div className="landing-nav-aksi">
          {user ? (
            <Btn variant="primary" icon="kanan" onClick={() => navigate('/')}>
              Buka Aplikasi
            </Btn>
          ) : (
            <>
              <Btn variant="ghost" icon="masuk" onClick={() => navigate('/login')}>
                Masuk
              </Btn>
              <Btn variant="primary" icon="tambah" onClick={() => navigate('/register')}>
                Daftar
              </Btn>
            </>
          )}
        </div>
      </header>

      <main className="landing-body">
        <section className="landing-hero">
          <div className="landing-hero-teks">
            <span className="landing-pill">
              <Icon name="generate" size={14} /> Gratis dipakai · Tanpa spreadsheet berantakan
            </span>
            <h1>
              Susun jadwal pelajaran sekolah <span>otomatis</span> dalam hitungan detik
            </h1>
            <p>
              Aplikasi perencana jadwal yang cepat dan terstruktur: kelola data guru, kelas, siswa,
              dan mata pelajaran; jalankan generator; periksa konflik; lalu bagikan hasilnya —
              seluruh data terikat pada akun Anda sendiri (multi-tenant).
            </p>
            <div className="landing-cta">
              <Btn variant="primary" icon="masuk" onClick={() => navigate(user ? '/' : '/login')}>
                {user ? 'Buka Aplikasi' : 'Masuk'}
              </Btn>
              <Btn variant="ghost" icon="tambah" onClick={() => navigate(user ? '/' : '/register')}>
                {user ? 'Lihat Dashboard' : 'Daftar Gratis'}
              </Btn>
            </div>
            <ul className="landing-poin">
              <li>
                <Icon name="cek" size={14} /> Data tersimpan per pengguna — tidak ada admin, semua setara
              </li>
              <li>
                <Icon name="cek" size={14} /> Bisa dipakai offline (perangkat) atau sinkron ke Supabase
              </li>
              <li>
                <Icon name="cek" size={14} /> Ekspor JSON/CSV/Excel dan cetak lembar resmi
              </li>
            </ul>
          </div>

          {/* Pratinjau mini grid jadwal */}
          <div className="landing-panel" aria-hidden="true">
            <div className="landing-panel-head">
              <b>Jadwal XI-1</b>
              <span>Senin – Sabtu</span>
            </div>
            <div className="landing-panel-grid">
              {[
                ['Matematika', 'Fisika', 'Bahasa Indonesia', 'PJOK', 'Informatika'],
                ['Fisika', 'Matematika', 'Sejarah', 'Bahasa Inggris', 'Kimia'],
                ['Bahasa Indonesia', 'PPKn', 'Matematika', 'Biologi', 'Bahasa Jawa'],
                ['Kimia', 'Bahasa Inggris', 'Fisika', 'Matematika', 'Seni Budaya'],
              ].map((baris, i) => (
                <div className="landing-baris" key={i}>
                  <span className="landing-hari">{'Sen Rab Kam Jum'.split(' ')[i] ?? 'Sab'}</span>
                  {baris.map((m, j) => (
                    <span
                      key={j}
                      className={`landing-seluk warna-${(i + j) % 5}`}
                      style={{ opacity: 1 - j * 0.12 }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="landing-panel-foot">
              <span className="badge badge-hijau">0 konflik</span>
              <span className="badge badge-abu">206 jam terjadwal</span>
            </div>
          </div>
        </section>

        {!supabaseSiap ? (
          <div className="banner banner-info landing-banner">
            <Icon name="info" size={17} />
            <div className="banner-body">
              <b>Mode lokal aktif.</b> Kunci backend Supabase belum diisi (berkas{' '}
              <code>.env.local</code>) — isi <code>VITE_SUPABASE_URL</code> &amp;{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> untuk mengaktifkan login dan sinkronisasi cloud.
              Anda tetap dapat mencoba aplikasi dengan Mode Lokal.
            </div>
          </div>
        ) : null}

        <section className="landing-sec">
          <h2>Segalanya yang dibutuhkan tim kurikulum</h2>
          <p className="landing-sec-sub">
            Dari pendataan hingga publikasi — satu aplikasi untuk seluruh proses penyusunan jadwal.
          </p>
          <div className="landing-fitur">
            {FITUR.map((f) => (
              <div className="fitur-card" key={f.judul}>
                <div className="fitur-ic">
                  <Icon name={f.ikon} size={19} />
                </div>
                <b>{f.judul}</b>
                <p>{f.teks}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-sec">
          <h2>Tiga langkah saja</h2>
          <div className="landing-cara">
            {LANGKAH.map((l) => (
              <div className="langkah" key={l.n}>
                <span className="langkah-n">{l.n}</span>
                <b>{l.judul}</b>
                <p>{l.teks}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-sec landing-akhir">
          <h2>Siap menyusun jadwal?</h2>
          <div className="landing-cta">
            <Btn variant="primary" icon={user ? 'kanan' : 'tambah'} onClick={() => navigate(user ? '/' : '/register')}>
              {user ? 'Buka Aplikasi' : 'Buat Akun Gratis'}
            </Btn>
            <Btn variant="ghost" icon="masuk" onClick={() => navigate(user ? '/' : '/login')}>
              {user ? 'Dashboard' : 'Sudah punya akun? Masuk'}
            </Btn>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <span>Jadwal Sekolah · Perencana Jadwal Pelajaran</span>
        <span>Data Anda milik Anda sendiri — terikat pada akun, tanpa peran admin.</span>
      </footer>
    </div>
  );
}
