const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Dossiers organisés par type
const FOLDERS = {
  PROJECTS: 'webdev/projects',
  PORTFOLIO: 'webdev/portfolio',
  AVATARS: 'webdev/avatars',
  DOCUMENTS: 'webdev/documents',
  BLOG: 'webdev/blog',
  TEMP: 'webdev/temp'
};

// Transformations prédéfinies
const TRANSFORMATIONS = {
  THUMBNAIL: {
    width: 300,
    height: 300,
    crop: 'fill',
    quality: 'auto:good'
  },
  MEDIUM: {
    width: 800,
    height: 600,
    crop: 'limit',
    quality: 'auto:good'
  },
  PORTFOLIO: {
    width: 1200,
    height: 800,
    crop: 'limit',
    quality: 'auto:best'
  },
  AVATAR: {
    width: 200,
    height: 200,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good'
  }
};

// Limite de taille par type
const SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,      // 10MB
  DOCUMENT: 50 * 1024 * 1024,    // 50MB
  VIDEO: 100 * 1024 * 1024       // 100MB
};

// Types MIME autorisés
const ALLOWED_MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ],
  VIDEOS: ['video/mp4', 'video/webm', 'video/ogg']
};

module.exports = {
  cloudinary,
  FOLDERS,
  TRANSFORMATIONS,
  SIZE_LIMITS,
  ALLOWED_MIME_TYPES
};