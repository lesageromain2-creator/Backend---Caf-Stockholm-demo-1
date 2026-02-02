// backend/routes/admin/newsletter.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// GET ALL SUBSCRIBERS (Admin)
// ============================================
router.get('/subscribers', async (req, res) => {
  const pool = getPool();
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM newsletter_subscribers WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (email ILIKE $${paramIndex} OR firstname ILIKE $${paramIndex} OR lastname ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY subscribed_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    const countQuery = `SELECT COUNT(*) FROM newsletter_subscribers WHERE 1=1
      ${status ? `AND status = '${status}'` : ''}
      ${search ? `AND (email ILIKE '%${search}%' OR firstname ILIKE '%${search}%' OR lastname ILIKE '%${search}%')` : ''}`;
    const countResult = await pool.query(countQuery);
    
    res.json({
      subscribers: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des abonnés' });
  }
});

// ============================================
// EXPORT SUBSCRIBERS (Admin)
// ============================================
router.get('/export', async (req, res) => {
  const pool = getPool();
  try {
    const { status = 'active' } = req.query;
    
    const result = await pool.query(
      'SELECT email, firstname, lastname, subscribed_at FROM newsletter_subscribers WHERE status = $1 ORDER BY subscribed_at DESC',
      [status]
    );
    
    // Generate CSV
    const csv = [
      'Email,Prénom,Nom,Date inscription',
      ...result.rows.map(row => 
        `${row.email},${row.firstname || ''},${row.lastname || ''},${row.subscribed_at || ''}`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=newsletter-subscribers-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export des abonnés' });
  }
});

module.exports = router;
