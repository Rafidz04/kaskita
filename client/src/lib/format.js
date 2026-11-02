export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const idr = new Intl.NumberFormat('id-ID');

export const rupiah = (n = 0) => `Rp ${idr.format(Math.round(n || 0))}`;
export const signed = (n, type) => `${type === 'OUT' ? '−' : '+'}${rupiah(n)}`;
export const plain = (n = 0) => idr.format(Math.round(n || 0));

/** Rp 610,7rb / Rp 1,2jt */
export function compact(n = 0) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toFixed(1).replace('.', ',').replace(',0', '')}M`;
  if (a >= 1e6) return `${sign}Rp ${(a / 1e6).toFixed(1).replace('.', ',').replace(',0', '')}jt`;
  if (a >= 1e3) return `${sign}Rp ${(a / 1e3).toFixed(1).replace('.', ',').replace(',0', '')}rb`;
  return `${sign}Rp ${a}`;
}

export function monthLabel(key, mode = 'long') {
  if (!key) return '-';
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS[m - 1];
  if (mode === 'short') return `${name.slice(0, 3)} ${String(y).slice(2)}`;
  if (mode === 'abbr') return name.slice(0, 3).toUpperCase();
  if (mode === 'name') return name;
  return `${name} ${y}`;
}

export function dateLabel(key, withYear = true) {
  if (!key) return '-';
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}${withYear ? ` ${y}` : ''}`;
}

export function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(start, end) {
  const out = [];
  if (!start || !end || start > end) return out;
  let c = start;
  while (c <= end && out.length < 60) { out.push(c); c = addMonths(c, 1); }
  return out;
}

const GRADS = [
  ['#8b5cf6', '#3df2ff'], ['#ff4fd8', '#ff8a3d'], ['#2ee59d', '#3df2ff'], ['#f43f5e', '#ff8a3d'],
  ['#6366f1', '#ec4899'], ['#14b8a6', '#84cc16'], ['#f59e0b', '#ef4444'], ['#0ea5e9', '#8b5cf6'],
];
export function avatarStyle(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADS[h % GRADS.length];
  return { background: `linear-gradient(135deg, ${a}, ${b})` };
}
export const initials = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export const CHART_COLORS = ['#8b5cf6', '#ff4fd8', '#3df2ff', '#c6ff3d', '#ff8a3d', '#2ee59d', '#ffd23f', '#f43f5e'];

export function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 11) return 'Pagi';
  if (h < 15) return 'Siang';
  if (h < 18) return 'Sore';
  return 'Malam';
}

export const CATEGORY_EMOJI = { 'Iuran Kas': '💰', Jajan: '🍢', Sumbangan: '🎁', Operasional: '🛠️', Lainnya: '✨' };
export const catEmoji = (c) => CATEGORY_EMOJI[c] || '🏷️';

export function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
