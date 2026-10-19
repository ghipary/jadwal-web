import { useState } from 'react';
import { Btn, Card, Banner } from '../../ui';
import { useAuth } from '../../lib/auth';

export function Register() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setLoad(true);
    const { error } = await signUp(email.trim(), pass);
    setLoad(false);
    if (error) { setErr(error.message); return; }
    setInfo('Pendaftaran berhasil. Periksa email untuk verifikasi jika Supabase mengharuskannya. Anda bisa langsung login jika sudah terverifikasi.');
  };

  return (
    <div className="page-head" style={{ minHeight: 'calc(100vh - 40px)', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 420 }}>
        <div className="card-title">Daftar</div>
        <div className="card-sub">Buat akun baru untuk memulai.</div>
        {err ? <Banner tone="bahaya" icon="konflik">{err}</Banner> : null}
        {info ? <Banner tone="sukses" icon="cek">{info}</Banner> : null}
        <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label>Kata Sandi</label>
            <input className="input" type="password" value={pass} onChange={(e)=>setPass(e.target.value)} minLength={6} required autoComplete="new-password" />
          </div>
          <Btn variant="primary" type="submit" disabled={load}>{load ? 'Memproses...' : 'Daftar'}</Btn>
        </form>
        <div className="card-sub" style={{ marginTop: 10 }}>
          Sudah punya akun? <a href="#/login">Masuk</a>
        </div>
      </Card>
    </div>
  );
}
