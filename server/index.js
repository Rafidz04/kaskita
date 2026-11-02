import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import apiRouter from './routes.js';
import { seed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env bawaan Node 24 (tanpa dotenv)
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  /* .env opsional (mis. di hosting pakai env var) */
}

const PORT = Number(process.env.PORT) || 5050;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI belum di-set. Cek file .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

// Serve frontend React hasil build (satu server untuk backend + frontend)
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '7d', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res.type('html').send('<h3>KasKita API jalan ✅</h3><p>Jalankan <code>npm run dev</code> lalu buka <a href="http://localhost:5173">localhost:5173</a>, atau <code>npm run build</code> untuk mode production.</p>'),
  );
}

async function start() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('🍃 MongoDB connected:', mongoose.connection.name);
  await seed({ reset: process.argv.includes('--reset-seed') });
  if (process.argv.includes('--reset-seed')) {
    await mongoose.disconnect();
    return;
  }
  app.listen(PORT, () => console.log(`🚀 KasKita jalan di http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('❌ Gagal start server:', err.message);
  process.exit(1);
});
