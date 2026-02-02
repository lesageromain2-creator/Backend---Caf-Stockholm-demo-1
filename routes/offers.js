// backend/routes/offers.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auths');
const {
  getAllOffers,
  getOfferBySlug,
  createOffer,
  updateOffer,
  deleteOffer
} = require('../controllers/offersController');

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/', getAllOffers);
router.get('/:slug', getOfferBySlug);

// ============================================
// ADMIN ROUTES
// ============================================
router.post('/', authenticateToken, requireAdmin, createOffer);
router.put('/:id', authenticateToken, requireAdmin, updateOffer);
router.delete('/:id', authenticateToken, requireAdmin, deleteOffer);

module.exports = router;
