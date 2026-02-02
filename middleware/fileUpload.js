const multer = require('multer');
const { ALLOWED_MIME_TYPES, SIZE_LIMITS } = require('../config/cloudinary');

// Configuration multer (stockage en mémoire)
const storage = multer.memoryStorage();

// Middleware multer
const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: SIZE_LIMITS.DOCUMENT,
    files: 10
  }
});

/**
 * Validation des fichiers
 */
const validateFile = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files provided'
    });
  }

  const errors = [];

  req.files.forEach((file, index) => {
    // Vérifier type MIME
    const isImage = ALLOWED_MIME_TYPES.IMAGES.includes(file.mimetype);
    const isDocument = ALLOWED_MIME_TYPES.DOCUMENTS.includes(file.mimetype);
    const isVideo = ALLOWED_MIME_TYPES.VIDEOS.includes(file.mimetype);

    if (!isImage && !isDocument && !isVideo) {
      errors.push(`File ${index + 1} (${file.originalname}): Invalid file type`);
    }

    // Vérifier taille
    let maxSize = SIZE_LIMITS.DOCUMENT;
    if (isImage) maxSize = SIZE_LIMITS.IMAGE;
    if (isVideo) maxSize = SIZE_LIMITS.VIDEO;

    if (file.size > maxSize) {
      errors.push(`File ${index + 1} (${file.originalname}): File too large`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors
    });
  }

  next();
};

/**
 * Validation images uniquement
 */
const validateImage = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No images provided'
    });
  }

  const errors = [];

  req.files.forEach((file, index) => {
    if (!ALLOWED_MIME_TYPES.IMAGES.includes(file.mimetype)) {
      errors.push(`File ${index + 1} (${file.originalname}): Not an image`);
    }

    if (file.size > SIZE_LIMITS.IMAGE) {
      errors.push(`File ${index + 1} (${file.originalname}): Image too large`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors
    });
  }

  next();
};

module.exports = {
  uploadMiddleware,
  validateFile,
  validateImage
};