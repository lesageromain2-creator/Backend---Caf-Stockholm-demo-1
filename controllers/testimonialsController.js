// backend/controllers/testimonialsController.js
const { getPool } = require('../database/db');

// ============================================
// GET ALL TESTIMONIALS (Public - approved only)
// ============================================
const getAllTestimonials = async (req, res) => {
  const pool = getPool();
  try {
    const { featured, limit = 10, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        t.*,
        pp.title as project_title,
        pp.slug as project_slug
      FROM testimonials t
      LEFT JOIN portfolio_projects pp ON t.portfolio_project_id = pp.id
      WHERE t.is_approved = true
    `;
    
    if (featured === 'true') {
      query += ` AND t.is_featured = true`;
    }
    
    query += ` ORDER BY t.display_order ASC, t.created_at DESC`;
    query += ` LIMIT $1 OFFSET $2`;
    
    const result = await pool.query(query, [parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM testimonials 
      WHERE is_approved = true
      ${featured === 'true' ? 'AND is_featured = true' : ''}
    `;
    const countResult = await pool.query(countQuery);
    
    res.json({
      testimonials: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des témoignages' });
  }
};

// ============================================
// GET TESTIMONIAL BY ID (Public - approved only)
// ============================================
const getTestimonialById = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        t.*,
        pp.title as project_title,
        pp.slug as project_slug,
        u.firstname || ' ' || u.lastname as user_name
      FROM testimonials t
      LEFT JOIN portfolio_projects pp ON t.portfolio_project_id = pp.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = $1 AND t.is_approved = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching testimonial:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du témoignage' });
  }
};

// ============================================
// CREATE TESTIMONIAL (Authenticated users)
// ============================================
const createTestimonial = async (req, res) => {
  const pool = getPool();
  try {
    const {
      portfolio_project_id,
      author_name,
      author_company,
      author_position,
      author_avatar_url,
      content,
      rating
    } = req.body;
    
    const user_id = req.user ? req.user.id : null;
    
    const result = await pool.query(
      `INSERT INTO testimonials (
        user_id, portfolio_project_id, author_name, author_company,
        author_position, author_avatar_url, content, rating, is_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        user_id,
        portfolio_project_id || null,
        author_name,
        author_company,
        author_position,
        author_avatar_url,
        content,
        rating,
        false // Requires admin approval
      ]
    );
    
    res.status(201).json({
      ...result.rows[0],
      message: 'Témoignage créé avec succès. En attente de modération.'
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ error: 'Erreur lors de la création du témoignage' });
  }
};

// ============================================
// UPDATE TESTIMONIAL (Admin only)
// ============================================
const updateTestimonial = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const {
      portfolio_project_id,
      author_name,
      author_company,
      author_position,
      author_avatar_url,
      content,
      rating,
      is_featured,
      is_approved,
      display_order
    } = req.body;
    
    const result = await pool.query(
      `UPDATE testimonials SET
        portfolio_project_id = COALESCE($1, portfolio_project_id),
        author_name = COALESCE($2, author_name),
        author_company = COALESCE($3, author_company),
        author_position = COALESCE($4, author_position),
        author_avatar_url = COALESCE($5, author_avatar_url),
        content = COALESCE($6, content),
        rating = COALESCE($7, rating),
        is_featured = COALESCE($8, is_featured),
        is_approved = COALESCE($9, is_approved),
        display_order = COALESCE($10, display_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *`,
      [
        portfolio_project_id,
        author_name,
        author_company,
        author_position,
        author_avatar_url,
        content,
        rating,
        is_featured,
        is_approved,
        display_order,
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du témoignage' });
  }
};

// ============================================
// DELETE TESTIMONIAL (Admin only)
// ============================================
const deleteTestimonial = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM testimonials WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }
    
    res.json({ message: 'Témoignage supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du témoignage' });
  }
};

// ============================================
// APPROVE TESTIMONIAL (Admin only)
// ============================================
const approveTestimonial = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE testimonials 
      SET is_approved = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving testimonial:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation du témoignage' });
  }
};

module.exports = {
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  approveTestimonial
};
