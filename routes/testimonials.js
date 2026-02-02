// backend/routes/testimonials.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auths');
const {
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  approveTestimonial
} = require('../controllers/testimonialsController');

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/', getAllTestimonials);
router.get('/:id', getTestimonialById);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
router.post('/', authenticateToken, createTestimonial);

// ============================================
// ADMIN ROUTES
// ============================================
router.put('/:id', authenticateToken, requireAdmin, updateTestimonial);
router.delete('/:id', authenticateToken, requireAdmin, deleteTestimonial);
router.post('/:id/approve', authenticateToken, requireAdmin, approveTestimonial);

module.exports = router;
