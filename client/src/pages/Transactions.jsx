import { useMemo, useState } from 'react';
import { Search, Plus, Download, Pencil, Trash2, HandCoins } from 'lucide-react';
import { useFetch, useToast } from '../lib/context.jsx';
import { useActions } from '../components/Forms.jsx';
import { api } from '../lib/api.js';
import { Loader, ErrorState, Empty, Confirm, Switch } from '../components/ui.jsx';
import { rupiah, dateLabel, monthLabel, catEmoji, downloadCSV } from '../lib/format.js';

export default function Transactions() {
  const toast = useToast();
  const { version, openTx, openDues, bump } = useActions();
  const [showLegacy, setShowLegacy] = useState(false);
  const { data, error, loading, reload } = useFetch(`/transactions${showLegacy ? '?legacy=1' : ''}`, [version]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [month, setMonth] = useState('');
  const [cat, setCat] = useState('');
  const [method, setMethod] = useState('');
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = data || [];
  const opts = useMemo(() => ({
    months: [...new Set(list.map((t) => t.date.slice(0, 7)))].sort().reverse(),
    cats: [...new Set(list.map((t) => t.category))].sort(),
    methods: [...new Set(list.map((t) => t.method))].sort(),
  }), [list]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((t) =>
      (type === 'ALL' || t.type === type)
      && (!month || t.date.startsWith(month))
      && (!cat || t.category === cat)
      && (!method || t.method === method)
      && (!s || `${t.description} ${t.voucher} ${t.vendor} ${t.member?.name || ''}`.toLowerCase().includes(s)));
  }, [list, q, type, month, cat, method]);

  const tot = useMemo(() => {
    const real = filtered.filter((t) => !t.legacy);
    const inn = real.filter((t) => t.type === 'IN').reduce((a, t) => a + t.amount, 0);
    const out = real.filter((t) => t.type === 'OUT').reduce((a, t) => a + t.amount, 0);
    return { inn, out, net: inn - out, count: filtered.length };
  }, [filtered]);

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/transactions/${del.id}`);
      toast('Transaksi dihapus 🗑️');
      setDel(null);
      bump();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    downloadCSV(`kaskita-transaksi-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['No', 'Tanggal', 'No. Voucher', 'Keterangan', 'Kategori', 'Jenis', 'Jumlah (Rp)', 'Penerima / Vendor', 'Bayar Via', 'Anggota', 'Bulan Iuran'],
      ...filtered.slice().reverse().map((t, i) => [i + 1, t.date, t.voucher, t.description, t.category, t.type, t.amount, t.vendor, t.method, t.member?.name || '', t.duesMonth ? monthLabel(t.duesMonth) : '']),
    ]);
  };

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const resetFilter = () => { setQ(''); setType('ALL'); setMonth(''); setCat(''); setMethod(''); };

  return (
    <div className="page-enter">
      <div className="hello">
        <div><h2>🧾 Buku Kas</h2><p>{list.length} transaksi tercatat · cari, filter, edit, export.</p></div>
        <div className="row hello-actions">
          <button className="btn btn-ghost" onClick={() => openDues()} id="tx-pay-dues"><HandCoins size={17} /> Bayar Kas</button>
          <button className="btn btn-primary" onClick={() => openTx()} id="tx-add"><Plus size={17} /> Transaksi</button>
        </div>
      </div>

      <div className="summary-strip stagger">
        <div className="mini-stat"><small>Pemasukan</small><b className="text-in">{rupiah(tot.inn)}</b></div>
        <div className="mini-stat"><small>Pengeluaran</small><b className="text-out">{rupiah(tot.out)}</b></div>
        <div className="mini-stat"><small>Selisih</small><b>{rupiah(tot.net)}</b></div>
        <div className="mini-stat"><small>Jumlah</small><b>{tot.count} trx</b></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-wrap search">
            <Search size={18} />
            <input id="tx-search" className="input" placeholder="Cari keterangan, voucher, nama…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="segmented">
            {[['ALL', 'Semua'], ['IN', 'Masuk'], ['OUT', 'Keluar']].map(([v, l]) => (
              <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)} id={`tx-filter-${v}`}>{l}</button>
            ))}
          </div>
          <select className="select" value={month} onChange={(e) => setMonth(e.target.value)} id="tx-filter-month" aria-label="Filter bulan">
            <option value="">Semua bulan</option>
            {opts.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} id="tx-filter-cat" aria-label="Filter kategori">
            <option value="">Semua kategori</option>
            {opts.cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)} id="tx-filter-method" aria-label="Filter metode">
            <option value="">Semua metode</option>
            {opts.methods.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv} id="tx-export"><Download size={16} /> CSV</button>
        </div>
        <label className="row hint" style={{ marginBottom: 12, cursor: 'pointer', width: 'fit-content' }}>
          <Switch on={showLegacy} onChange={setShowLegacy} id="tx-legacy" label="Tampilkan iuran pra-saldo awal" />
          Tampilkan iuran yang sudah termasuk saldo awal
        </label>

        {filtered.length === 0 ? (
          <Empty emoji="🔍" title="Nggak ketemu nih">Coba ganti kata kunci atau filternya.<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={resetFilter}>Reset filter</button></Empty>
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table className="table">
                <thead>
                  <tr><th>Tanggal</th><th>Voucher</th><th>Keterangan</th><th>Kategori</th><th>Via</th><th className="right">Jumlah</th><th className="right">Aksi</th></tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dateLabel(t.date)}</td>
                      <td><span className="badge">{t.voucher}</span></td>
                      <td className="desc-cell">
                        <div className="ellipsis">{t.description}</div>
                        {(t.member || t.vendor) && <div className="hint" style={{ textTransform: 'none', fontWeight: 500 }}>{t.member ? `👤 ${t.member.name} · ${monthLabel(t.duesMonth, 'short')}` : t.vendor}{t.legacy && ' · termasuk saldo awal'}</div>}
                      </td>
                      <td><span className={`badge ${t.type === 'IN' ? 'in' : 'out'}`}>{catEmoji(t.category)} {t.category}</span></td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.method}</td>
                      <td className={`right num ${t.type === 'IN' ? 'text-in' : 'text-out'}`} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{t.type === 'IN' ? '+' : '−'}{rupiah(t.amount)}</td>
                      <td className="right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="icon-btn sm" onClick={() => openTx(t)} aria-label="Edit" title="Edit"><Pencil size={15} /></button>{' '}
                        <button className="icon-btn sm danger" onClick={() => setDel(t)} aria-label="Hapus" title="Hapus"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards tx-list">
              {filtered.map((t) => (
                <div key={t.id} className="tx-item">
                  <span className={`tx-icon ${t.type === 'IN' ? 'in' : 'out'}`}>{catEmoji(t.category)}</span>
                  <div className="grow" onClick={() => openTx(t)} role="button" tabIndex={0}>
                    <div className="desc">{t.description}</div>
                    <div className="sub"><span>{dateLabel(t.date, false)}</span>·<span>{t.voucher}</span>·<span>{t.method}</span></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`amt ${t.type === 'IN' ? 'text-in' : 'text-out'}`}>{t.type === 'IN' ? '+' : '−'}{rupiah(t.amount)}</div>
                    <button className="hint" style={{ color: 'var(--red)', fontWeight: 700, marginTop: 2 }} onClick={() => setDel(t)}>hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Confirm
        open={!!del}
        busy={busy}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        message={del && <>Transaksi <b>{del.voucher}</b> “{del.description}” senilai <b>{rupiah(del.amount)}</b> bakal dihapus permanen.</>}
      />
    </div>
  );
}
