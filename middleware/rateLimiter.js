const rateLimit = require('express-rate-limit');

/**
 * Rate limiter pour uploads
 * 20 uploads maximum par 15 minutes
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads max
  message: {
    success: false,
    message: 'Too many upload requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Rate limiter strict pour uploads (admin)
 * 50 uploads maximum par 15 minutes
 */
const adminUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many upload requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour downloads
 * 100 downloads maximum par 15 minutes
 */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many download requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour suppression de fichiers
 * 30 suppressions maximum par 15 minutes
 */
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many delete requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  uploadLimiter,
  adminUploadLimiter,
  downloadLimiter,
  deleteLimiter
};