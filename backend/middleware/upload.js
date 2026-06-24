const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = path.join(__dirname, '..', 'uploads');

    if (config.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      uploadPath = path.join(uploadPath, 'images');
    } else if (config.ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      uploadPath = path.join(uploadPath, 'audio');
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [...config.ALLOWED_IMAGE_TYPES, ...config.ALLOWED_AUDIO_TYPES];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE
  }
});

module.exports = upload;
