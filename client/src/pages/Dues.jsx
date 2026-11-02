import { useMemo, useState } from 'react';
import { Search, Download, HandCoins, MessageCircle, Check, Copy } from 'lucide-react';
import { useFetch, useToast } from '../lib/context.jsx';
import { useActions } from '../components/Forms.jsx';
import { Avatar, Loader, ErrorState, Empty, Modal } from '../components/ui.jsx';
import { DuesMatrix, MatrixLegend } from '../components/Charts.jsx';
import { rupiah, compact, monthLabel, downloadCSV } from '../lib/format.js';

export default function Dues() {
  const toast = useToast();
  const { version, openDues } = useActions();
  const { data, error, loading, reload } = useFetch('/dashboard', [version]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL | UNPAID | CLEAR
  const [waModal, setWaModal] = useState(null); // member data
  const [copied, setCopied] = useState(false);

  const duesList = data?.dues || [];
  const months = data?.months || [];
  const settings = data?.settings || {};
  const nowMonth = data?.nowMonth || '';

  const filteredDues = useMemo(() => {
    const s = q.trim().toLowerCase();
    return duesList.filter((d) => {
      const matchName = d.name.toLowerCase().includes(s);
      const isUnpaid = d.arrears.length > 0;
      if (!matchName) return false;
      if (filter === 'UNPAID') return isUnpaid;
      if (filter === 'CLEAR') return !isUnpaid && d.active;
      return true;
    });
  }, [duesList, q, filter]);

  const summary = useMemo(() => {
    const totalArrears = duesList.reduce((acc, d) => acc + d.arrearsAmount, 0);
    const unpaidMembers = duesList.filter((d) => d.arrears.length > 0).length;
    const totalCollected = duesList.reduce((acc, d) => acc + d.totalPaid, 0);
    return { totalArrears, unpaidMembers, totalCollected, count: duesList.length };
  }, [duesList]);

  const exportCsv = () => {
    if (!data) return;
    const header = ['Nama Anggota', 'Status', ...months.map((m) => monthLabel(m, 'short')), 'Total Disetor', 'Tunggakan'];
    const rows = filteredDues.map((d) => [
      d.name,
      d.active ? 'Aktif' : 'Nonaktif',
      ...d.cells.map((c) => {
        if (c.status === 'paid') return 'Lunas';
        if (c.status === 'partial') return `Cicil (${c.paid})`;
        if (c.status === 'unpaid') return 'Belum';
        if (c.status === 'upcoming') return 'Belum jatuh tempo';
        return '-';
      }),
      d.totalPaid,
      d.arrearsAmount,
    ]);
    downloadCSV(`kaskita-matriks-iuran-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const openReminder = (member) => {
    setCopied(false);
    setWaModal(member);
  };

  const getWaText = (member) => {
    if (!member) return '';
    const arrearsMonths = member.arrears.map((a) => monthLabel(a.month)).join(', ');
    return `Halo ${member.name}! 👋\n\nSekadar info ramah dari pengurus ${settings.orgName || 'KasKita'}, ada iuran kas yang belum disetor:\n📅 Bulan: ${arrearsMonths}\n💸 Total: ${rupiah(member.arrearsAmount)}\n(Iuran rutin: ${rupiah(settings.duesAmount || 20000)}/bulan)\n\nBisa langsung transfer atau serahkan ke bendahara ya. Makasih banyak bestie! 🙏✨`;
  };

  const copyWaText = () => {
    if (!waModal) return;
    navigator.clipboard.writeText(getWaText(waModal));
    setCopied(true);
    toast('Teks pengingat WA disalin ke clipboard 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="page-enter">
      <div className="hello">
        <div>
          <h2>💰 Matriks & Status Iuran</h2>
          <p>Iuran standar <b>{rupiah(settings.duesAmount || 20000)}</b>/bulan · Periode {monthLabel(months[0], 'short')} s/d {monthLabel(months[months.length - 1], 'short')}</p>
        </div>
        <div className="row hello-actions">
          <button className="btn btn-primary" onClick={() => openDues()} id="dues-page-pay">
            <HandCoins size={17} /> Bayar Kas
          </button>
        </div>
      </div>

      <div className="summary-strip stagger">
        <div className="mini-stat">
          <small>Total Iuran Terkumpul</small>
          <b className="text-in">{rupiah(summary.totalCollected)}</b>
        </div>
        <div className="mini-stat">
          <small>Total Tunggakan</small>
          <b className="text-out">{rupiah(summary.totalArrears)}</b>
        </div>
        <div className="mini-stat">
          <small>Belum Setor</small>
          <b>{summary.unpaidMembers} orang</b>
        </div>
        <div className="mini-stat">
          <small>Total Anggota</small>
          <b>{summary.count} orang</b>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-wrap search">
            <Search size={18} />
            <input
              id="dues-search"
              className="input"
              placeholder="Cari nama anggota..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="segmented">
            <button className={filter === 'ALL' ? 'on' : ''} onClick={() => setFilter('ALL')} id="dues-tab-all">Semua</button>
            <button className={filter === 'UNPAID' ? 'on' : ''} onClick={() => setFilter('UNPAID')} id="dues-tab-unpaid">Ada Tunggakan 👀</button>
            <button className={filter === 'CLEAR' ? 'on' : ''} onClick={() => setFilter('CLEAR')} id="dues-tab-clear">Lunas 😎</button>
          </div>
          <button className="btn btn-ghost" onClick={exportCsv} id="dues-export">
            <Download size={16} /> CSV
          </button>
        </div>

        {filteredDues.length === 0 ? (
          <Empty emoji="🎉" title="Nggak ada data yang sesuai">
            Semua anggota lunas atau kata kunci pencarian tidak cocok.
          </Empty>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <MatrixLegend />
            </div>
            <DuesMatrix
              dues={filteredDues}
              months={months}
              nowMonth={nowMonth}
              onCell={(member, cell) => openDues({ member: member.id, month: cell.month })}
            />
          </>
        )}
      </div>

      {/* List Kartu Reminder untuk yang nunggak */}
      {filter !== 'CLEAR' && data.unpaid.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-head">
            <div>
              <h3>📢 Pengingat Iuran Cepat (WhatsApp)</h3>
              <p>Klik nama untuk salin format chat tagihan santai ke anggota</p>
            </div>
            <span className="badge out">{data.unpaid.length} orang nunggak</span>
          </div>

          <div className="unpaid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {data.unpaid.map((u) => {
              const fullMember = duesList.find((d) => d.id === u.id);
              return (
                <div key={u.id} className="unpaid-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="row-between">
                    <div className="row">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <b>{u.name}</b>
                        <div className="hint">{u.arrears.length} bulan tertunda</div>
                      </div>
                    </div>
                    <span className="badge out">{rupiah(u.arrearsAmount)}</span>
                  </div>
                  <div className="chip-row" style={{ marginTop: 8 }}>
                    {u.arrears.map((a) => (
                      <span key={a.month} className="badge out" style={{ fontSize: 11 }}>
                        {monthLabel(a.month, 'short')}
                      </span>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn btn-ghost btn-sm grow" onClick={() => openReminder(fullMember || u)}>
                      <MessageCircle size={14} /> Tagih WA
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => openDues({ member: u.id })}>
                      Bayar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Format WA */}
      <Modal
        open={!!waModal}
        title={`Template WA: ${waModal?.name}`}
        icon="💬"
        onClose={() => setWaModal(null)}
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => setWaModal(null)}>Tutup</button>
            <button className="btn btn-primary" onClick={copyWaText} id="copy-wa-btn">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Tersalin!' : 'Salin Pesan'}
            </button>
          </>
        )}
      >
        <div className="stack" style={{ gap: 12 }}>
          <p className="hint">Pesan ini ramah & santai ala Gen Z, cocok buat dikirim ke grup atau japri:</p>
          <div style={{
            background: 'var(--surface-solid)',
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--border-strong)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.6
          }}>
            {getWaText(waModal)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
