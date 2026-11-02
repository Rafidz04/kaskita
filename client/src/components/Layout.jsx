import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, CalendarCheck, Users, Settings, LogOut, Moon, Sun, LogIn, Plus } from 'lucide-react';
import { useAuth, useTheme } from '../lib/context.jsx';
import { useActions } from './Forms.jsx';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, emoji: '🏠', guest: true },
  { to: '/transaksi', label: 'Transaksi', short: 'Transaksi', icon: ReceiptText, emoji: '🧾' },
  { to: '/iuran', label: 'Iuran Kas', short: 'Iuran', icon: CalendarCheck, emoji: '💰' },
  { to: '/anggota', label: 'Anggota', short: 'Anggota', icon: Users, emoji: '👯' },
  { to: '/pengaturan', label: 'Pengaturan', short: 'Setting', icon: Settings, emoji: '⚙️' },
];

const TITLES = {
  '/': ['Dashboard', 'Semua info kas dalam satu layar'],
  '/transaksi': ['Transaksi', 'Catatan pemasukan & pengeluaran'],
  '/iuran': ['Iuran Kas', 'Siapa udah setor, siapa belum 👀'],
  '/anggota': ['Anggota', 'Daftar member kas'],
  '/pengaturan': ['Pengaturan', 'Akun, kas & user'],
};

export default function Layout() {
  const { user, guest, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const { openTx } = useActions();
  const loc = useLocation();
  const nav = useNavigate();
  const items = NAV.filter((n) => user || n.guest);
  const [title, sub] = TITLES[loc.pathname] || TITLES['/'];
  const roleLabel = user?.role === 'superadmin' ? 'Super Admin 👑' : 'Admin';

  const doLogout = () => { logout(); nav('/login'); };

  return (
    <div className="app">
      <div className="bg-blobs"><span /><span /><span /></div>
      <div className="bg-grid" />

      {user && (
        <aside className="sidebar">
          <NavLink to="/" className="brand" aria-label="KasKita home">
            <span className="brand-logo">💸</span>
            <span className="brand-text">
              <div className="brand-name">Kas<em>Kita</em></div>
              <div className="brand-sub">Petty Cash Tracker</div>
            </span>
          </NavLink>
          <div className="nav-label">Menu</div>
          {items.map(({ to, label, icon: Icon, emoji }) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav-link" id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`} title={label}>
              <Icon size={19} /> <span className="txt">{label}</span> <span className="nav-emoji">{emoji}</span>
            </NavLink>
          ))}
          <div className="sidebar-foot">
            <button className="btn btn-primary" onClick={() => openTx()} id="sidebar-add-tx" title="Catat transaksi">
              <Plus size={18} /> <span className="txt">Catat Transaksi</span>
            </button>
            <div className="user-chip">
              <Avatar name={user.name} size="sm" />
              <div className="meta"><b>{user.name}</b><small>{roleLabel}</small></div>
            </div>
          </div>
        </aside>
      )}

      <div className={`main ${user ? '' : 'no-sidebar'}`}>
        <header className="topbar">
          <NavLink to="/" className="topbar-brand" style={user ? undefined : { display: 'grid' }} aria-label="KasKita">
            <span className="brand-logo">💸</span>
          </NavLink>
          <div className="topbar-title">
            <h1>{guest ? <>Kas<span style={{ color: 'var(--accent)' }}>Kita</span></> : title}</h1>
            <p>{guest ? 'Mode tamu · lihat-lihat aja 👀' : sub}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema" id="theme-toggle" title="Ganti tema">
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {user ? (
              <button className="icon-btn danger" onClick={doLogout} aria-label="Keluar" id="logout-btn" title="Keluar"><LogOut size={18} /></button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={doLogout} id="guest-login-btn"><LogIn size={16} /> Login</button>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {user && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {items.map(({ to, short, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} id={`bnav-${short.toLowerCase()}`}>
              <Icon size={20} /> <span>{short}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
