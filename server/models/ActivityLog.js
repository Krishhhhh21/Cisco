const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['upload', 'download', 'delete']
  },
  fileName: {
    type: String,
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  },
  fileSize: {
    type: Number,
    default: 0
  },
  ip: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
