// Uji render seluruh rute (react-dom/server) untuk menangkap error runtime.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, type Pengguna } from '../src/lib/auth';
import { ProjectProvider } from '../src/store';
import App from '../src/App';

const penggunaUji: Pengguna = {
  id: 'uji-123',
  email: 'uji@contoh.test',
  nama: 'Pengguna Uji',
  mode: 'lokal',
};

/** Rute aplikasi — harus bisa dirender oleh pengguna yang sudah masuk. */
const rutePrivat = [
  '/',
  '/sekolah',
  '/guru',
  '/kelas',
  '/siswa',
  '/mapel',
  '/ruang',
  '/jam',
  '/kebutuhan',
  '/batasan',
  '/generate',
  '/jadwal',
  '/jadwal-matriks',
  '/konflik',
  '/berkas',
  '/petunjuk',
  '/publikasi',
];

/** Rute publik — hanya untuk pengunjung yang belum masuk. */
const rutePublik = ['/landing', '/login', '/register'];

function render(rute: string, pengguna: Pengguna | null): string {
  return renderToString(
    <AuthProvider penggunaAwal={pengguna}>
      <ProjectProvider>
        <MemoryRouter initialEntries={[rute]}>
          <App />
        </MemoryRouter>
      </ProjectProvider>
    </AuthProvider>,
  );
}

let gagal = 0;

// 1) Rute privat sebagai pengguna yang sudah masuk → harus tampil penuh.
for (const r of rutePrivat) {
  try {
    const html = render(r, penggunaUji);
    if (html.length < 300) throw new Error(`terlalu pendek (${html.length} char)`);
    console.log(`OK   privat      ${r.padEnd(14)} ${html.length} char`);
  } catch (e) {
    gagal++;
    console.log(`GAGAL privat ${r}:`, e instanceof Error ? e.message : e);
  }
}

// 2) Rute publik tanpa sesi → halaman Landing/Login/Register tampil.
for (const r of rutePublik) {
  try {
    const html = render(r, null);
    if (html.length < 300) throw new Error(`terlalu pendek (${html.length} char)`);
    console.log(`OK   publik      ${r.padEnd(14)} ${html.length} char`);
  } catch (e) {
    gagal++;
    console.log(`GAGAL publik ${r}:`, e instanceof Error ? e.message : e);
  }
}

// 3) Proteksi rute: tanpa sesi, rute privat harus dialihkan (render kosong).
try {
  const html = render('/guru', null);
  if (html.length >= 300) {
    throw new Error(`tidak dialihkan — html ${html.length} char`);
  }
  console.log(`OK   proteksi    /guru          teralihkan (${html.length} char)`);
} catch (e) {
  gagal++;
  console.log('GAGAL proteksi /guru:', e instanceof Error ? e.message : e);
}

// 4) Struktur Grid Jadwal (halaman /jadwal): tabel kaku, tanpa tombol "+".
try {
  const html = render('/jadwal', penggunaUji);
  const cek = (nama: string, syarat: boolean) => {
    if (!syarat) throw new Error(`tidak terpenuhi: ${nama}`);
    console.log(`OK   grid         ${nama}`);
  };
  cek('memakai <table class="tt">', html.includes('<table class="tt">'));
  cek('memakai <th class="jam-cell">', html.includes('class="jam-cell"'));
  cek('sel pakai class "cell"', /class="cell[ "]/i.test(html));
  cek('tanpa tombol les-tambah', !html.includes('les-tambah'));
  cek('tanpa placeholder libur-tanda', !html.includes('libur-tanda'));
  cek('kartu les bukan <button>', !/<button[^>]*class="[^"]*\bles\b/i.test(html));
} catch (e) {
  gagal++;
  console.log('GAGAL grid struktur:', e instanceof Error ? e.message : e);
}

console.log(gagal === 0 ? '\nRENDER LULUS ✅' : `\nRENDER GAGAL ❌ (${gagal})`);
process.exit(gagal === 0 ? 0 : 1);
