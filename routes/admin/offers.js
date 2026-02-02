// backend/routes/admin/offers.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// GET ALL OFFERS (Admin - includes inactive)
// ============================================
router.get('/', async (req, res) => {
  const pool = getPool();
  try {
    const { category, is_active } = req.query;
    
    let query = 'SELECT * FROM offers WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }
    
    query += ' ORDER BY display_order ASC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin offers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des offres' });
  }
});

// ============================================
// GET OFFER STATS (Admin)
// ============================================
router.get('/stats', async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE category = 'vitrine') as vitrine,
        COUNT(*) FILTER (WHERE category = 'ecommerce') as ecommerce,
        COUNT(*) FILTER (WHERE category = 'webapp') as webapp,
        COUNT(*) FILTER (WHERE category = 'maintenance') as maintenance
      FROM offers
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching offer stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;
