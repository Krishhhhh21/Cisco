require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Utility Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Static Client Files ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/', require('./routes/files'));   // GET /files, GET /download/:id
app.use('/admin', require('./routes/admin')); // POST /admin/login, etc.

// ── SPA Fallback ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ── Connect to MongoDB & Start ─────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Seed admin account if none exists
    const Admin = require('./models/Admin');
    const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!exists) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await Admin.create({
        username: process.env.ADMIN_USERNAME,
        passwordHash: hash
      });
      console.log(`✅ Admin seeded — username: ${process.env.ADMIN_USERNAME}  password: ${process.env.ADMIN_PASSWORD}`);
    }

    app.listen(PORT, () => {
      console.log(`🚀 PacketVault running → http://localhost:${PORT}`);
      console.log(`📁 Admin panel       → http://localhost:${PORT}/admin.html`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Make sure MongoDB is running: mongod --dbpath <path>');
    process.exit(1);
  });
