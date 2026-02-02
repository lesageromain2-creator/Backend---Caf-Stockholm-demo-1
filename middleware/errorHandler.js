// backend/middleware/errorHandler.js
// Global error handler middleware

const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erreur serveur interne';

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token invalide';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expiré';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Données invalides';
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    statusCode = 409;
    message = 'Cette ressource existe déjà';
  }

  if (err.code === '23503') { // Foreign key violation
    statusCode = 400;
    message = 'Référence invalide';
  }

  if (err.code === '23502') { // Not null violation
    statusCode = 400;
    message = 'Champ requis manquant';
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Fichier trop volumineux';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Trop de fichiers';
    } else {
      message = 'Erreur lors de l\'upload';
    }
  }

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    statusCode = 402;
    message = 'Erreur de paiement: ' + err.message;
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
