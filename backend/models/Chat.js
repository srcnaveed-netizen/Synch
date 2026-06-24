const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  name: {
    type: String,
    default: null
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }]
}, {
  timestamps: true
});

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
