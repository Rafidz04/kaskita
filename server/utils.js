// Helper bulan & tanggal. Semua bulan disimpan sebagai "YYYY-MM", tanggal sebagai "YYYY-MM-DD"
// supaya bebas drama timezone.

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const isMonthKey = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const isDateKey = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(start, end, max = 60) {
  const out = [];
  if (!isMonthKey(start) || !isMonthKey(end) || start > end) return out;
  let cur = start;
  while (cur <= end && out.length < max) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function monthLabel(key, short = false) {
  const [y, m] = key.split('-').map(Number);
  const name = MONTH_NAMES_ID[m - 1];
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

/** Tanggal hari ini (zona Asia/Jakarta) dalam format YYYY-MM-DD */
export function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export const currentMonthKey = () => todayKey().slice(0, 7);
