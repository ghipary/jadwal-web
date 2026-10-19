// Halaman Daftar (Supabase Auth) — membuat akun baru multi-tenant.
// Setiap akun setara: data yang dibuat hanya terlihat oleh pemiliknya (RLS).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Btn } from '../../ui';
import { useAuth } from '../../lib/auth';
import { AuthShell } from './Shell';

export function Register() {
  const { signUp, masukTamu, supabaseSiap } = useAuth();
  const navigate = useNavigate();
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [ulang, setUlang] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSukses(null);
    if (pass !== ulang) {
      setErr('Pengulangan kata sandi tidak sama.');
      return;
    }
    if (pass.length < 6) {
      setErr('Kata sandi minimal 6 karakter.');
      return;
    }
    setSibuk(true);
    const hasil = await signUp(nama.trim(), email.trim(), pass);
    setSibuk(false);
    if (hasil.error) {
      setErr(hasil.error.message);
      return;
    }
    if (hasil.konfirmasiEmail) {
      setSukses(
        'Akun berhasil dibuat! Periksa email Anda untuk konfirmasi, lalu kembali ke halaman Masuk.',
      );
      return;
    }
    setSukses('Akun berhasil dibuat — membuka aplikasi…');
    navigate('/', { replace: true });
  };

  const modeLokal = () => {
    masukTamu();
    navigate('/', { replace: true });
  };

  return (
    <AuthShell
      judul="Daftar"
      sub="Buat akun untuk mulai menyusun jadwal — data Anda terikat pada akun Anda."
      bawah={
        <>
          Sudah punya akun? <a href="#/login">Masuk</a>
        </>
      }
    >
      {err ? (
        <Banner tone="bahaya" icon="konflik">
          {err}
        </Banner>
      ) : null}
      {sukses ? (
        <Banner tone="sukses" icon="cek">
          {sukses}
          {supabaseSiap ? null : (
            <div style={{ marginTop: 8 }}>
              <Btn size="sm" variant="ghost" icon="masuk" onClick={() => navigate('/login')}>
                Buka Halaman Masuk
              </Btn>
            </div>
          )}
        </Banner>
      ) : null}

      <form className="auth-form" onSubmit={kirim}>
        <div className="field">
          <label htmlFor="reg-nama">Nama Lengkap</label>
          <input
            id="reg-nama"
            className="input"
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth. Siti Aminah, S.Pd."
            required
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@sekolah.sch.id"
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-sandi">Kata Sandi</label>
          <input
            id="reg-sandi"
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="minimal 6 karakter"
            minLength={6}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-ulang">Ulangi Kata Sandi</label>
          <input
            id="reg-ulang"
            className="input"
            type="password"
            value={ulang}
            onChange={(e) => setUlang(e.target.value)}
            placeholder="ketik ulang kata sandi"
            minLength={6}
            required
            autoComplete="new-password"
          />
        </div>
        <Btn variant="primary" type="submit" disabled={sibuk} icon="tambah">
          {sibuk ? 'Memproses…' : 'Daftar'}
        </Btn>
      </form>

      {!supabaseSiap ? (
        <div className="auth-lokal">
          <Btn variant="ghost" icon="putar" onClick={modeLokal}>
            Coba Mode Lokal (tanpa akun)
          </Btn>
          <span className="hint">
            Data hanya tersimpan di browser ini dan tidak dipindahkan ke cloud.
          </span>
        </div>
      ) : null}
    </AuthShell>
  );
}
