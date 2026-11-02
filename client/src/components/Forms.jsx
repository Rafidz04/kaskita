import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { Modal, MoneyInput, Avatar } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { monthLabel, rupiah, todayKey, catEmoji } from '../lib/format.js';

const DUES = 'Iuran Kas';
const ActionsCtx = createContext(null);
export const useActions = () => useContext(ActionsCtx);

/** Host semua form (transaksi & bayar kas) + versi data supaya halaman bisa auto-refresh */
export function ActionsProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [tx, setTx] = useState(null); // { initial } | null
  const [dues, setDues] = useState(null); // { member, month } | null
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(() => ({
    version,
    bump,
    openTx: (initial = null) => setTx({ initial }),
    openDues: (preset = {}) => setDues(preset),
  }), [version, bump]);

  return (
    <ActionsCtx.Provider value={value}>
      {children}
      {tx && <TxForm initial={tx.initial} onClose={() => setTx(null)} onSaved={() => { setTx(null); bump(); }} />}
      {dues && <DuesForm preset={dues} onClose={() => setDues(null)} onSaved={() => { setDues(null); bump(); }} />}
    </ActionsCtx.Provider>
  );
}

/* ================= Transaksi umum ================= */
function TxForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const [settings, setSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState(() => ({
    type: initial?.type || 'OUT',
    date: initial?.date || todayKey(),
    voucher: initial?.voucher || '',
    description: initial?.description || '',
    amount: initial?.amount ?? 0,
    category: initial?.category || '',
    vendor: initial?.vendor || '',
    method: initial?.method || 'Tunai',
    member: initial?.member?.id || '',
    duesMonth: initial?.duesMonth || '',
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    Promise.all([api.get('/settings'), api.get('/members'), editing ? null : api.get('/transactions/next-voucher')])
      .then(([s, m, v]) => {
        setSettings(s);
        setMembers(m);
        setF((cur) => ({
          ...cur,
          voucher: cur.voucher || v?.voucher || '',
          category: cur.category || (cur.type === 'IN' ? 'Sumbangan' : 'Jajan'),
          amount: cur.amount || (cur.category === DUES ? s.duesAmount : 0),
        }));
      })
      .catch((e) => setErr(e.message));
  }, [editing]);

  const isDues = f.type === 'IN' && f.category === DUES;
  const months = useMemo(() => {
    if (!settings) return [];
    const out = [];
    let [y, m] = settings.periodStart.split('-').map(Number);
    const end = settings.periodEnd;
    for (let i = 0; i < 60; i++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      if (k > end) break;
      out.push(k);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }, [settings]);

  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    if (!f.description.trim()) return setErr('Keterangan wajib diisi ya');
    if (!(f.amount > 0)) return setErr('Nominal harus lebih dari 0');
    if (isDues && (!f.member || !f.duesMonth)) return setErr('Iuran kas wajib pilih anggota & bulan');
    setBusy(true);
    try {
      const body = { ...f, member: isDues ? f.member : null, duesMonth: isDues ? f.duesMonth : null };
      if (editing) await api.put(`/transactions/${initial.id}`, body);
      else await api.post('/transactions', body);
      toast(editing ? 'Transaksi di-update ✨' : 'Transaksi tercatat ✨');
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const cats = settings?.categories || [];
  const quick = f.type === 'IN' ? [20000, 50000, 100000] : [10000, 25000, 50000, 100000];

  return (
    <Modal
      open
      wide
      title={editing ? 'Edit Transaksi' : 'Catat Transaksi'}
      icon={f.type === 'IN' ? '🤑' : '💸'}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} id="tx-cancel">Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !settings} id="tx-save">
            {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {editing ? 'Simpan' : 'Catat'}
          </button>
        </>
      )}
    >
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        <div className="segmented big">
          <button type="button" id="tx-type-in" className={f.type === 'IN' ? 'on in' : ''} onClick={() => { set('type', 'IN'); if (f.category === 'Jajan') set('category', 'Sumbangan'); }}>
            <ArrowDownLeft size={17} /> Pemasukan
          </button>
          <button type="button" id="tx-type-out" className={f.type === 'OUT' ? 'on out' : ''} onClick={() => { set('type', 'OUT'); if (f.category === DUES || f.category === 'Sumbangan') set('category', 'Jajan'); }}>
            <ArrowUpRight size={17} /> Pengeluaran
          </button>
        </div>

        <div className="field">
          <label htmlFor="tx-amount">Nominal</label>
          <MoneyInput id="tx-amount" value={f.amount} onChange={(v) => set('amount', v)} />
          <div className="quick-amounts">
            {quick.map((q) => (
              <button type="button" key={q} className={f.amount === q ? 'on' : ''} onClick={() => set('amount', q)}>{rupiah(q)}</button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="tx-desc">Keterangan</label>
            <input id="tx-desc" className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={f.type === 'OUT' ? 'cth: Martabak Blok M 🍳' : 'cth: Sumbangan alumni'} />
          </div>
          <div className="field">
            <label htmlFor="tx-category">Kategori</label>
            <select id="tx-category" className="select" value={f.category} onChange={(e) => {
              const c = e.target.value;
              set('category', c);
              if (c === DUES && settings && !f.amount) set('amount', settings.duesAmount);
            }}>
              {cats.filter((c) => f.type === 'IN' || c !== DUES).map((c) => <option key={c} value={c}>{catEmoji(c)} {c}</option>)}
              {f.category && !cats.includes(f.category) && <option value={f.category}>{f.category}</option>}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tx-method">Bayar via</label>
            <select id="tx-method" className="select" value={f.method} onChange={(e) => set('method', e.target.value)}>
              {(settings?.methods || ['Tunai']).map((m) => <option key={m} value={m}>{m}</option>)}
              {f.method && settings && !settings.methods.includes(f.method) && <option value={f.method}>{f.method}</option>}
            </select>
          </div>
          {isDues && (
            <>
              <div className="field">
                <label htmlFor="tx-member">Anggota</label>
                <select id="tx-member" className="select" value={f.member} onChange={(e) => set('member', e.target.value)}>
                  <option value="">— pilih anggota —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tx-dues-month">Untuk bulan</label>
                <select id="tx-dues-month" className="select" value={f.duesMonth} onChange={(e) => set('duesMonth', e.target.value)}>
                  <option value="">— pilih bulan —</option>
                  {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="tx-date">Tanggal</label>
            <input id="tx-date" type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tx-voucher">No. Voucher <small>otomatis</small></label>
            <input id="tx-voucher" className="input" value={f.voucher} onChange={(e) => set('voucher', e.target.value)} placeholder="PCV-145" />
          </div>
          <div className="field full">
            <label htmlFor="tx-vendor">Penerima / Vendor <small>opsional</small></label>
            <input id="tx-vendor" className="input" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="cth: Warung Bu Ani" />
          </div>
        </div>
        {err && <div className="error-box">{err}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ================= Bayar Kas (iuran) ================= */
function DuesForm({ preset, onClose, onSaved }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [member, setMember] = useState(preset.member || '');
  const [months, setMonths] = useState(preset.month ? [preset.month] : []);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayKey());
  const [method, setMethod] = useState('Tunai');
  const [note, setNote] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((d) => {
      setData(d);
      setAmount(d.settings.duesAmount); // default 20.000 (bisa diubah)
    }).catch((e) => setErr(e.message));
  }, []);

  const row = data?.dues.find((d) => d.id === member);
  const cellOf = (m) => row?.cells.find((c) => c.month === m);

  useEffect(() => {
    // kalau ganti anggota tanpa preset bulan → otomatis pilih bulan tunggakan tertua
    if (!row || preset.month) return;
    const firstUnpaid = row.cells.find((c) => c.status === 'unpaid' || c.status === 'partial') || row.cells.find((c) => c.status === 'upcoming');
    setMonths(firstUnpaid ? [firstUnpaid.month] : []);
  }, [member]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // kalau bulan yg dipilih statusnya cicilan → default nominal = sisa kekurangan
    if (!data || months.length !== 1) return;
    const c = cellOf(months[0]);
    if (c?.status === 'partial') setAmount(Math.max(data.settings.duesAmount - c.paid, 0));
  }, [months, member, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (m) => setMonths((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m].sort()));

  const submit = async () => {
    setErr('');
    if (!member) return setErr('Pilih anggota dulu ya');
    if (!months.length) return setErr('Pilih minimal 1 bulan');
    if (!(amount > 0)) return setErr('Nominal harus lebih dari 0');
    setBusy(true);
    try {
      const r = await api.post('/transactions/dues', { member, months, amount, date, method, note });
      toast(`${row?.name} lunas ${r.count} bulan · ${rupiah(r.total)} 💰`);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const statusText = { paid: 'Lunas ✓', partial: 'Cicil', unpaid: 'Nunggak', upcoming: 'Belum', na: '—' };
  const dues = data?.settings.duesAmount || 20000;

  return (
    <Modal
      open
      wide
      title="Bayar Kas"
      icon="💰"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose} id="dues-cancel">Batal</button>
          <button className="btn btn-gradient" onClick={submit} disabled={busy || !data} id="dues-save">
            {busy ? <Loader2 size={16} className="spin" /> : '💸'} Simpan Pembayaran
          </button>
        </>
      )}
    >
      {!data ? (
        <div className="loader" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          <div className="field">
            <label htmlFor="dues-member">Siapa yang bayar?</label>
            <select id="dues-member" className="select" value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">— pilih anggota —</option>
              {data.dues.filter((d) => d.active || d.id === member).map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.arrears.length ? ` · nunggak ${d.arrears.length} bln` : ''}</option>
              ))}
            </select>
          </div>

          {row && (
            <div className="row" style={{ padding: 12, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Avatar name={row.name} />
              <div className="grow">
                <b>{row.name}</b>
                <div className="hint">Total setor {rupiah(row.totalPaid)} · kepatuhan {row.compliance}%</div>
              </div>
              {row.arrearsAmount > 0 ? <span className="badge out">Kurang {rupiah(row.arrearsAmount)}</span> : <span className="badge in">Aman 😎</span>}
            </div>
          )}

          <div className="field">
            <label>Bulan yang dibayar <small>bisa pilih banyak</small></label>
            <div className="month-picker">
              {data.months.map((m) => {
                const c = cellOf(m);
                const st = c?.status || 'upcoming';
                const disabled = !member || st === 'paid';
                return (
                  <button
                    type="button"
                    key={m}
                    id={`dues-month-${m}`}
                    disabled={disabled}
                    className={`month-chip ${months.includes(m) ? 'on' : ''} ${st}`}
                    onClick={() => toggle(m)}
                  >
                    {monthLabel(m, 'short')}
                    <small>{st === 'partial' ? `${statusText[st]} ${rupiah(c.paid)}` : statusText[st]}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="dues-amount">Nominal per bulan <small>default {rupiah(dues)}</small></label>
              <MoneyInput id="dues-amount" value={amount} onChange={setAmount} />
              <div className="quick-amounts">
                {[dues / 2, dues, dues * 1.5].map((q) => (
                  <button type="button" key={q} className={amount === q ? 'on' : ''} onClick={() => setAmount(q)}>{rupiah(q)}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="dues-method">Bayar via</label>
              <select id="dues-method" className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                {data.settings.methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dues-date">Tanggal bayar</label>
              <input id="dues-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dues-note">Catatan <small>opsional</small></label>
              <input id="dues-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth: titip ke Rafi" />
            </div>
          </div>

          <div className="total-preview">
            <div>
              <div className="hint">{months.length} bulan × {rupiah(amount)}</div>
              <div style={{ fontWeight: 700 }}>{months.map((m) => monthLabel(m, 'abbr')).join(' · ') || 'Belum pilih bulan'}</div>
            </div>
            <b>{rupiah(amount * months.length)}</b>
          </div>
          {err && <div className="error-box">{err}</div>}
        </div>
      )}
    </Modal>
  );
}
