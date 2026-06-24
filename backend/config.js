require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/synch',
  JWT_SECRET: process.env.JWT_SECRET || 'synch-secret-key-change-in-production',
  JWT_EXPIRES_IN: '7d',
  UPLOAD_PATH: './uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_AUDIO_TYPES: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg']
};
