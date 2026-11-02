import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    role: this.role,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

const memberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Bulan mulai wajib bayar (YYYY-MM). Sebelum bulan ini = "-" di spreadsheet (tidak wajib).
    joinMonth: { type: String, required: true },
    // Bulan terakhir wajib bayar (opsional, kalau anggota keluar)
    leaveMonth: { type: String, default: null },
    active: { type: Boolean, default: true },
    phone: { type: String, default: '' },
    note: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const transactionSchema = new Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    voucher: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, enum: ['IN', 'OUT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'Lainnya', trim: true },
    vendor: { type: String, default: '', trim: true },
    method: { type: String, default: 'Tunai', trim: true },
    // Khusus pembayaran iuran kas
    member: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    duesMonth: { type: String, default: null }, // YYYY-MM
    // true = pembayaran sebelum saldo awal (sudah termasuk saldo awal, tidak dihitung ulang)
    legacy: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
transactionSchema.index({ member: 1, duesMonth: 1 });

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    orgName: { type: String, default: 'KasKita' },
    tagline: { type: String, default: 'Kas kecil, vibes besar ✨' },
    openingBalance: { type: Number, default: 0 },
    openingDate: { type: String, default: '2026-08-29' },
    duesAmount: { type: Number, default: 20000 },
    periodStart: { type: String, default: '2026-09' },
    periodEnd: { type: String, default: '2027-05' },
    voucherPrefix: { type: String, default: 'PCV-' },
    categories: { type: [String], default: ['Iuran Kas', 'Jajan', 'Sumbangan', 'Operasional', 'Lainnya'] },
    methods: { type: [String], default: ['Tunai', 'BCA', 'ShopeePay', 'Tunai & ShopeePay'] },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || model('User', userSchema);
export const Member = mongoose.models.Member || model('Member', memberSchema);
export const Transaction = mongoose.models.Transaction || model('Transaction', transactionSchema);
export const Settings = mongoose.models.Settings || model('Settings', settingsSchema);

export async function getSettings() {
  let s = await Settings.findOne({ key: 'main' });
  if (!s) s = await Settings.create({ key: 'main' });
  return s;
}

export const DUES_CATEGORY = 'Iuran Kas';
