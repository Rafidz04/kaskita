import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Member, Transaction, getSettings, DUES_CATEGORY } from './models.js';
import { buildDashboard, slimTx, publicSettings } from './dashboard.js';
import { isMonthKey, isDateKey, monthLabel, todayKey } from './utils.js';

const router = Router();
const JWT_SECRET = () => process.env.JWT_SECRET || 'kaskita-dev-secret';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

// ===== Auth middleware =====
async function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Login dulu ya 🙏');
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET());
  } catch {
    throw new HttpError(401, 'Sesi habis, login ulang ya');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Akun tidak ditemukan');
  req.user = user;
  next();
}
const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Akses khusus Super Admin 🔒');
  next();
};
const superOnly = requireRole('superadmin');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

async function nextVoucher() {
  const s = await getSettings();
  const prefix = s.voucherPrefix || 'PCV-';
  const list = await Transaction.find({ voucher: { $regex: `^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\d+$` } }, 'voucher').lean();
  const max = list.reduce((m, t) => Math.max(m, parseInt(t.voucher.slice(prefix.length), 10) || 0), 100);
  return { prefix, next: max + 1, voucher: `${prefix}${max + 1}` };
}

// ===== Health =====
router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ===== Auth =====
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw bad('Username & password wajib diisi');
  const user = await User.findOne({ username: String(username).toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    throw new HttpError(401, 'Username atau password salah 😵');
  }
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET(), { expiresIn: '7d' });
  res.json({ token, user: user.toSafeJSON() });
});

router.get('/auth/me', auth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

router.put('/auth/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) throw bad('Password baru minimal 6 karakter');
  if (!(await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash))) throw bad('Password lama salah');
  req.user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await req.user.save();
  res.json({ ok: true });
});

// ===== Public (guest) =====
router.get('/dashboard', async (_req, res) => res.json(await buildDashboard()));
router.get('/settings', async (_req, res) => res.json(publicSettings(await getSettings())));

// ===== Settings (superadmin) =====
router.put('/settings', auth, superOnly, async (req, res) => {
  const s = await getSettings();
  const b = req.body || {};
  if (b.orgName !== undefined) s.orgName = String(b.orgName).trim() || 'KasKita';
  if (b.tagline !== undefined) s.tagline = String(b.tagline).trim();
  if (b.openingBalance !== undefined) {
    if (Number.isNaN(num(b.openingBalance))) throw bad('Saldo awal tidak valid');
    s.openingBalance = num(b.openingBalance);
  }
  if (b.openingDate !== undefined) {
    if (!isDateKey(b.openingDate)) throw bad('Tanggal saldo awal tidak valid');
    s.openingDate = b.openingDate;
  }
  if (b.duesAmount !== undefined) {
    if (!(num(b.duesAmount) > 0)) throw bad('Nominal iuran harus lebih dari 0');
    s.duesAmount = num(b.duesAmount);
  }
  if (b.periodStart !== undefined || b.periodEnd !== undefined) {
    const ps = b.periodStart ?? s.periodStart;
    const pe = b.periodEnd ?? s.periodEnd;
    if (!isMonthKey(ps) || !isMonthKey(pe) || ps > pe) throw bad('Periode tidak valid');
    s.periodStart = ps;
    s.periodEnd = pe;
  }
  if (b.voucherPrefix !== undefined) s.voucherPrefix = String(b.voucherPrefix).trim() || 'PCV-';
  if (Array.isArray(b.categories)) {
    const cats = [...new Set(b.categories.map((c) => String(c).trim()).filter(Boolean))];
    if (!cats.includes(DUES_CATEGORY)) cats.unshift(DUES_CATEGORY);
    s.categories = cats;
  }
  if (Array.isArray(b.methods)) s.methods = [...new Set(b.methods.map((c) => String(c).trim()).filter(Boolean))];
  await s.save();
  res.json(publicSettings(s));
});

// ===== Members =====
router.get('/members', auth, async (_req, res) => {
  const members = await Member.find().sort({ order: 1, name: 1 }).lean();
  const counts = await Transaction.aggregate([
    { $match: { member: { $ne: null } } },
    { $group: { _id: '$member', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  res.json(members.map((m) => ({ ...m, id: m._id, totalPaid: map[m._id]?.total || 0, txCount: map[m._id]?.count || 0 })));
});

function memberPayload(b, partial = false) {
  const out = {};
  if (!partial || b.name !== undefined) {
    if (!String(b.name || '').trim()) throw bad('Nama anggota wajib diisi');
    out.name = String(b.name).trim();
  }
  if (!partial || b.joinMonth !== undefined) {
    if (!isMonthKey(b.joinMonth)) throw bad('Bulan mulai iuran tidak valid');
    out.joinMonth = b.joinMonth;
  }
  if (b.leaveMonth !== undefined) {
    if (b.leaveMonth && !isMonthKey(b.leaveMonth)) throw bad('Bulan berhenti tidak valid');
    out.leaveMonth = b.leaveMonth || null;
  }
  if (b.active !== undefined) out.active = !!b.active;
  if (b.phone !== undefined) out.phone = String(b.phone).trim();
  if (b.note !== undefined) out.note = String(b.note).trim();
  if (b.order !== undefined) out.order = num(b.order) || 0;
  return out;
}

router.post('/members', auth, async (req, res) => {
  const data = memberPayload(req.body || {});
  if (data.order === undefined) data.order = await Member.countDocuments();
  const m = await Member.create(data);
  res.status(201).json(m);
});

router.put('/members/:id', auth, async (req, res) => {
  const m = await Member.findByIdAndUpdate(req.params.id, memberPayload(req.body || {}, true), { new: true, runValidators: true });
  if (!m) throw new HttpError(404, 'Anggota tidak ditemukan');
  res.json(m);
});

router.delete('/members/:id', auth, superOnly, async (req, res) => {
  const used = await Transaction.countDocuments({ member: req.params.id });
  if (used > 0 && req.query.force !== '1') {
    throw bad(`Anggota punya ${used} transaksi iuran. Nonaktifkan saja, atau hapus paksa (transaksi tetap ada tanpa nama anggota).`);
  }
  if (used > 0) await Transaction.updateMany({ member: req.params.id }, { $set: { member: null, duesMonth: null } });
  await Member.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ===== Transactions =====
router.get('/transactions', auth, async (req, res) => {
  const filter = {};
  if (req.query.type === 'IN' || req.query.type === 'OUT') filter.type = req.query.type;
  if (isMonthKey(req.query.month)) filter.date = { $regex: `^${req.query.month}` };
  if (req.query.member) filter.member = req.query.member;
  if (req.query.legacy !== '1') filter.legacy = { $ne: true };
  const list = await Transaction.find(filter).sort({ date: -1, voucher: -1 }).populate('member', 'name').lean();
  res.json(list.map(slimTx));
});

router.get('/transactions/next-voucher', auth, async (_req, res) => res.json(await nextVoucher()));

async function txPayload(b, partial = false) {
  const out = {};
  if (!partial || b.date !== undefined) {
    if (!isDateKey(b.date)) throw bad('Tanggal tidak valid');
    out.date = b.date;
  }
  if (!partial || b.type !== undefined) {
    if (!['IN', 'OUT'].includes(b.type)) throw bad('Jenis transaksi harus IN atau OUT');
    out.type = b.type;
  }
  if (!partial || b.amount !== undefined) {
    if (!(num(b.amount) > 0)) throw bad('Nominal harus lebih dari 0');
    out.amount = num(b.amount);
  }
  if (!partial || b.description !== undefined) {
    if (!String(b.description || '').trim()) throw bad('Keterangan wajib diisi');
    out.description = String(b.description).trim();
  }
  if (b.voucher !== undefined && String(b.voucher).trim()) out.voucher = String(b.voucher).trim();
  if (b.category !== undefined) out.category = String(b.category).trim() || 'Lainnya';
  if (b.vendor !== undefined) out.vendor = String(b.vendor).trim();
  if (b.method !== undefined) out.method = String(b.method).trim() || 'Tunai';
  if (b.member !== undefined) {
    if (b.member) {
      if (!(await Member.exists({ _id: b.member }))) throw bad('Anggota tidak ditemukan');
      out.member = b.member;
    } else out.member = null;
  }
  if (b.duesMonth !== undefined) {
    if (b.duesMonth && !isMonthKey(b.duesMonth)) throw bad('Bulan iuran tidak valid');
    out.duesMonth = b.duesMonth || null;
  }
  return out;
}

router.post('/transactions', auth, async (req, res) => {
  const data = await txPayload(req.body || {});
  if (!data.voucher) data.voucher = (await nextVoucher()).voucher;
  if (data.category === DUES_CATEGORY && data.type === 'IN' && (!data.member || !data.duesMonth)) {
    throw bad('Iuran kas wajib pilih anggota & bulan');
  }
  if (data.type === 'OUT') {
    data.member = null;
    data.duesMonth = null;
  }
  data.createdBy = req.user._id;
  const t = await Transaction.create(data);
  await t.populate('member', 'name');
  res.status(201).json(slimTx(t));
});

// Bayar iuran untuk banyak bulan sekaligus → 1 transaksi per bulan (sama seperti di spreadsheet)
router.post('/transactions/dues', auth, async (req, res) => {
  const b = req.body || {};
  const member = await Member.findById(b.member);
  if (!member) throw bad('Pilih anggota dulu');
  const months = [...new Set(Array.isArray(b.months) ? b.months : [])].filter(isMonthKey).sort();
  if (!months.length) throw bad('Pilih minimal 1 bulan');
  const amount = num(b.amount);
  if (!(amount > 0)) throw bad('Nominal harus lebih dari 0');
  const date = isDateKey(b.date) ? b.date : todayKey();
  const method = String(b.method || 'Tunai').trim();
  const { prefix, next } = await nextVoucher();

  const docs = months.map((month, i) => ({
    date,
    voucher: `${prefix}${next + i}`,
    description: `${member.name} bayar kas ${monthLabel(month).split(' ')[0]}${b.note ? ` — ${String(b.note).trim()}` : ''}`,
    type: 'IN',
    amount,
    category: DUES_CATEGORY,
    vendor: 'Bayar',
    method,
    member: member._id,
    duesMonth: month,
    createdBy: req.user._id,
  }));
  const created = await Transaction.insertMany(docs);
  res.status(201).json({ count: created.length, total: amount * created.length });
});

router.put('/transactions/:id', auth, async (req, res) => {
  const data = await txPayload(req.body || {}, true);
  if (data.type === 'OUT') {
    data.member = null;
    data.duesMonth = null;
  }
  data.updatedBy = req.user._id;
  const t = await Transaction.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).populate('member', 'name');
  if (!t) throw new HttpError(404, 'Transaksi tidak ditemukan');
  res.json(slimTx(t));
});

router.delete('/transactions/:id', auth, async (req, res) => {
  const t = await Transaction.findByIdAndDelete(req.params.id);
  if (!t) throw new HttpError(404, 'Transaksi tidak ditemukan');
  res.json({ ok: true });
});

// ===== Users (superadmin) =====
router.get('/users', auth, superOnly, async (_req, res) => {
  const users = await User.find().sort({ role: -1, createdAt: 1 });
  res.json(users.map((u) => u.toSafeJSON()));
});

router.post('/users', auth, superOnly, async (req, res) => {
  const { username, name, password, role } = req.body || {};
  if (!username || !/^[a-z0-9._-]{3,30}$/i.test(username)) throw bad('Username 3–30 karakter (huruf, angka, . _ -)');
  if (!name) throw bad('Nama wajib diisi');
  if (!password || String(password).length < 6) throw bad('Password minimal 6 karakter');
  if (await User.exists({ username: username.toLowerCase() })) throw bad('Username sudah dipakai');
  const u = await User.create({
    username,
    name,
    role: role === 'superadmin' ? 'superadmin' : 'admin',
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json(u.toSafeJSON());
});

router.put('/users/:id', auth, superOnly, async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'User tidak ditemukan');
  const { name, password, role } = req.body || {};
  if (name) u.name = String(name).trim();
  if (role && ['admin', 'superadmin'].includes(role)) {
    if (String(u._id) === String(req.user._id) && role !== 'superadmin') throw bad('Tidak bisa menurunkan role diri sendiri');
    u.role = role;
  }
  if (password) {
    if (String(password).length < 6) throw bad('Password minimal 6 karakter');
    u.passwordHash = await bcrypt.hash(String(password), 10);
  }
  await u.save();
  res.json(u.toSafeJSON());
});

router.delete('/users/:id', auth, superOnly, async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw bad('Tidak bisa menghapus akun sendiri');
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'User tidak ditemukan');
  if (u.role === 'superadmin' && (await User.countDocuments({ role: 'superadmin' })) <= 1) {
    throw bad('Minimal harus ada 1 Super Admin');
  }
  await u.deleteOne();
  res.json({ ok: true });
});

// ===== Error handler =====
router.use((_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan')));
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'CastError') { status = 400; message = 'ID tidak valid'; }
  if (err.name === 'ValidationError') status = 400;
  if (status >= 500) console.error(err);
  res.status(status).json({ message });
});

export default router;
