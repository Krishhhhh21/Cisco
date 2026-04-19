const path = require('path');
const File = require('../models/File');
const ActivityLog = require('../models/ActivityLog');

async function persistUploadedFiles(req, res) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  try {
    const saved = [];
    for (const f of req.files) {
      const ext = path.extname(f.originalname).toLowerCase();
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
}

function multerUploadChain(upload) {
  return (req, res) => {
    upload.array('files', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      await persistUploadedFiles(req, res);
    });
  };
}

module.exports = { persistUploadedFiles, multerUploadChain };
