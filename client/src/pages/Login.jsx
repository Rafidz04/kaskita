import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader2, ArrowRight, Moon, Sun } from 'lucide-react';
import { useAuth, useTheme } from '../lib/context.jsx';
import { api } from '../lib/api.js';
import { compact } from '../lib/format.js';

export default function Login() {
  const { user, login, enterGuest } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [peek, setPeek] = useState(null);

  useEffect(() => { api.get('/dashboard', { auth: false }).then(setPeek).catch(() => {}); }, []);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(username, password);
      nav('/');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const guest = () => { enterGuest(); nav('/'); };

  return (
    <div className="login-page">
      <div className="bg-blobs"><span /><span /><span /></div>
      <div className="bg-grid" />

      <section className="login-art page-enter">
        <div className="row-between">
          <div className="brand" style={{ padding: 0 }}>
            <span className="brand-logo">💸</span>
            <div><div className="brand-name">Kas<em>Kita</em></div><div className="brand-sub">Petty Cash Tracker</div></div>
          </div>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema" id="login-theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        </div>

        <div style={{ padding: '36px 0 24px' }}>
          <h1>Kas <span className="grad">transparan</span>,<br />circle <span className="lime">aman</span>. 🫶</h1>
          <p className="lead">Pantau saldo, pemasukan, pengeluaran, sampai siapa yang belum setor iuran — semuanya real-time. No more “eh kas gw udah bayar belom ya?” 🙃</p>
          <div className="floating-stickers">
            <span className="sticker">💰 Iuran 20rb/bln</span>
            <span className="sticker">📊 Dashboard live</span>
            <span className="sticker">👀 Siapa yg nunggak</span>
            <span className="sticker">🔐 Admin only edit</span>
          </div>
          {peek && (
            <div className="login-preview">
              <div className="mini-stat"><small>Sisa kas</small><b>{compact(peek.summary.balance)}</b></div>
              <div className="mini-stat"><small>Anggota</small><b>{peek.summary.memberCount} orang</b></div>
              <div className="mini-stat"><small>Belum setor</small><b>{peek.summary.unpaidCount} orang</b></div>
            </div>
          )}
        </div>
        <p className="muted hide-mobile" style={{ fontSize: 13 }}>© {new Date().getFullYear()} KasKita · dibuat dengan 💜 & sedikit gorengan</p>
      </section>

      <section className="login-panel">
        <div className="card login-card page-enter">
          <h2>Masuk dulu, bestie ✌️</h2>
          <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>Khusus Admin & Super Admin buat ngelola kas.</p>

          <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <div className="input-wrap">
                <User size={18} />
                <input id="login-username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
              </div>
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <Lock size={18} />
                <input id="login-password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" className="icon-btn sm suffix" onClick={() => setShow((s) => !s)} aria-label="Lihat password" style={{ background: 'none', border: 0 }}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {err && <div className="error-box">{err}</div>}
            <button className="btn btn-primary btn-block" style={{ height: 50, fontSize: 15 }} disabled={busy || !username || !password} id="login-submit">
              {busy ? <Loader2 size={18} className="spin" /> : <>Masuk <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="divider">atau</div>

          <button className="guest-btn" onClick={guest} id="login-guest">
            <span className="ge">👀</span>
            <span className="grow"><b>Masuk sebagai Tamu</b><small>Lihat dashboard & siapa yang belum bayar — tanpa login</small></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
