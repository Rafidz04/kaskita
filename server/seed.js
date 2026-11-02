import bcrypt from 'bcryptjs';
import { User, Member, Transaction, Settings, DUES_CATEGORY } from './models.js';

/**
 * Data awal diambil dari spreadsheet "DASHBOARD KAS KECIL (PETTY CASH) — Periode 2026".
 * Catatan analisa:
 *  - Saldo awal per 29/8/2026 = Rp 406.900
 *  - Tanggal di sheet campur format (M/D untuk September, D/M untuk Oktober–November) → sudah dinormalisasi.
 *  - Kolom "Penerima / Vendor" isinya bayar/jajan/sumbangan → dipetakan jadi kategori.
 *  - Matriks iuran: "-" = belum wajib (anggota baru gabung), kosong = belum bayar.
 *  - Iuran September Shandy, Kurniawan, Amir, Nia, Ali tercatat di matriks tapi tidak ada di daftar transaksi
 *    → dianggap dibayar sebelum saldo awal (legacy, tidak dihitung ulang ke saldo).
 */

const MEMBERS = [
  { name: 'Aan', joinMonth: '2026-09' },
  { name: 'Arif', joinMonth: '2026-09' },
  { name: 'Wahyu', joinMonth: '2026-09' },
  { name: 'Shandy', joinMonth: '2026-09' },
  { name: 'Kurniawan', joinMonth: '2026-09' },
  { name: 'Amir', joinMonth: '2026-09' },
  { name: 'Evi', joinMonth: '2026-09' },
  { name: 'Nia', joinMonth: '2026-09' },
  { name: 'Ali', joinMonth: '2026-09' },
  { name: 'Agung', joinMonth: '2026-10' },
  { name: 'Rafi', joinMonth: '2026-11' },
  { name: 'Ryu', joinMonth: '2026-11' },
];

// [date, voucher, description, type, amount, category, method, member?, duesMonth?]
const TX = [
  ['2026-09-02', 'PCV-101', 'Wahyu bayar kas September', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Wahyu', '2026-09'],
  ['2026-09-05', 'PCV-102', 'Beli martabak, rangin, kripik pangsit', 'OUT', 50000, 'Jajan', 'Tunai'],
  ['2026-09-07', 'PCV-103', 'Evi bayar kas September', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Evi', '2026-09'],
  ['2026-09-07', 'PCV-104', 'Kue ultah', 'OUT', 64000, 'Jajan', 'Tunai'],
  ['2026-09-09', 'PCV-105', 'Beli mie gelas', 'OUT', 18000, 'Jajan', 'Tunai'],
  ['2026-09-12', 'PCV-106', 'P Aan bayar kas September', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Aan', '2026-09'],
  ['2026-09-12', 'PCV-107', 'P Aan bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Aan', '2026-10'],
  ['2026-09-12', 'PCV-108', 'P Aan bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Aan', '2026-11'],
  ['2026-09-12', 'PCV-109', 'P Aan bayar kas Desember', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Aan', '2026-12'],
  ['2026-09-12', 'PCV-110', 'P Aan bayar kas Januari', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Aan', '2027-01'],
  ['2026-09-12', 'PCV-111', 'Beli rangin, sempol', 'OUT', 50000, 'Jajan', 'Tunai'],
  ['2026-09-19', 'PCV-112', 'Gorengan', 'OUT', 35000, 'Jajan', 'Tunai'],
  ['2026-09-26', 'PCV-113', 'Martabak Blok M', 'OUT', 50000, 'Jajan', 'Tunai'],
  ['2026-09-28', 'PCV-114', 'Nia bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'Tunai & ShopeePay', 'Nia', '2026-10'],
  ['2026-09-28', 'PCV-115', 'Kur bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Kurniawan', '2026-10'],
  ['2026-09-28', 'PCV-116', 'Ali bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Ali', '2026-10'],
  ['2026-09-30', 'PCV-117', 'Shandy bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Shandy', '2026-10'],
  ['2026-09-30', 'PCV-118', 'Evi bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Evi', '2026-10'],
  ['2026-10-01', 'PCV-119', 'P Arif kas September', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Arif', '2026-09'],
  ['2026-10-01', 'PCV-120', 'P Arif kas Oktober', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Arif', '2026-10'],
  ['2026-10-01', 'PCV-121', 'P Arif kas November', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Arif', '2026-11'],
  ['2026-10-01', 'PCV-122', 'P Wahyu bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Wahyu', '2026-10'],
  ['2026-10-02', 'PCV-123', 'Amir bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Amir', '2026-10'],
  ['2026-10-03', 'PCV-124', 'Snack', 'OUT', 53000, 'Jajan', 'BCA'],
  ['2026-10-03', 'PCV-125', 'Khamir', 'OUT', 26500, 'Jajan', 'Tunai'],
  ['2026-10-12', 'PCV-126', 'Sumbangan', 'IN', 50000, 'Sumbangan', 'BCA'],
  ['2026-10-16', 'PCV-127', 'Maxtea & lemon', 'OUT', 27700, 'Jajan', 'Tunai'],
  ['2026-10-17', 'PCV-128', 'Martabak Blok M', 'OUT', 50000, 'Jajan', 'BCA'],
  ['2026-10-17', 'PCV-129', 'Mas Agung bayar kas Oktober', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Agung', '2026-10'],
  ['2026-10-21', 'PCV-130', 'Sumbangan', 'IN', 100000, 'Sumbangan', 'BCA'],
  ['2026-10-24', 'PCV-131', 'P Aan bayar kas Februari', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Aan', '2027-02'],
  ['2026-10-24', 'PCV-132', 'P Aan bayar kas Maret', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Aan', '2027-03'],
  ['2026-10-24', 'PCV-133', 'P Aan bayar kas April', 'IN', 10000, DUES_CATEGORY, 'Tunai', 'Aan', '2027-04'],
  ['2026-10-24', 'PCV-134', 'Gorengan', 'OUT', 50000, 'Jajan', 'Tunai'],
  ['2026-10-26', 'PCV-135', 'Ali bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Ali', '2026-11'],
  ['2026-10-26', 'PCV-136', 'Rafi bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Rafi', '2026-11'],
  ['2026-10-26', 'PCV-137', 'Nia bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Nia', '2026-11'],
  ['2026-10-26', 'PCV-138', 'Evi bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Evi', '2026-11'],
  ['2026-10-26', 'PCV-139', 'Kur bayar kas November', 'IN', 20000, DUES_CATEGORY, 'ShopeePay', 'Kurniawan', '2026-11'],
  ['2026-10-26', 'PCV-140', 'Shandy bayar kas November', 'IN', 20000, DUES_CATEGORY, 'Tunai', 'Shandy', '2026-11'],
  ['2026-10-31', 'PCV-141', 'Snack', 'OUT', 62000, 'Jajan', 'Tunai'],
  ['2026-10-31', 'PCV-142', 'Ryu bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Ryu', '2026-11'],
  ['2026-10-31', 'PCV-143', 'Ryu bayar kas Desember', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Ryu', '2026-12'],
  ['2026-11-02', 'PCV-144', 'Amir bayar kas November', 'IN', 20000, DUES_CATEGORY, 'BCA', 'Amir', '2026-11'],
];

const LEGACY_SEPT = ['Shandy', 'Kurniawan', 'Amir', 'Nia', 'Ali'];

async function seedUsers() {
  if ((await User.countDocuments()) > 0) return;
  const su = process.env.SEED_SUPERADMIN_USERNAME || 'superadmin';
  const sp = process.env.SEED_SUPERADMIN_PASSWORD || 'superadmin123';
  const au = process.env.SEED_ADMIN_USERNAME || 'admin';
  const ap = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  await User.create([
    { username: su, name: 'Super Admin', role: 'superadmin', passwordHash: await bcrypt.hash(sp, 10) },
    { username: au, name: 'Admin Kas', role: 'admin', passwordHash: await bcrypt.hash(ap, 10) },
  ]);
  console.log(`👤 Seeded users: ${su} (superadmin), ${au} (admin)`);
}

async function seedData() {
  if (await Settings.exists({ key: 'main' })) return;

  await Settings.create({
    key: 'main',
    orgName: 'KasKita',
    tagline: 'Kas kecil, vibes besar ✨',
    openingBalance: 406900,
    openingDate: '2026-08-29',
    duesAmount: 20000,
    periodStart: '2026-09',
    periodEnd: '2027-05',
  });

  const created = await Member.insertMany(MEMBERS.map((m, i) => ({ ...m, order: i })));
  const byName = Object.fromEntries(created.map((m) => [m.name, m._id]));

  const docs = TX.map(([date, voucher, description, type, amount, category, method, member, duesMonth]) => ({
    date, voucher, description, type, amount, category, method,
    vendor: category === DUES_CATEGORY ? 'Bayar' : category,
    member: member ? byName[member] : null,
    duesMonth: duesMonth || null,
  }));

  LEGACY_SEPT.forEach((name, i) => {
    docs.push({
      date: '2026-08-29',
      voucher: `SA-${String(i + 1).padStart(2, '0')}`,
      description: `${name} bayar kas September (sudah termasuk saldo awal)`,
      type: 'IN',
      amount: 20000,
      category: DUES_CATEGORY,
      method: 'Tunai',
      vendor: 'Bayar',
      member: byName[name],
      duesMonth: '2026-09',
      legacy: true,
    });
  });

  await Transaction.insertMany(docs);
  console.log(`🌱 Seeded ${created.length} anggota & ${docs.length} transaksi dari spreadsheet`);
}

export async function seed({ reset = false } = {}) {
  if (reset) {
    await Promise.all([Settings.deleteMany({}), Member.deleteMany({}), Transaction.deleteMany({})]);
    console.log('♻️  Data kas di-reset ke data spreadsheet');
  }
  await seedUsers();
  await seedData();
}
