require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

const { protect } = require('./middleware/auth');
const { upload } = require('./middleware/upload');
const { multerUploadChain } = require('./controllers/uploadController');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// ── CORS: allow GitHub Pages + local dev (override with FRONTEND_ORIGINS) ─
const defaultOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];
const extraOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...extraOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn('CORS blocked origin:', origin);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

// ── Security & Utility Middleware ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Health (Render / load balancers) ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'packetvault-api' });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/', require('./routes/files'));
app.use('/admin', require('./routes/admin'));

// POST /upload — alias for POST /admin/upload (GitHub Pages + mobile clients)
app.post('/upload', protect, multerUploadChain(upload));

const clientDir = path.join(__dirname, '../client');
const serveStatic = process.env.SERVE_STATIC !== 'false';

if (serveStatic) {
  app.use(express.static(clientDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// ── Connect to MongoDB & Start ─────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    const Admin = require('./models/Admin');
    const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!exists) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await Admin.create({
        username: process.env.ADMIN_USERNAME,
        passwordHash: hash
      });
      console.log(`✅ Admin seeded — username: ${process.env.ADMIN_USERNAME}`);
    }

    app.listen(PORT, () => {
      console.log(`🚀 API listening on port ${PORT}`);
      console.log(`   SERVE_STATIC=${serveStatic ? 'on (local UI)' : 'off (API only)'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
