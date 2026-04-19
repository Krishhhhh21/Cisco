const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

const Admin = require('../models/Admin');
const File = require('../models/File');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// POST /admin/login
router.post('/login', [
  body('username').trim().isLength({ min: 1 }).escape(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await admin.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /admin/upload (protected, up to 10 files)
router.post('/upload', protect, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    try {
      const saved = [];
      for (const f of req.files) {
        const ext = path.extname(f.originalname).toLowerCase();
        // Sanitize: keep only safe characters
        const safeName = f.originalname
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
          .substring(0, 200)
          .trim() || 'unnamed_file' + ext;

        const doc = await File.create({
          originalName: safeName,
          storedName: f.filename,
          ext,
          mimeType: f.mimetype,
          size: f.size
        });

        // Log upload activity
        await ActivityLog.create({
          action: 'upload',
          fileName: safeName,
          fileId: doc._id,
          fileSize: f.size,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || 'unknown'
        });

        saved.push(doc);
      }
      res.status(201).json({
        message: `${saved.length} file(s) uploaded successfully`,
        files: saved
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Upload processing failed' });
    }
  });
});

// DELETE /admin/file/:id (protected)
router.delete('/file/:id', protect, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(__dirname, '../uploads', file.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Log delete activity
    await ActivityLog.create({
      action: 'delete',
      fileName: file.originalName,
      fileId: file._id,
      fileSize: file.size,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    await file.deleteOne();
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// GET /admin/stats (protected)
router.get('/stats', protect, async (req, res) => {
  try {
    const totalFiles = await File.countDocuments();
    const files = await File.find({}, 'size downloadCount ext');
    const totalDownloads = files.reduce((acc, f) => acc + f.downloadCount, 0);
    const totalStorage = files.reduce((acc, f) => acc + f.size, 0);
    const typeBreakdown = await File.aggregate([
      { $group: { _id: '$ext', count: { $sum: 1 }, totalSize: { $sum: '$size' } } }
    ]);
    res.json({ totalFiles, totalDownloads, totalStorage, typeBreakdown });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /admin/logs (protected)
router.get('/logs', protect, async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
