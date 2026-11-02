import { Member, Transaction, getSettings, DUES_CATEGORY } from './models.js';
import { monthRange, currentMonthKey, todayKey, addMonths } from './utils.js';

/**
 * Hitung status iuran tiap anggota per bulan.
 * status: 'na' (belum/tdk wajib) | 'paid' | 'partial' | 'unpaid' (sudah jatuh tempo) | 'upcoming' (belum jatuh tempo)
 */
export function computeDues({ members, txs, months, duesAmount, nowKey }) {
  const paidMap = new Map(); // `${memberId}|${month}` -> amount
  for (const t of txs) {
    if (t.type !== 'IN' || !t.member || !t.duesMonth) continue;
    const id = String(t.member._id || t.member);
    const k = `${id}|${t.duesMonth}`;
    paidMap.set(k, (paidMap.get(k) || 0) + t.amount);
  }

  return members.map((m) => {
    const id = String(m._id);
    let totalPaid = 0;
    let arrearsAmount = 0;
    let paidAhead = 0;
    const arrears = [];
    const cells = months.map((month) => {
      const paid = paidMap.get(`${id}|${month}`) || 0;
      totalPaid += paid;
      const notRequired = month < m.joinMonth || (m.leaveMonth && month > m.leaveMonth) || (!m.active && paid === 0 && month > nowKey);
      let status;
      if (notRequired && paid === 0) status = 'na';
      else if (paid >= duesAmount) status = 'paid';
      else if (paid > 0) status = 'partial';
      else status = month <= nowKey ? 'unpaid' : 'upcoming';

      if ((status === 'unpaid' || status === 'partial') && month <= nowKey) {
        const shortfall = Math.max(duesAmount - paid, 0);
        arrears.push({ month, paid, shortfall });
        arrearsAmount += shortfall;
      }
      if (month > nowKey && paid > 0) paidAhead += 1;
      return { month, paid, status };
    });
    const required = cells.filter((c) => c.status !== 'na' && c.month <= nowKey).length;
    const settled = cells.filter((c) => c.status === 'paid' && c.month <= nowKey).length;
    return {
      id,
      name: m.name,
      joinMonth: m.joinMonth,
      leaveMonth: m.leaveMonth,
      active: m.active,
      cells,
      totalPaid,
      arrears,
      arrearsAmount,
      paidAhead,
      compliance: required ? Math.round((settled / required) * 100) : 100,
    };
  });
}

export async function buildDashboard() {
  const settings = await getSettings();
  const [members, txs] = await Promise.all([
    Member.find().sort({ order: 1, name: 1 }).lean(),
    Transaction.find().sort({ date: 1, voucher: 1 }).populate('member', 'name').lean(),
  ]);

  const nowKey = currentMonthKey();
  const months = monthRange(settings.periodStart, settings.periodEnd);
  const duesAmount = settings.duesAmount;
  const real = txs.filter((t) => !t.legacy);

  const totalIn = real.filter((t) => t.type === 'IN').reduce((s, t) => s + t.amount, 0);
  const totalOut = real.filter((t) => t.type === 'OUT').reduce((s, t) => s + t.amount, 0);
  const balance = settings.openingBalance + totalIn - totalOut;

  // ===== Iuran =====
  const dues = computeDues({ members, txs, months, duesAmount, nowKey });
  const activeDues = dues.filter((d) => d.active);
  const unpaid = dues
    .filter((d) => d.arrears.length > 0)
    .sort((a, b) => b.arrearsAmount - a.arrearsAmount || a.name.localeCompare(b.name))
    .map(({ id, name, arrears, arrearsAmount }) => ({ id, name, arrears, arrearsAmount }));
  const totalArrears = unpaid.reduce((s, u) => s + u.arrearsAmount, 0);

  const curIdx = months.indexOf(nowKey);
  const focusMonth = curIdx >= 0 ? nowKey : (nowKey < months[0] ? months[0] : months[months.length - 1]);
  const focusCells = activeDues
    .map((d) => d.cells.find((c) => c.month === focusMonth))
    .filter((c) => c && c.status !== 'na');
  const thisMonth = {
    month: focusMonth,
    eligible: focusCells.length,
    paid: focusCells.filter((c) => c.status === 'paid').length,
    partial: focusCells.filter((c) => c.status === 'partial').length,
    collected: focusCells.reduce((s, c) => s + c.paid, 0),
    target: focusCells.length * duesAmount,
  };

  // Rekap per bulan iuran (berapa orang lunas per bulan)
  const duesByMonth = months.map((month) => {
    const cells = activeDues.map((d) => d.cells.find((c) => c.month === month)).filter((c) => c.status !== 'na');
    return {
      month,
      eligible: cells.length,
      paid: cells.filter((c) => c.status === 'paid').length,
      collected: cells.reduce((s, c) => s + c.paid, 0),
    };
  });

  // ===== Arus kas bulanan =====
  const firstMonth = (settings.openingDate || todayKey()).slice(0, 7);
  const lastTxMonth = real.length ? real[real.length - 1].date.slice(0, 7) : firstMonth;
  const endMonth = [nowKey, lastTxMonth].sort().pop();
  const flowMonths = monthRange(firstMonth, endMonth < firstMonth ? firstMonth : endMonth);
  let running = settings.openingBalance;
  const cashflow = flowMonths.map((month) => {
    const list = real.filter((t) => t.date.startsWith(month));
    const inn = list.filter((t) => t.type === 'IN').reduce((s, t) => s + t.amount, 0);
    const out = list.filter((t) => t.type === 'OUT').reduce((s, t) => s + t.amount, 0);
    running += inn - out;
    return { month, in: inn, out, balance: running, count: list.length };
  });

  // ===== Breakdown =====
  const group = (list, keyFn) => {
    const map = new Map();
    for (const t of list) {
      const k = keyFn(t) || 'Lainnya';
      const cur = map.get(k) || { name: k, amount: 0, count: 0 };
      cur.amount += t.amount;
      cur.count += 1;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };
  const outByCategory = group(real.filter((t) => t.type === 'OUT'), (t) => t.category);
  const inByCategory = group(real.filter((t) => t.type === 'IN'), (t) => t.category);
  const byMethod = group(real, (t) => t.method);

  const outs = real.filter((t) => t.type === 'OUT');
  const biggestOut = outs.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Pengeluaran bulan ini vs bulan lalu
  const prevKey = addMonths(nowKey, -1);
  const sumOut = (k) => outs.filter((t) => t.date.startsWith(k)).reduce((s, t) => s + t.amount, 0);
  const outThisMonth = sumOut(nowKey);
  const outPrevMonth = sumOut(prevKey);

  const recent = real
    .slice()
    .sort((a, b) => (b.date + b.voucher).localeCompare(a.date + a.voucher))
    .slice(0, 8)
    .map(slimTx);

  const leaderboard = activeDues
    .map(({ id, name, totalPaid, compliance, paidAhead, arrearsAmount }) => ({ id, name, totalPaid, compliance, paidAhead, arrearsAmount }))
    .sort((a, b) => b.totalPaid - a.totalPaid || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    today: todayKey(),
    nowMonth: nowKey,
    settings: publicSettings(settings),
    summary: {
      openingBalance: settings.openingBalance,
      totalIn,
      totalOut,
      balance,
      txCount: real.length,
      inCount: real.filter((t) => t.type === 'IN').length,
      outCount: outs.length,
      avgOut: outs.length ? Math.round(totalOut / outs.length) : 0,
      totalDuesCollected: real.filter((t) => t.category === DUES_CATEGORY).reduce((s, t) => s + t.amount, 0),
      totalArrears,
      memberCount: activeDues.length,
      unpaidCount: unpaid.length,
      outThisMonth,
      outPrevMonth,
    },
    months,
    dues,
    unpaid,
    thisMonth,
    duesByMonth,
    cashflow,
    outByCategory,
    inByCategory,
    byMethod,
    biggestOut: biggestOut.map(slimTx),
    recent,
    leaderboard,
  };
}

export function slimTx(t) {
  return {
    id: t._id,
    date: t.date,
    voucher: t.voucher,
    description: t.description,
    type: t.type,
    amount: t.amount,
    category: t.category,
    vendor: t.vendor,
    method: t.method,
    member: t.member ? { id: t.member._id || t.member, name: t.member.name } : null,
    duesMonth: t.duesMonth,
    legacy: !!t.legacy,
  };
}

export function publicSettings(s) {
  return {
    orgName: s.orgName,
    tagline: s.tagline,
    openingBalance: s.openingBalance,
    openingDate: s.openingDate,
    duesAmount: s.duesAmount,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    voucherPrefix: s.voucherPrefix,
    categories: s.categories,
    methods: s.methods,
  };
}
