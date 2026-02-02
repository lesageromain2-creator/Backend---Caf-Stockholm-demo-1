// backend/routes/admin/testimonials.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// GET ALL TESTIMONIALS (Admin - includes pending)
// ============================================
router.get('/', async (req, res) => {
  const pool = getPool();
  try {
    const { is_approved, is_featured } = req.query;
    
    let query = `
      SELECT 
        t.*,
        pp.title as project_title,
        u.firstname || ' ' || u.lastname as user_name
      FROM testimonials t
      LEFT JOIN portfolio_projects pp ON t.portfolio_project_id = pp.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (is_approved !== undefined) {
      query += ` AND t.is_approved = $${paramIndex}`;
      params.push(is_approved === 'true');
      paramIndex++;
    }
    
    if (is_featured !== undefined) {
      query += ` AND t.is_featured = $${paramIndex}`;
      params.push(is_featured === 'true');
      paramIndex++;
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin testimonials:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des témoignages' });
  }
});

// ============================================
// GET TESTIMONIAL STATS (Admin)
// ============================================
router.get('/stats', async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_approved = true) as approved,
        COUNT(*) FILTER (WHERE is_approved = false) as pending,
        COUNT(*) FILTER (WHERE is_featured = true) as featured,
        AVG(rating) as average_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_stars
      FROM testimonials
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching testimonial stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;
