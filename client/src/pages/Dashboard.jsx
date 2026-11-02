import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Wallet, AlertTriangle, Plus, HandCoins, RefreshCw, ChevronRight, Trophy } from 'lucide-react';
import { useAuth, useFetch } from '../lib/context.jsx';
import { useActions } from '../components/Forms.jsx';
import { Avatar, Loader, ErrorState, Empty } from '../components/ui.jsx';
import { CashflowChart, Sparkline, Donut, Ring, DuesMatrix, MatrixLegend, CountUp } from '../components/Charts.jsx';
import { rupiah, compact, monthLabel, dateLabel, greeting, catEmoji, CHART_COLORS } from '../lib/format.js';

export default function Dashboard() {
  const { user, guest } = useAuth();
  const { version, openTx, openDues } = useActions();
  const { data, error, loading, reload } = useFetch('/dashboard', [version]);
  const [donutMode, setDonutMode] = useState('OUT');

  useEffect(() => {
    const t = setInterval(reload, 60000); // auto refresh tiap 1 menit
    return () => clearInterval(t);
  }, [reload]);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const { summary: s, thisMonth: tm, settings } = data;
  const pct = tm.eligible ? Math.round((tm.paid / tm.eligible) * 100) : 0;
  const donutData = donutMode === 'OUT' ? data.outByCategory : data.inByCategory;
  const donutTotal = donutData.reduce((a, b) => a + b.amount, 0);
  const maxMethod = Math.max(1, ...data.byMethod.map((m) => m.amount));
  const maxLeader = Math.max(1, ...data.leaderboard.map((m) => m.totalPaid));
  const outDiff = s.outThisMonth - s.outPrevMonth;

  return (
    <div className="page-enter">
      {guest && (
        <div className="guest-banner">
          <span style={{ fontSize: 22 }}>👀</span>
          <span className="grow">Kamu lagi di <b>mode tamu</b> — cuma bisa lihat-lihat. Data update otomatis.</span>
          <Link to="/login" className="btn btn-ghost btn-sm" onClick={() => localStorage.removeItem('kaskita_guest')}>Login admin</Link>
        </div>
      )}

      <div className="hello">
        <div>
          <h2>{user ? <>{greeting()}, {user.name.split(' ')[0]} <span className="wave">👋</span></> : <>Halo, bestie <span className="wave">👋</span></>}</h2>
          <p>{settings.orgName} · {settings.tagline} · iuran <b>{rupiah(settings.duesAmount)}</b>/bulan</p>
        </div>
        <div className="row hello-actions">
          <button className="icon-btn hide-mobile" onClick={reload} aria-label="Refresh" id="dash-refresh" title="Refresh data"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
          {user && (
            <>
              <button className="btn btn-ghost" onClick={() => openTx()} id="dash-add-tx"><Plus size={17} /> Transaksi</button>
              <button className="btn btn-primary" onClick={() => openDues()} id="dash-pay-dues"><HandCoins size={17} /> Bayar Kas</button>
            </>
          )}
        </div>
      </div>

      <div className="bento stagger">
        {/* ===== HERO ===== */}
        <section className="hero-card" aria-label="Sisa kas">
          <Sparkline data={data.cashflow} />
          <span className="hero-label"><span className="dot" /> Sisa Kas Kecil · live</span>
          <div className="hero-amount"><small>Rp</small><CountUp value={s.balance} format={(n) => n.toLocaleString('id-ID')} /></div>
          <p className="hero-sub">Per {dateLabel(data.today)} · dari {s.txCount} transaksi sejak {dateLabel(settings.openingDate)}</p>
          <div className="hero-chips">
            <div className="hero-chip"><small><Wallet size={14} /> Saldo awal</small><b>{rupiah(s.openingBalance)}</b></div>
            <div className="hero-chip"><small><ArrowDownLeft size={14} /> Masuk</small><b>+{rupiah(s.totalIn)}</b></div>
            <div className="hero-chip"><small><ArrowUpRight size={14} /> Keluar</small><b>−{rupiah(s.totalOut)}</b></div>
          </div>
        </section>

        {/* ===== PROGRESS BULAN INI ===== */}
        <section className="card progress-card">
          <div className="card-head" style={{ marginBottom: 6 }}>
            <div><h3>🎯 Setoran {monthLabel(tm.month, 'name')}</h3><p>Target {rupiah(tm.target)}</p></div>
            <span className="badge lime">{pct}%</span>
          </div>
          <Ring value={tm.paid} max={tm.eligible}>
            <div><b>{tm.paid}<span className="muted" style={{ fontSize: '0.5em' }}>/{tm.eligible}</span></b><small>orang lunas</small></div>
          </Ring>
          <div className="mini-stats">
            <div className="mini-stat"><small>Terkumpul</small><b className="text-in">{rupiah(tm.collected)}</b></div>
            <div className="mini-stat"><small>Kurang</small><b className="text-out">{rupiah(Math.max(tm.target - tm.collected, 0))}</b></div>
          </div>
        </section>

        {/* ===== STATS ===== */}
        <StatCard className="half" icon={<ArrowDownLeft />} grad="var(--grad-lime)" glow="#c6ff3d" label="Total Pemasukan" value={s.totalIn}
          foot={<><span className="badge in">{s.inCount} trx</span> iuran {compact(s.totalDuesCollected)}</>} />
        <StatCard className="half" icon={<ArrowUpRight />} grad="var(--grad-pink)" glow="#ff4fd8" label="Total Pengeluaran" value={s.totalOut}
          foot={<><span className="badge out">{s.outCount} trx</span> rata² {compact(s.avgOut)}</>} />
        <StatCard className="half" icon={<span>🧾</span>} grad="var(--grad-violet)" glow="#8b5cf6" label={`Keluar ${monthLabel(data.nowMonth, 'name')}`} value={s.outThisMonth}
          foot={<>{outDiff <= 0 ? '🟢 lebih hemat' : '🔴 lebih boros'} {compact(Math.abs(outDiff))} vs bulan lalu</>} />
        <StatCard className="half" icon={<AlertTriangle />} grad="linear-gradient(135deg,#ff4d6d,#ff8a3d)" glow="#ff4d6d" label="Total Tunggakan" value={s.totalArrears}
          foot={<><span className="badge warn">{s.unpaidCount} orang</span> dari {s.memberCount} anggota</>} />

        {/* ===== BELUM BAYAR ===== */}
        <section className="card span-5">
          <div className="card-head">
            <div><h3>👀 Belum Setor</h3><p>Tunggakan s/d {monthLabel(data.nowMonth)}</p></div>
            {data.unpaid.length > 0 && <span className="badge out">{rupiah(s.totalArrears)}</span>}
          </div>
          {data.unpaid.length === 0 ? (
            <div className="all-clear"><span className="big-emoji">🎉</span><b>Semua lunas, mantap jiwa!</b><p className="muted">Nggak ada yang nunggak bulan ini.</p></div>
          ) : (
            <div className="unpaid-list">
              {data.unpaid.map((u) => (
                <div key={u.id} className="unpaid-item">
                  <Avatar name={u.name} />
                  <div className="grow">
                    <b>{u.name}</b>
                    <div className="months">
                      {u.arrears.map((a) => (
                        <span key={a.month} className={`badge ${a.paid ? 'warn' : 'out'}`} title={a.paid ? `Baru bayar ${rupiah(a.paid)}` : 'Belum bayar'}>
                          {monthLabel(a.month, 'short')}{a.paid ? ' · cicil' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="owed">
                    <b>{rupiah(u.arrearsAmount)}</b>
                    <small>{u.arrears.length} bulan</small>
                    {user && <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={() => openDues({ member: u.id })} id={`pay-${u.id}`}>Bayar</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== CASHFLOW ===== */}
        <section className="card span-7">
          <div className="card-head">
            <div><h3>📈 Arus Kas Bulanan</h3><p>Pemasukan vs pengeluaran + saldo berjalan</p></div>
            <div className="legend">
              <span><i style={{ background: 'linear-gradient(#2ee59d,#3df2ff)' }} /> Masuk</span>
              <span><i style={{ background: 'linear-gradient(#ff4fd8,#ff8a3d)' }} /> Keluar</span>
              <span><i style={{ background: '#a78bfa', borderRadius: 99 }} /> Saldo</span>
            </div>
          </div>
          <CashflowChart data={data.cashflow} />
        </section>

        {/* ===== MATRIX ===== */}
        <section className="card span-12">
          <div className="card-head">
            <div><h3>🗓️ Matriks Iuran {monthLabel(data.months[0], 'short')} – {monthLabel(data.months[data.months.length - 1], 'short')}</h3><p>Iuran {rupiah(settings.duesAmount)}/bulan · geser ke samping kalau di HP 👉</p></div>
            {user && <Link to="/iuran" className="btn btn-ghost btn-sm">Kelola <ChevronRight size={16} /></Link>}
          </div>
          <DuesMatrix dues={data.dues.filter((d) => d.active)} months={data.months} nowMonth={data.nowMonth} onCell={user ? (d, c) => openDues({ member: d.id, month: c.month }) : undefined} />
          <div style={{ marginTop: 14 }}><MatrixLegend /></div>
        </section>

        {/* ===== REKAP PER BULAN ===== */}
        <section className="card span-7">
          <div className="card-head"><div><h3>📊 Kepatuhan per Bulan</h3><p>Jumlah anggota lunas tiap bulan</p></div></div>
          <div className="month-bars">
            {data.duesByMonth.map((m) => {
              const p = m.eligible ? (m.paid / m.eligible) * 100 : 0;
              return (
                <div key={m.month} className={`month-bar ${m.month === data.nowMonth ? 'now' : ''}`}>
                  <small>{monthLabel(m.month, 'short')}</small>
                  <div className="vbar"><i style={{ height: `${p}%` }} /></div>
                  <b>{m.paid}/{m.eligible}</b>
                  <small>{compact(m.collected)}</small>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== DONUT ===== */}
        <section className="card span-5">
          <div className="card-head">
            <div><h3>🍩 Komposisi</h3><p>Per kategori</p></div>
            <div className="segmented">
              <button className={donutMode === 'OUT' ? 'on' : ''} onClick={() => setDonutMode('OUT')} id="donut-out">Keluar</button>
              <button className={donutMode === 'IN' ? 'on' : ''} onClick={() => setDonutMode('IN')} id="donut-in">Masuk</button>
            </div>
          </div>
          {donutData.length ? (
            <div className="row wrap" style={{ gap: 18 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}><Donut data={donutData} total={donutTotal} label={donutMode === 'OUT' ? 'Keluar' : 'Masuk'} /></div>
              <div className="donut-legend" style={{ flex: '1 1 160px' }}>
                {donutData.map((d, i) => (
                  <div key={d.name} className="row-between">
                    <span className="row" style={{ gap: 8 }}><span className="dot-c" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{catEmoji(d.name)} {d.name}</span>
                    <span className="num">{compact(d.amount)} <span className="muted" style={{ fontSize: 12 }}>· {Math.round((d.amount / donutTotal) * 100)}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty emoji="🍩" title="Belum ada data" />}
        </section>

        {/* ===== LEADERBOARD ===== */}
        <section className="card span-4">
          <div className="card-head"><div><h3><Trophy size={18} color="#ffd23f" /> Top Setor</h3><p>Paling rajin bayar kas</p></div></div>
          {data.leaderboard.slice(0, 6).map((m, i) => (
            <div key={m.id} className="rank-item">
              <span className="rank-no">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
              <Avatar name={m.name} size="sm" />
              <div className="grow">
                <div className="row-between"><b className="ellipsis">{m.name}</b><span className="num" style={{ fontSize: 13.5 }}>{compact(m.totalPaid)}</span></div>
                <div className="bar-track"><div className="bar-fill lime" style={{ width: `${(m.totalPaid / maxLeader) * 100}%` }} /></div>
              </div>
            </div>
          ))}
        </section>

        {/* ===== JAJAN TERBESAR ===== */}
        <section className="card span-4">
          <div className="card-head"><div><h3>🍢 Pengeluaran Terbesar</h3><p>Top 5 sepanjang periode</p></div></div>
          <div className="tx-list">
            {data.biggestOut.map((t, i) => (
              <div key={t.id} className="tx-item">
                <span className="rank-no">{i + 1}</span>
                <div className="grow"><div className="desc">{t.description}</div><div className="sub">{dateLabel(t.date)} · {t.method}</div></div>
                <span className="amt text-out">{compact(t.amount)}</span>
              </div>
            ))}
            {!data.biggestOut.length && <Empty emoji="🧘" title="Belum ada pengeluaran" />}
          </div>
        </section>

        {/* ===== METODE ===== */}
        <section className="card span-4">
          <div className="card-head"><div><h3>💳 Metode Bayar</h3><p>Total nilai transaksi per metode</p></div></div>
          <div className="stack" style={{ gap: 16 }}>
            {data.byMethod.map((m, i) => (
              <div key={m.name}>
                <div className="row-between" style={{ fontSize: 14, fontWeight: 600 }}>
                  <span>{m.name} <span className="muted" style={{ fontSize: 12 }}>· {m.count}x</span></span>
                  <span className="num">{compact(m.amount)}</span>
                </div>
                <div className="bar-track"><div className={`bar-fill ${['', 'pink', 'lime'][i % 3]}`} style={{ width: `${(m.amount / maxMethod) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== RECENT ===== */}
        <section className="card span-12">
          <div className="card-head">
            <div><h3>⚡ Transaksi Terbaru</h3><p>8 aktivitas terakhir</p></div>
            {user && <Link to="/transaksi" className="btn btn-ghost btn-sm">Lihat semua <ChevronRight size={16} /></Link>}
          </div>
          <div className="tx-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', columnGap: 28 }}>
            {data.recent.map((t) => (
              <div key={t.id} className="tx-item">
                <span className={`tx-icon ${t.type === 'IN' ? 'in' : 'out'}`}>{catEmoji(t.category)}</span>
                <div className="grow">
                  <div className="desc">{t.description}</div>
                  <div className="sub"><span>{dateLabel(t.date)}</span>·<span>{t.voucher}</span>·<span>{t.method}</span></div>
                </div>
                <span className={`amt ${t.type === 'IN' ? 'text-in' : 'text-out'}`}>{t.type === 'IN' ? '+' : '−'}{compact(t.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, grad, glow, label, value, foot, className = '' }) {
  return (
    <section className={`card stat-card hoverable ${className}`}>
      <span className="glow" style={{ background: glow }} />
      <span className="stat-icon" style={{ background: grad }}>{icon}</span>
      <div>
        <div className="label">{label}</div>
        <div className="value"><CountUp value={value} /></div>
      </div>
      <div className="foot">{foot}</div>
    </section>
  );
}
