const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  settings: {
    theme: { type: String, default: 'dark' },
    accentColor: { type: String, default: '#00f0ff' },
    fontSize: { type: String, default: 'medium' },
    bubbleStyle: { type: String, default: 'modern' },
    showOnlineStatus: { type: Boolean, default: true },
    showReadReceipts: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    messageSound: { type: Boolean, default: true },
    desktopNotifications: { type: Boolean, default: true },
    notificationVolume: { type: Number, default: 50 },
    enterToSend: { type: Boolean, default: true },
    mediaAutoDownload: { type: Boolean, default: true },
    messagePreview: { type: Boolean, default: true }
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  activeSessions: [{
    token: String,
    device: String,
    ip: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    status: this.status,
    lastSeen: this.lastSeen,
    settings: this.settings
  };
};

module.exports = mongoose.model('User', userSchema);
