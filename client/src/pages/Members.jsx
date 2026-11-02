import { useMemo, useState } from 'react';
import { Search, Plus, UserPlus, Pencil, Trash2, HandCoins, Phone, Calendar } from 'lucide-react';
import { useAuth, useFetch, useToast } from '../lib/context.jsx';
import { useActions } from '../components/Forms.jsx';
import { api } from '../lib/api.js';
import { Avatar, Loader, ErrorState, Empty, Modal, Confirm } from '../components/ui.jsx';
import { rupiah, monthLabel, todayKey } from '../lib/format.js';

export default function Members() {
  const { isSuper } = useAuth();
  const toast = useToast();
  const { version, openDues, bump } = useActions();
  const { data, error, loading, reload } = useFetch('/members', [version]);
  const [q, setQ] = useState('');
  const [formModal, setFormModal] = useState(null); // null | { isEdit, data }
  const [delTarget, setDelTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const members = data || [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) =>
      m.name.toLowerCase().includes(s) ||
      (m.phone && m.phone.includes(s)) ||
      (m.note && m.note.toLowerCase().includes(s))
    );
  }, [members, q]);

  const activeCount = members.filter((m) => m.active).length;

  const handleSaveMember = async (formData) => {
    setBusy(true);
    try {
      if (formModal?.isEdit) {
        await api.put(`/members/${formModal.data.id}`, formData);
        toast('Data anggota diperbarui ✨');
      } else {
        await api.post('/members', formData);
        toast('Anggota baru ditambahkan 🎉');
      }
      setFormModal(null);
      bump();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!delTarget) return;
    setBusy(true);
    try {
      await api.del(`/members/${delTarget.id}?force=1`);
      toast('Anggota berhasil dihapus 🗑️');
      setDelTarget(null);
      bump();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="page-enter">
      <div className="hello">
        <div>
          <h2>👯 Daftar Anggota Kas</h2>
          <p>{members.length} anggota tercatat ({activeCount} aktif) · atur keanggotaan & bulan mulai iuran</p>
        </div>
        <div className="row hello-actions">
          <button
            className="btn btn-primary"
            onClick={() => setFormModal({
              isEdit: false,
              data: { name: '', joinMonth: todayKey().slice(0, 7), active: true, phone: '', note: '' }
            })}
            id="add-member-btn"
          >
            <UserPlus size={17} /> Tambah Anggota
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-wrap search">
            <Search size={18} />
            <input
              id="member-search"
              className="input"
              placeholder="Cari nama anggota atau nomor HP..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty emoji="🔍" title="Anggota tidak ditemukan">
            Coba gunakan kata kunci pencarian yang lain.
          </Empty>
        ) : (
          <div className="member-grid">
            {filtered.map((m) => (
              <div key={m.id} className={`card member-card hoverable ${!m.active ? 'inactive' : ''}`}>
                <div className="row-between">
                  <div className="row">
                    <Avatar name={m.name} size="lg" />
                    <div>
                      <h4 style={{ fontSize: 17 }}>{m.name}</h4>
                      <span className={`badge ${m.active ? 'in' : 'warn'}`} style={{ marginTop: 4 }}>
                        {m.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className="icon-btn sm"
                      onClick={() => setFormModal({ isEdit: true, data: m })}
                      aria-label="Edit"
                      title="Edit Anggota"
                    >
                      <Pencil size={15} />
                    </button>
                    {isSuper && (
                      <button
                        className="icon-btn sm danger"
                        onClick={() => setDelTarget(m)}
                        aria-label="Hapus"
                        title="Hapus Anggota"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mini-stats" style={{ marginTop: 6 }}>
                  <div className="mini-stat">
                    <small>Total Setor</small>
                    <b className="text-in">{rupiah(m.totalPaid)}</b>
                  </div>
                  <div className="mini-stat">
                    <small>Transaksi</small>
                    <b>{m.txCount || 0} kali</b>
                  </div>
                </div>

                <div className="stack" style={{ gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                  <div className="row" style={{ gap: 6 }}>
                    <Calendar size={14} className="muted" />
                    <span>Mulai iuran: <b>{monthLabel(m.joinMonth)}</b></span>
                  </div>
                  {m.phone && (
                    <div className="row" style={{ gap: 6 }}>
                      <Phone size={14} className="muted" />
                      <span>{m.phone}</span>
                    </div>
                  )}
                  {m.note && (
                    <p className="hint" style={{ marginTop: 2, fontStyle: 'italic' }}>“{m.note}”</p>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm btn-block"
                    onClick={() => openDues({ member: m.id })}
                    id={`member-pay-${m.id}`}
                  >
                    <HandCoins size={14} /> Catat Iuran {m.name.split(' ')[0]}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Anggota */}
      {formModal && (
        <MemberFormModal
          isOpen={!!formModal}
          isEdit={formModal.isEdit}
          initialData={formModal.data}
          busy={busy}
          onClose={() => setFormModal(null)}
          onSave={handleSaveMember}
        />
      )}

      {/* Modal Konfirmasi Hapus */}
      <Confirm
        open={!!delTarget}
        busy={busy}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDeleteMember}
        message={delTarget && (
          <>
            Apakah kamu yakin ingin menghapus anggota <b>{delTarget.name}</b>?
            <br />
            <small style={{ color: 'var(--text-3)', display: 'block', marginTop: 8 }}>
              Catatan: Riwayat transaksi terdahulu akan tetap tersimpan demi keutuhan buku kas.
            </small>
          </>
        )}
      />
    </div>
  );
}

function MemberFormModal({ isOpen, isEdit, initialData, busy, onClose, onSave }) {
  const [f, setF] = useState({
    name: initialData?.name || '',
    joinMonth: initialData?.joinMonth || todayKey().slice(0, 7),
    leaveMonth: initialData?.leaveMonth || '',
    active: initialData?.active ?? true,
    phone: initialData?.phone || '',
    note: initialData?.note || '',
  });
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Nama anggota wajib diisi!');
    if (!f.joinMonth) return setErr('Bulan mulai iuran wajib dipilih!');
    setErr('');
    onSave(f);
  };

  return (
    <Modal
      open={isOpen}
      title={isEdit ? 'Edit Anggota' : 'Tambah Anggota Baru'}
      icon={isEdit ? '✏️' : '👤'}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} id="save-member-btn">
            {busy ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah'}
          </button>
        </>
      )}
    >
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="m-name">Nama Anggota</label>
          <input
            id="m-name"
            className="input"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="cth: Rafidz"
            autoFocus
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-join">Mulai Wajib Iuran</label>
            <input
              id="m-join"
              type="month"
              className="input"
              value={f.joinMonth}
              onChange={(e) => setF({ ...f, joinMonth: e.target.value })}
            />
            <span className="hint">Sebelum bulan ini statusnya strip (-)</span>
          </div>

          <div className="field">
            <label htmlFor="m-leave">Berhenti Iuran <small>opsional</small></label>
            <input
              id="m-leave"
              type="month"
              className="input"
              value={f.leaveMonth}
              onChange={(e) => setF({ ...f, leaveMonth: e.target.value })}
            />
            <span className="hint">Kosongkan jika masih anggota</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-phone">Nomor WhatsApp / HP</label>
            <input
              id="m-phone"
              className="input"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="08123456789"
            />
          </div>

          <div className="field">
            <label>Status Anggota</label>
            <div className="segmented" style={{ width: '100%' }}>
              <button
                type="button"
                className={f.active ? 'on' : ''}
                style={{ flex: 1 }}
                onClick={() => setF({ ...f, active: true })}
              >
                Aktif
              </button>
              <button
                type="button"
                className={!f.active ? 'on' : ''}
                style={{ flex: 1 }}
                onClick={() => setF({ ...f, active: false })}
              >
                Nonaktif
              </button>
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="m-note">Catatan Tambahan</label>
          <input
            id="m-note"
            className="input"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="cth: Anggota batch 2"
          />
        </div>

        {err && <div className="error-box">{err}</div>}
      </form>
    </Modal>
  );
}
