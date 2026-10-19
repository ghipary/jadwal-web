import { useState } from 'react';
import { Btn, Card, Banner } from '../../ui';
import { useAuth } from '../../lib/auth';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoad(true);
    const { error } = await signIn(email.trim(), pass);
    setLoad(false);
    if (error) { setErr(error.message); return; }
    window.location.hash = '#/';
  };

  return (
    <div className="page-head" style={{ minHeight: 'calc(100vh - 40px)', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 420 }}>
        <div className="card-title">Masuk</div>
        <div className="card-sub">Gunakan akun terdaftar untuk mengakses aplikasi.</div>
        {err ? <Banner tone="bahaya" icon="konflik">{err}</Banner> : null}
        <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label>Kata Sandi</label>
            <input className="input" type="password" value={pass} onChange={(e)=>setPass(e.target.value)} required autoComplete="current-password" />
          </div>
          <Btn variant="primary" type="submit" disabled={load}>{load ? 'Memproses...' : 'Masuk'}</Btn>
        </form>
        <div className="card-sub" style={{ marginTop: 10 }}>
          Belum punya akun? <a href="#/register">Daftar</a>
        </div>
      </Card>
    </div>
  );
}
