// Halaman Masuk (Supabase Auth) + Mode Lokal bila backend belum dikonfigurasi.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Btn, Icon } from '../../ui';
import { useAuth } from '../../lib/auth';
import { AuthShell } from './Shell';

export function Login() {
  const { signIn, masukTamu, supabaseSiap } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSukses(null);
    setSibuk(true);
    const hasil = await signIn(email.trim(), pass);
    setSibuk(false);
    if (hasil.error) {
      setErr(hasil.error.message);
      return;
    }
    setSukses('Berhasil masuk — membuka aplikasi…');
    navigate('/', { replace: true });
  };

  const modeLokal = () => {
    masukTamu();
    navigate('/', { replace: true });
  };

  return (
    <AuthShell
      judul="Masuk"
      sub="Gunakan akun terdaftar untuk mengakses data jadwal Anda."
      bawah={
        <>
          Belum punya akun? <a href="#/register">Daftar gratis</a>
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
        </Banner>
      ) : null}

      <form className="auth-form" onSubmit={kirim}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
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
          <label htmlFor="login-sandi">Kata Sandi</label>
          <input
            id="login-sandi"
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        <Btn variant="primary" type="submit" disabled={sibuk} icon="masuk">
          {sibuk ? 'Memproses…' : 'Masuk'}
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
