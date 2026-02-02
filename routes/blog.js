// backend/routes/blog.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auths');
const {
  getAllBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getCategories,
  getTags
} = require('../controllers/blogController');

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/', getAllBlogPosts);
router.get('/categories', getCategories);
router.get('/tags', getTags);
router.get('/:slug', getBlogPostBySlug);

// ============================================
// ADMIN ROUTES
// ============================================
router.post('/', authenticateToken, requireAdmin, createBlogPost);
router.put('/:id', authenticateToken, requireAdmin, updateBlogPost);
router.delete('/:id', authenticateToken, requireAdmin, deleteBlogPost);

module.exports = router;
