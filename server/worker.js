import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DurableObject } from 'cloudflare:workers';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Member, Transaction, getSettings, DUES_CATEGORY } from './models.js';
import { buildDashboard, slimTx, publicSettings } from './dashboard.js';
import { isMonthKey, isDateKey, monthLabel, todayKey } from './utils.js';
import { seed } from './seed.js';

const app = new Hono();

app.use('*', cors());

// Global error handler so Worker never crashes with 1101
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ message: err.message || 'Terjadi kesalahan pada server' }, 500);
});

// ===== Health (responds fast without waiting for DB) =====
app.get('/api/health', (c) => {
  const state = mongoose.connection.readyState;
  return c.json({
    ok: true,
    db: state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// Ensure MongoDB is connected safely in serverless
let connectingPromise = null;
let isSeeded = true;

// Attach listeners to prevent unhandled EventEmitter errors from crashing workerd
mongoose.connection.on('error', (err) => {
  console.warn('Mongoose background connection error:', err?.message || err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose background connection disconnected');
});

async function connectDb(uri) {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }
  if (mongoose.connection.readyState === 3) await mongoose.disconnect();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 2,
    minPoolSize: 0,
    maxIdleTimeMS: 15000,
  });

  if (!isSeeded) {
    try {
      await seed();
      isSeeded = true;
    } catch (e) {
      console.warn('Seed notice:', e.message);
    }
  }
}

async function ensureDb(env) {
  if (mongoose.connection.readyState === 1) return;

  const uri = env?.MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI belum diset di Environment Variables Cloudflare!');

  if (!connectingPromise) {
    const attempt = connectDb(uri);
    connectingPromise = attempt;
    try {
      await attempt;
    } finally {
      if (connectingPromise === attempt) connectingPromise = null;
    }
    return;
  }

  await connectingPromise;
}

app.use('/api/*', async (c, next) => {
  await ensureDb(c.env);
  await next();
});

const getJwtSecret = (env) => env?.JWT_SECRET || process.env.JWT_SECRET || 'kaskita-secret-key-2026';

// Auth middleware
async function auth(c, next) {
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return c.json({ message: 'Login dulu ya 🙏' }, 401);
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(c.env));
  } catch {
    return c.json({ message: 'Sesi habis, login ulang ya' }, 401);
  }
  const user = await User.findById(payload.sub);
  if (!user) return c.json({ message: 'Akun tidak ditemukan' }, 401);
  c.set('user', user);
  await next();
}

function superOnly(c, next) {
  const user = c.get('user');
  if (user?.role !== 'superadmin') {
    return c.json({ message: 'Akses khusus Super Admin 🔒' }, 403);
  }
  return next();
}

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

// ===== Auth =====
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = (await c.req.json().catch(() => ({}))) || {};
    if (!username || !password) return c.json({ message: 'Username & password wajib diisi' }, 400);
    const user = await User.findOne({ username: String(username).toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      return c.json({ message: 'Username atau password salah 😵' }, 401);
    }
    user.lastLoginAt = new Date();
    await user.save();
    const token = jwt.sign({ sub: String(user._id), role: user.role }, getJwtSecret(c.env), { expiresIn: '7d' });
    return c.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    return c.json({ message: err.message || 'Gagal login, coba lagi' }, 500);
  }
});

app.get('/api/auth/me', auth, (c) => c.json({ user: c.get('user').toSafeJSON() }));

app.put('/api/auth/password', auth, async (c) => {
  const user = c.get('user');
  const { currentPassword, newPassword } = (await c.req.json().catch(() => ({}))) || {};
  if (!newPassword || String(newPassword).length < 6) return c.json({ message: 'Password baru minimal 6 karakter' }, 400);
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) return c.json({ message: 'Password lama salah' }, 400);
  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  return c.json({ ok: true });
});

// ===== Public (guest) =====
app.get('/api/dashboard', async (c) => c.json(await buildDashboard()));
app.get('/api/settings', async (c) => c.json(publicSettings(await getSettings())));

// ===== Settings (superadmin) =====
app.put('/api/settings', auth, superOnly, async (c) => {
  const s = await getSettings();
  const b = (await c.req.json().catch(() => ({}))) || {};
  if (b.orgName !== undefined) s.orgName = String(b.orgName).trim() || 'KasKita';
  if (b.tagline !== undefined) s.tagline = String(b.tagline).trim();
  if (b.openingBalance !== undefined) {
    if (Number.isNaN(num(b.openingBalance))) return c.json({ message: 'Saldo awal tidak valid' }, 400);
    s.openingBalance = num(b.openingBalance);
  }
  if (b.openingDate !== undefined) {
    if (!isDateKey(b.openingDate)) return c.json({ message: 'Tanggal saldo awal tidak valid' }, 400);
    s.openingDate = b.openingDate;
  }
  if (b.duesAmount !== undefined) {
    if (!(num(b.duesAmount) > 0)) return c.json({ message: 'Nominal iuran harus lebih dari 0' }, 400);
    s.duesAmount = num(b.duesAmount);
  }
  if (b.periodStart !== undefined || b.periodEnd !== undefined) {
    const ps = b.periodStart ?? s.periodStart;
    const pe = b.periodEnd ?? s.periodEnd;
    if (!isMonthKey(ps) || !isMonthKey(pe) || ps > pe) return c.json({ message: 'Periode tidak valid' }, 400);
    s.periodStart = ps;
    s.periodEnd = pe;
  }
  if (b.voucherPrefix !== undefined) s.voucherPrefix = String(b.voucherPrefix).trim() || 'PCV-';
  if (Array.isArray(b.categories)) {
    const cats = [...new Set(b.categories.map((x) => String(x).trim()).filter(Boolean))];
    if (!cats.includes(DUES_CATEGORY)) cats.unshift(DUES_CATEGORY);
    s.categories = cats;
  }
  if (Array.isArray(b.methods)) s.methods = [...new Set(b.methods.map((x) => String(x).trim()).filter(Boolean))];
  await s.save();
  return c.json(publicSettings(s));
});

// ===== Members =====
app.get('/api/members', auth, async (c) => {
  const members = await Member.find().sort({ order: 1, name: 1 }).lean();
  const counts = await Transaction.aggregate([
    { $match: { member: { $ne: null } } },
    { $group: { _id: '$member', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((x) => [String(x._id), x]));
  return c.json(members.map((m) => ({ ...m, id: m._id, totalPaid: map[m._id]?.total || 0, txCount: map[m._id]?.count || 0 })));
});

function memberPayload(b, partial = false) {
  const out = {};
  if (!partial || b.name !== undefined) {
    if (!String(b.name || '').trim()) throw new Error('Nama anggota wajib diisi');
    out.name = String(b.name).trim();
  }
  if (!partial || b.joinMonth !== undefined) {
    if (!isMonthKey(b.joinMonth)) throw new Error('Bulan mulai iuran tidak valid');
    out.joinMonth = b.joinMonth;
  }
  if (b.leaveMonth !== undefined) {
    if (b.leaveMonth && !isMonthKey(b.leaveMonth)) throw new Error('Bulan berhenti tidak valid');
    out.leaveMonth = b.leaveMonth || null;
  }
  if (b.active !== undefined) out.active = !!b.active;
  if (b.phone !== undefined) out.phone = String(b.phone).trim();
  if (b.note !== undefined) out.note = String(b.note).trim();
  if (b.order !== undefined) out.order = num(b.order) || 0;
  return out;
}

app.post('/api/members', auth, async (c) => {
  try {
    const data = memberPayload(await c.req.json());
    if (data.order === undefined) data.order = await Member.countDocuments();
    const m = await Member.create(data);
    return c.json(m, 201);
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.put('/api/members/:id', auth, async (c) => {
  try {
    const m = await Member.findByIdAndUpdate(c.req.param('id'), memberPayload(await c.req.json(), true), { new: true, runValidators: true });
    if (!m) return c.json({ message: 'Anggota tidak ditemukan' }, 404);
    return c.json(m);
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.delete('/api/members/:id', auth, superOnly, async (c) => {
  const id = c.req.param('id');
  const used = await Transaction.countDocuments({ member: id });
  if (used > 0 && c.req.query('force') !== '1') {
    return c.json({ message: `Anggota punya ${used} transaksi iuran. Nonaktifkan saja, atau hapus paksa.` }, 400);
  }
  if (used > 0) await Transaction.updateMany({ member: id }, { $set: { member: null, duesMonth: null } });
  await Member.findByIdAndDelete(id);
  return c.json({ ok: true });
});

// ===== Transactions =====
app.get('/api/transactions', auth, async (c) => {
  const filter = {};
  const tType = c.req.query('type');
  const tMonth = c.req.query('month');
  const tMember = c.req.query('member');
  if (tType === 'IN' || tType === 'OUT') filter.type = tType;
  if (isMonthKey(tMonth)) filter.date = { $regex: `^${tMonth}` };
  if (tMember) filter.member = tMember;
  if (c.req.query('legacy') !== '1') filter.legacy = { $ne: true };
  const list = await Transaction.find(filter).sort({ date: -1, voucher: -1 }).populate('member', 'name').lean();
  return c.json(list.map(slimTx));
});

app.get('/api/transactions/next-voucher', auth, async (c) => c.json(await nextVoucher()));

async function txPayload(b, partial = false) {
  const out = {};
  if (!partial || b.date !== undefined) {
    if (!isDateKey(b.date)) throw new Error('Tanggal tidak valid');
    out.date = b.date;
  }
  if (!partial || b.type !== undefined) {
    if (!['IN', 'OUT'].includes(b.type)) throw new Error('Jenis transaksi harus IN atau OUT');
    out.type = b.type;
  }
  if (!partial || b.amount !== undefined) {
    if (!(num(b.amount) > 0)) throw new Error('Nominal harus lebih dari 0');
    out.amount = num(b.amount);
  }
  if (!partial || b.description !== undefined) {
    if (!String(b.description || '').trim()) throw new Error('Keterangan wajib diisi');
    out.description = String(b.description).trim();
  }
  if (b.voucher !== undefined && String(b.voucher).trim()) out.voucher = String(b.voucher).trim();
  if (b.category !== undefined) out.category = String(b.category).trim() || 'Lainnya';
  if (b.vendor !== undefined) out.vendor = String(b.vendor).trim();
  if (b.method !== undefined) out.method = String(b.method).trim() || 'Tunai';
  if (b.member !== undefined) {
    if (b.member) {
      if (!(await Member.exists({ _id: b.member }))) throw new Error('Anggota tidak ditemukan');
      out.member = b.member;
    } else out.member = null;
  }
  if (b.duesMonth !== undefined) {
    if (b.duesMonth && !isMonthKey(b.duesMonth)) throw new Error('Bulan iuran tidak valid');
    out.duesMonth = b.duesMonth || null;
  }
  return out;
}

app.post('/api/transactions', auth, async (c) => {
  try {
    const user = c.get('user');
    const data = await txPayload(await c.req.json());
    if (!data.voucher) data.voucher = (await nextVoucher()).voucher;
    if (data.category === DUES_CATEGORY && data.type === 'IN' && (!data.member || !data.duesMonth)) {
      return c.json({ message: 'Iuran kas wajib pilih anggota & bulan' }, 400);
    }
    if (data.type === 'OUT') {
      data.member = null;
      data.duesMonth = null;
    }
    data.createdBy = user._id;
    const t = await Transaction.create(data);
    await t.populate('member', 'name');
    return c.json(slimTx(t), 201);
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.post('/api/transactions/dues', auth, async (c) => {
  try {
    const user = c.get('user');
    const b = (await c.req.json().catch(() => ({}))) || {};
    const member = await Member.findById(b.member);
    if (!member) return c.json({ message: 'Pilih anggota dulu' }, 400);
    const months = [...new Set(Array.isArray(b.months) ? b.months : [])].filter(isMonthKey).sort();
    if (!months.length) return c.json({ message: 'Pilih minimal 1 bulan' }, 400);
    const amount = num(b.amount);
    if (!(amount > 0)) return c.json({ message: 'Nominal harus lebih dari 0' }, 400);
    const date = isDateKey(b.date) ? b.date : todayKey();
    const method = String(b.method || 'Tunai').trim();
    const { prefix, next } = await nextVoucher();

    const docs = months.map((m, i) => ({
      date,
      voucher: `${prefix}${next + i}`,
      description: `${member.name} bayar kas ${monthLabel(m).split(' ')[0]}${b.note ? ` — ${String(b.note).trim()}` : ''}`,
      type: 'IN',
      amount,
      category: DUES_CATEGORY,
      vendor: 'Bayar',
      method,
      member: member._id,
      duesMonth: m,
      createdBy: user._id,
    }));
    const created = await Transaction.insertMany(docs);
    return c.json({ count: created.length, total: amount * created.length }, 201);
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.put('/api/transactions/:id', auth, async (c) => {
  try {
    const user = c.get('user');
    const data = await txPayload(await c.req.json(), true);
    if (data.type === 'OUT') {
      data.member = null;
      data.duesMonth = null;
    }
    data.updatedBy = user._id;
    const t = await Transaction.findByIdAndUpdate(c.req.param('id'), data, { new: true, runValidators: true }).populate('member', 'name');
    if (!t) return c.json({ message: 'Transaksi tidak ditemukan' }, 404);
    return c.json(slimTx(t));
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.delete('/api/transactions/:id', auth, async (c) => {
  const t = await Transaction.findByIdAndDelete(c.req.param('id'));
  if (!t) return c.json({ message: 'Transaksi tidak ditemukan' }, 404);
  return c.json({ ok: true });
});

// ===== Users (superadmin) =====
app.get('/api/users', auth, superOnly, async (c) => {
  const users = await User.find().sort({ role: -1, createdAt: 1 });
  return c.json(users.map((u) => u.toSafeJSON()));
});

app.post('/api/users', auth, superOnly, async (c) => {
  try {
    const { username, name, password, role } = await c.req.json();
    if (!username || !/^[a-z0-9._-]{3,30}$/i.test(username)) return c.json({ message: 'Username 3–30 karakter' }, 400);
    if (!name) return c.json({ message: 'Nama wajib diisi' }, 400);
    if (!password || String(password).length < 6) return c.json({ message: 'Password minimal 6 karakter' }, 400);
    if (await User.exists({ username: username.toLowerCase() })) return c.json({ message: 'Username sudah dipakai' }, 400);
    const u = await User.create({
      username,
      name,
      role: role === 'superadmin' ? 'superadmin' : 'admin',
      passwordHash: await bcrypt.hash(String(password), 10),
    });
    return c.json(u.toSafeJSON(), 201);
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.put('/api/users/:id', auth, superOnly, async (c) => {
  try {
    const id = c.req.param('id');
    const u = await User.findById(id);
    if (!u) return c.json({ message: 'User tidak ditemukan' }, 404);
    const { name, password, role } = await c.req.json();
    if (name) u.name = String(name).trim();
    if (role && ['admin', 'superadmin'].includes(role)) {
      if (String(u._id) === String(c.get('user')._id) && role !== 'superadmin') {
        return c.json({ message: 'Tidak bisa menurunkan role diri sendiri' }, 400);
      }
      u.role = role;
    }
    if (password) {
      if (String(password).length < 6) return c.json({ message: 'Password minimal 6 karakter' }, 400);
      u.passwordHash = await bcrypt.hash(String(password), 10);
    }
    await u.save();
    return c.json(u.toSafeJSON());
  } catch (e) {
    return c.json({ message: e.message }, 400);
  }
});

app.delete('/api/users/:id', auth, superOnly, async (c) => {
  const id = c.req.param('id');
  if (String(id) === String(c.get('user')._id)) return c.json({ message: 'Tidak bisa menghapus akun sendiri' }, 400);
  const u = await User.findById(id);
  if (!u) return c.json({ message: 'User tidak ditemukan' }, 404);
  if (u.role === 'superadmin' && (await User.countDocuments({ role: 'superadmin' })) <= 1) {
    return c.json({ message: 'Minimal harus ada 1 Super Admin' }, 400);
  }
  await u.deleteOne();
  return c.json({ ok: true });
});

// ===== Fallthrough to Cloudflare Static Assets =====
app.all('*', (c) => {
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export default {
  async fetch(request, env, ctx) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        const id = env.KASKITA_API.idFromName('primary');
        return await env.KASKITA_API.get(id).fetch(request);
      }
      return await app.fetch(request, env, ctx);
    } catch (err) {
      console.error('Worker root error:', err);
      return new Response(
        JSON.stringify({ message: err?.message || 'Server sedang sibuk, silakan klik lagi 🙏' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};

// Keep MongoDB's TCP connection inside a Durable Object, where it can be reused
// safely across requests. Plain Workers cannot reuse I/O objects between calls.
export class KasKitaApi extends DurableObject {
  async fetch(request) {
    return app.fetch(request, this.env, this.ctx);
  }
}
