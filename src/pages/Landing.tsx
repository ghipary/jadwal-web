import { Btn, Card } from '../ui';

export function Landing() {
  return (
    <div className="page-head" style={{ minHeight: 'calc(100vh - 40px)', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ maxWidth: 640, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Jadwal Sekolah</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Aplikasi perencana jadwal pelajaran sederhana, cepat, dan terstruktur. Kelola data guru, kelas, mata pelajaran,
          kebutuhan jam, lalu hasilkan jadwal dengan pemeriksa konflik otomatis. Data tersimpan aman per pengguna (multi-tenant).
        </p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Btn variant="primary" onClick={() => (window.location.hash = '#/login')}>Masuk</Btn>
          <Btn variant="ghost" onClick={() => (window.location.hash = '#/register')}>Daftar</Btn>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Versi 1.0 · Bisa dijalankan offline (localStorage) atau terhubung ke Supabase untuk sinkronisasi & autentikasi.
        </div>
      </Card>
    </div>
  );
}
