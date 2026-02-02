// backend/middleware/security.js
// Security middleware

const helmet = require('helmet');

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
const configureCORS = (app) => {
  const cors = require('cors');
  
  const whitelist = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (whitelist.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  };
  
  app.use(cors(corsOptions));
  
  // Handle preflight requests
  app.options('*', cors(corsOptions));
};

// IP tracking middleware
const trackIP = (req, res, next) => {
  // Get real IP (handles proxies/load balancers)
  req.clientIP = 
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress;
  
  next();
};

// Prevent brute force attacks
const loginRateLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Trop de tentatives de connexion',
    message: 'Veuillez réessayer dans 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

// API rate limiter (general)
const apiRateLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Trop de requêtes',
    message: 'Veuillez réessayer plus tard'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

// Admin route rate limiter
const adminRateLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: 'Limite de requêtes atteinte',
    message: 'Trop de requêtes administrateur'
  }
});

module.exports = {
  securityHeaders,
  configureCORS,
  trackIP,
  loginRateLimiter,
  apiRateLimiter,
  adminRateLimiter
};
