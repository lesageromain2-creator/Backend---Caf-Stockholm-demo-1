// backend/routes/newsletter.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auths');
const {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  sendNewsletter,
  getStats
} = require('../controllers/newsletterController');

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

// ============================================
// ADMIN ROUTES
// ============================================
router.get('/subscribers', authenticateToken, requireAdmin, getAllSubscribers);
router.post('/send', authenticateToken, requireAdmin, sendNewsletter);
router.get('/stats', authenticateToken, requireAdmin, getStats);

module.exports = router;
