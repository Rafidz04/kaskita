import { useEffect, useState } from 'react';
import { Save, UserPlus, Shield, KeyRound, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { useAuth, useToast } from '../lib/context.jsx';
import { api } from '../lib/api.js';
import { Avatar, Loader, ErrorState, Modal, MoneyInput, TagInput, Confirm } from '../components/ui.jsx';
import { rupiah } from '../lib/format.js';

export default function Settings() {
  const { user, isSuper, logout } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [cfg, setCfg] = useState({});
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passErr, setPassErr] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  // User management modal
  const [userModal, setUserModal] = useState(null); // null | { isEdit, data }
  const [delUserTarget, setDelUserTarget] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await api.get('/settings');
      setSettings(s);
      setCfg({
        orgName: s.orgName || 'KasKita',
        tagline: s.tagline || '',
        openingBalance: s.openingBalance || 0,
        openingDate: s.openingDate || '2026-08-29',
        duesAmount: s.duesAmount || 20000,
        periodStart: s.periodStart || '2026-09',
        periodEnd: s.periodEnd || '2027-05',
        voucherPrefix: s.voucherPrefix || 'PCV-',
        categories: s.categories || [],
        methods: s.methods || [],
      });

      if (isSuper) {
        const u = await api.get('/users');
        setUsers(u);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSuper]);

  const saveKasSettings = async (e) => {
    e.preventDefault();
    if (!isSuper) return;
    setBusy(true);
    try {
      const updated = await api.put('/settings', cfg);
      setSettings(updated);
      toast('Pengaturan kas berhasil disimpan ✨');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassErr('');
    if (passData.newPassword.length < 6) {
      return setPassErr('Password baru minimal 6 karakter!');
    }
    if (passData.newPassword !== passData.confirmPassword) {
      return setPassErr('Konfirmasi password tidak cocok!');
    }
    setPassBusy(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword,
      });
      toast('Password berhasil diubah! Silakan login ulang.');
      setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(logout, 1500);
    } catch (e) {
      setPassErr(e.message);
    } finally {
      setPassBusy(false);
    }
  };

  const handleSaveUser = async (data) => {
    setBusy(true);
    try {
      if (userModal.isEdit) {
        await api.put(`/users/${userModal.data.id}`, data);
        toast('Akun user diperbarui ✨');
      } else {
        await api.post('/users', data);
        toast('User baru berhasil ditambahkan 🎉');
      }
      setUserModal(null);
      loadData();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!delUserTarget) return;
    setBusy(true);
    try {
      await api.del(`/users/${delUserTarget.id}`);
      toast('User berhasil dihapus 🗑️');
      setDelUserTarget(null);
      loadData();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="page-enter stack" style={{ gap: 24 }}>
      <div className="hello">
        <div>
          <h2>⚙️ Pengaturan Aplikasi</h2>
          <p>Konfigurasi parameter kas, kelola akun pengguna, dan keamanan sistem</p>
        </div>
      </div>

      <div className="bento">
        {/* ===== PENGATURAN KAS UMUM ===== */}
        <section className="card span-7">
          <div className="card-head">
            <div>
              <h3>💼 Konfigurasi Buku Kas</h3>
              <p>{isSuper ? 'Sesuaikan nominal standar, saldo awal, dan periode kas' : 'Hanya Super Admin yang dapat mengubah konfigurasi ini'}</p>
            </div>
            {isSuper ? <span className="badge lime">Super Admin</span> : <span className="badge">Read Only</span>}
          </div>

          <form onSubmit={saveKasSettings} className="stack" style={{ gap: 16 }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-org">Nama Organisasi / Kelompok</label>
                <input
                  id="s-org"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.orgName}
                  onChange={(e) => setCfg({ ...cfg, orgName: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="s-tagline">Tagline Kas</label>
                <input
                  id="s-tagline"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.tagline}
                  onChange={(e) => setCfg({ ...cfg, tagline: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-dues">
                  Nominal Iuran Rutin (Default)
                  <small>paten {rupiah(cfg.duesAmount)}</small>
                </label>
                <MoneyInput
                  id="s-dues"
                  value={cfg.duesAmount}
                  onChange={(v) => isSuper && setCfg({ ...cfg, duesAmount: v })}
                />
                <span className="hint">Nominal default setiap form pembayaran kas terbuka (bisa disesuaikan per transaksi).</span>
              </div>

              <div className="field">
                <label htmlFor="s-open-bal">Dana Kas Awal</label>
                <MoneyInput
                  id="s-open-bal"
                  value={cfg.openingBalance}
                  onChange={(v) => isSuper && setCfg({ ...cfg, openingBalance: v })}
                />
                <span className="hint">Saldo awal sebelum pencatatan transaksi kas dimulai.</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-open-date">Tanggal Kas Awal</label>
                <input
                  id="s-open-date"
                  type="date"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.openingDate}
                  onChange={(e) => setCfg({ ...cfg, openingDate: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="s-prefix">Prefix No. Voucher</label>
                <input
                  id="s-prefix"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.voucherPrefix}
                  onChange={(e) => setCfg({ ...cfg, voucherPrefix: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-pstart">Bulan Mulai Periode</label>
                <input
                  id="s-pstart"
                  type="month"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.periodStart}
                  onChange={(e) => setCfg({ ...cfg, periodStart: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="s-pend">Bulan Selesai Periode</label>
                <input
                  id="s-pend"
                  type="month"
                  className="input"
                  disabled={!isSuper}
                  value={cfg.periodEnd}
                  onChange={(e) => setCfg({ ...cfg, periodEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Pilihan Kategori Transaksi</label>
              <TagInput
                value={cfg.categories}
                locked={['Iuran Kas']}
                onChange={(cats) => isSuper && setCfg({ ...cfg, categories: cats })}
                placeholder="Tambah kategori lalu tekan Enter..."
              />
            </div>

            <div className="field">
              <label>Pilihan Metode Pembayaran</label>
              <TagInput
                value={cfg.methods}
                onChange={(mets) => isSuper && setCfg({ ...cfg, methods: mets })}
                placeholder="Tambah metode bayar lalu tekan Enter..."
              />
            </div>

            {isSuper && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={busy} id="save-settings-btn">
                  <Save size={16} /> {busy ? 'Menyimpan...' : 'Simpan Pengaturan Kas'}
                </button>
              </div>
            )}
          </form>
        </section>

        {/* ===== AKUN SAYA & UBAH PASSWORD ===== */}
        <section className="card span-5">
          <div className="card-head">
            <div>
              <h3>🔐 Akun & Keamanan</h3>
              <p>Info profil kamu dan ganti kata sandi</p>
            </div>
            <span className="badge violet">{user.role.toUpperCase()}</span>
          </div>

          <div className="row" style={{ padding: 14, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
            <Avatar name={user.name} size="lg" />
            <div>
              <b style={{ fontSize: 16 }}>{user.name}</b>
              <div className="hint">@{user.username}</div>
              <div style={{ marginTop: 4 }}>
                <span className="badge lime" style={{ fontSize: 11 }}>{user.role === 'superadmin' ? '👑 Super Admin' : '🛡️ Admin'}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="stack" style={{ gap: 14 }}>
            <h4 style={{ fontSize: 15 }}>Ganti Password</h4>
            <div className="field">
              <label htmlFor="p-cur">Password Saat Ini</label>
              <input
                id="p-cur"
                type="password"
                className="input"
                value={passData.currentPassword}
                onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="p-new">Password Baru</label>
              <input
                id="p-new"
                type="password"
                className="input"
                value={passData.newPassword}
                onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                placeholder="Minimal 6 karakter"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="p-conf">Konfirmasi Password Baru</label>
              <input
                id="p-conf"
                type="password"
                className="input"
                value={passData.confirmPassword}
                onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                placeholder="Ulangi password baru"
                required
              />
            </div>

            {passErr && <div className="error-box">{passErr}</div>}

            <button className="btn btn-ghost" type="submit" disabled={passBusy} id="change-pass-btn">
              <KeyRound size={16} /> {passBusy ? 'Memproses...' : 'Ubah Password'}
            </button>
          </form>
        </section>

        {/* ===== KELOLA USER (KHUSUS SUPER ADMIN) ===== */}
        {isSuper && (
          <section className="card span-12">
            <div className="card-head">
              <div>
                <h3>👥 Kelola Pengguna Sistem</h3>
                <p>Hanya 2 role yang didukung: <b>Admin</b> & <b>Super Admin</b></p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setUserModal({ isEdit: false, data: { username: '', name: '', password: '', role: 'admin' } })}
                id="add-user-btn"
              >
                <UserPlus size={16} /> Tambah User
              </button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Terakhir Login</th>
                    <th className="right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === user.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="row">
                            <Avatar name={u.name} size="sm" />
                            <b>{u.name}</b> {isSelf && <span className="badge" style={{ fontSize: 10 }}>Kamu</span>}
                          </div>
                        </td>
                        <td><code>@{u.username}</code></td>
                        <td>
                          <span className={`badge ${u.role === 'superadmin' ? 'lime' : 'violet'}`}>
                            {u.role === 'superadmin' ? '👑 Super Admin' : '🛡️ Admin'}
                          </span>
                        </td>
                        <td className="muted" style={{ fontSize: 13 }}>
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah login'}
                        </td>
                        <td className="right">
                          <button
                            className="icon-btn sm"
                            onClick={() => setUserModal({ isEdit: true, data: u })}
                            title="Edit User"
                          >
                            <Pencil size={15} />
                          </button>{' '}
                          {!isSelf && (
                            <button
                              className="icon-btn sm danger"
                              onClick={() => setDelUserTarget(u)}
                              title="Hapus User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Modal Tambah/Edit User */}
      {userModal && (
        <UserFormModal
          isOpen={!!userModal}
          isEdit={userModal.isEdit}
          initialData={userModal.data}
          busy={busy}
          onClose={() => setUserModal(null)}
          onSave={handleSaveUser}
        />
      )}

      {/* Modal Konfirmasi Hapus User */}
      <Confirm
        open={!!delUserTarget}
        busy={busy}
        onClose={() => setDelUserTarget(null)}
        onConfirm={handleDeleteUser}
        message={delUserTarget && (
          <>
            Yakin ingin menghapus user <b>{delUserTarget.name}</b> (@{delUserTarget.username})? Tindakan ini tidak dapat dibatalkan.
          </>
        )}
      />
    </div>
  );
}

function UserFormModal({ isOpen, isEdit, initialData, busy, onClose, onSave }) {
  const [f, setF] = useState({
    username: initialData?.username || '',
    name: initialData?.name || '',
    password: '',
    role: initialData?.role || 'admin',
  });
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Nama user wajib diisi!');
    if (!isEdit && !f.username.trim()) return setErr('Username wajib diisi!');
    if (!isEdit && (!f.password || f.password.length < 6)) return setErr('Password minimal 6 karakter!');
    if (isEdit && f.password && f.password.length < 6) return setErr('Password baru minimal 6 karakter!');
    setErr('');
    const payload = { ...f };
    if (isEdit && !f.password) delete payload.password;
    onSave(payload);
  };

  return (
    <Modal
      open={isOpen}
      title={isEdit ? `Edit User @${initialData?.username}` : 'Tambah Pengguna Baru'}
      icon={isEdit ? '✏️' : '👤'}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} id="save-user-btn">
            {busy ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah User'}
          </button>
        </>
      )}
    >
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="u-name">Nama Lengkap</label>
          <input
            id="u-name"
            className="input"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="cth: Bendahara 1"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="u-user">Username</label>
          <input
            id="u-user"
            className="input"
            disabled={isEdit}
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().trim() })}
            placeholder="cth: bendahara"
          />
          {isEdit && <span className="hint">Username tidak bisa diubah setelah dibuat.</span>}
        </div>

        <div className="field">
          <label htmlFor="u-pass">{isEdit ? 'Password Baru (kosongkan jika tidak diganti)' : 'Password'}</label>
          <input
            id="u-pass"
            type="password"
            className="input"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder={isEdit ? '••••••••' : 'Minimal 6 karakter'}
          />
        </div>

        <div className="field">
          <label htmlFor="u-role">Role Akses</label>
          <select
            id="u-role"
            className="select"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
          >
            <option value="admin">Admin (Kelola kas & transaksi)</option>
            <option value="superadmin">Super Admin (Akses penuh + kelola user & konfigurasi)</option>
          </select>
        </div>

        {err && <div className="error-box">{err}</div>}
      </form>
    </Modal>
  );
}
