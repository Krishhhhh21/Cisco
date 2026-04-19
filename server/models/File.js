const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  storedName: {
    type: String,
    required: true,
    unique: true
  },
  ext: {
    type: String,
    required: true,
    enum: ['.pkt', '.html', '.js', '.txt', '.zip']
  },
  mimeType: {
    type: String,
    default: 'application/octet-stream'
  },
  size: {
    type: Number,
    required: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('File', FileSchema);
