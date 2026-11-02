import { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { compact, rupiah, monthLabel, CHART_COLORS } from '../lib/format.js';
import { Avatar } from './ui.jsx';

/* ---------- Count-up number ---------- */
export function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - (1 - p) ** 4;
      setVal(Math.round(a + (target - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export const CountUp = ({ value, format = rupiah }) => <>{format(useCountUp(value))}</>;

/* ---------- Tooltip ---------- */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{monthLabel(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="row" style={{ gap: 8 }}>
          <span className="dot-c" style={{ background: p.color }} />
          <span className="muted">{p.name}</span>
          <b style={{ marginLeft: 'auto' }}>{rupiah(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

const axisStyle = { fontSize: 12, fill: 'var(--text-3)', fontWeight: 600 };

export function CashflowChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -8, bottom: 0 }} barGap={4}>
          <defs>
            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ee59d" /><stop offset="100%" stopColor="#3df2ff" stopOpacity={0.7} /></linearGradient>
            <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff4fd8" /><stop offset="100%" stopColor="#ff8a3d" stopOpacity={0.7} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, 'short')} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis yAxisId="l" tickFormatter={(v) => compact(v).replace('Rp ', '')} tick={axisStyle} axisLine={false} tickLine={false} width={48} />
          <YAxis yAxisId="r" orientation="right" hide />
          <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-hover)', radius: 12 }} />
          <Bar yAxisId="l" dataKey="in" name="Pemasukan" fill="url(#gIn)" radius={[10, 10, 4, 4]} maxBarSize={34} />
          <Bar yAxisId="l" dataKey="out" name="Pengeluaran" fill="url(#gOut)" radius={[10, 10, 4, 4]} maxBarSize={34} />
          <Line yAxisId="r" type="monotone" dataKey="balance" name="Saldo" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }} activeDot={{ r: 7 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data }) {
  return (
    <div className="hero-spark">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.7} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
          </defs>
          <Area type="monotone" dataKey="balance" stroke="#fff" strokeWidth={2.5} fill="url(#gSpark)" isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, total, label }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: 210 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={data.length > 1 ? 4 : 0} cornerRadius={10} stroke="none">
            {data.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [rupiah(v), n]} contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', borderRadius: 14 }} itemStyle={{ color: 'var(--text)' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="ring-center" style={{ pointerEvents: 'none' }}>
        <div><small>{label}</small><b style={{ fontSize: 22 }}>{compact(total)}</b></div>
      </div>
    </div>
  );
}

/* ---------- Progress ring ---------- */
export function Ring({ value, max, children }) {
  const pct = max ? Math.min(value / max, 1) : 0;
  const r = 70;
  const c = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(pct), 80); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 180 180">
        <defs>
          <linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c6ff3d" /><stop offset="100%" stopColor="#3df2ff" /></linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="url(#gRing)" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - anim)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/* ---------- Dues matrix heatmap ---------- */
const short = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}rb`.replace('.', ',') : String(n));

export function DuesMatrix({ dues, months, nowMonth, onCell, showTotal = true }) {
  const label = { paid: 'Lunas', partial: 'Cicil', unpaid: 'Belum bayar', upcoming: 'Belum jatuh tempo', na: 'Tidak wajib' };
  return (
    <div className="matrix-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Anggota</th>
            {months.map((m) => <th key={m} className={m === nowMonth ? 'now' : ''}>{monthLabel(m, 'abbr')}<br /><span style={{ opacity: 0.6 }}>{m.slice(2, 4)}</span></th>)}
            {showTotal && <th>Total</th>}
          </tr>
        </thead>
        <tbody>
          {dues.map((d) => (
            <tr key={d.id} style={d.active ? undefined : { opacity: 0.5 }}>
              <td className="name"><div className="row"><Avatar name={d.name} size="sm" /> {d.name}</div></td>
              {d.cells.map((c) => {
                const content = c.status === 'paid' ? '✓' : c.status === 'partial' ? short(c.paid) : c.status === 'unpaid' ? '✗' : c.status === 'na' ? '—' : '';
                const title = `${d.name} · ${monthLabel(c.month)} · ${label[c.status]}${c.paid ? ` (${rupiah(c.paid)})` : ''}`;
                const cls = `cell ${c.status} ${c.month === nowMonth ? 'now' : ''}`;
                return (
                  <td key={c.month}>
                    {onCell && c.status !== 'paid' && c.status !== 'na'
                      ? <button className={cls} title={`${title} — klik untuk bayar`} onClick={() => onCell(d, c)} aria-label={title}>{content}</button>
                      : <div className={cls} title={title}>{content}</div>}
                  </td>
                );
              })}
              {showTotal && <td><div className="num" style={{ fontWeight: 700, fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap' }}>{compact(d.totalPaid)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const MatrixLegend = () => (
  <div className="legend">
    <span><i className="cell paid" style={{ minWidth: 0, height: 14 }} /> Lunas</span>
    <span><i className="cell partial" style={{ minWidth: 0, height: 14 }} /> Cicil</span>
    <span><i className="cell unpaid" style={{ minWidth: 0, height: 14 }} /> Belum bayar</span>
    <span><i className="cell upcoming" style={{ minWidth: 0, height: 14 }} /> Belum jatuh tempo</span>
    <span><i className="cell na" style={{ minWidth: 0, height: 14, border: '1px solid var(--border)' }} /> Belum gabung</span>
  </div>
);
