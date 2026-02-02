// backend/routes/admin/blog.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// GET ALL BLOG POSTS (Admin - includes drafts)
// ============================================
router.get('/', async (req, res) => {
  const pool = getPool();
  try {
    const { status, category, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        bp.*,
        u.firstname || ' ' || u.lastname as author_name
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND bp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (category) {
      query += ` AND bp.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ` ORDER BY bp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    const countQuery = `SELECT COUNT(*) FROM blog_posts WHERE 1=1
      ${status ? `AND status = '${status}'` : ''}
      ${category ? `AND category = '${category}'` : ''}`;
    const countResult = await pool.query(countQuery);
    
    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching admin blog posts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des articles' });
  }
});

// ============================================
// GET BLOG STATS (Admin)
// ============================================
router.get('/stats', async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'archived') as archived,
        COUNT(*) FILTER (WHERE is_featured = true) as featured,
        SUM(views_count) as total_views
      FROM blog_posts
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;
