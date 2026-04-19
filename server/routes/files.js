const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const ActivityLog = require('../models/ActivityLog');

// GET /files — list all files (public)
router.get('/files', async (req, res) => {
  try {
    const { search, ext } = req.query;
    const query = {};
    if (search && search.trim()) {
      query.originalName = { $regex: search.trim(), $options: 'i' };
    }
    if (ext && ext !== 'all') {
      query.ext = ext;
    }
    const files = await File.find(query).sort({ uploadedAt: -1 });
    res.json(files);
  } catch (err) {
    console.error('GET /files error:', err);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// GET /download/:id — stream file download (public)
router.get('/download/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, '../uploads', file.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File no longer exists on disk' });
    }

    // Increment download count
    file.downloadCount += 1;
    await file.save();

    // Log activity
    await ActivityLog.create({
      action: 'download',
      fileName: file.originalName,
      fileId: file._id,
      fileSize: file.size,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, file.originalName);
  } catch (err) {
    console.error('GET /download/:id error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;
