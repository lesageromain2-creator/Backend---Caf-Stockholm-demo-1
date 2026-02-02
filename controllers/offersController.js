// backend/controllers/offersController.js
const { getPool } = require('../database/db');

// ============================================
// GET ALL OFFERS (Public - active only)
// ============================================
const getAllOffers = async (req, res) => {
  const pool = getPool();
  try {
    const { category, active_only = 'true' } = req.query;
    
    let query = `
      SELECT * FROM offers
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (active_only === 'true') {
      query += ` AND is_active = true`;
    }
    
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ` ORDER BY display_order ASC, created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des offres' });
  }
};

// ============================================
// GET OFFER BY SLUG (Public)
// ============================================
const getOfferBySlug = async (req, res) => {
  const pool = getPool();
  try {
    const { slug } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM offers WHERE slug = $1 AND is_active = true',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offre non trouvée' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'offre' });
  }
};

// ============================================
// CREATE OFFER (Admin only)
// ============================================
const createOffer = async (req, res) => {
  const pool = getPool();
  try {
    const {
      name,
      slug,
      description,
      features,
      price_starting_at,
      currency = 'EUR',
      duration_weeks,
      category,
      is_active = true,
      display_order = 0,
      icon_name,
      color_theme
    } = req.body;
    
    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const result = await pool.query(
      `INSERT INTO offers (
        name, slug, description, features, price_starting_at, currency,
        duration_weeks, category, is_active, display_order, icon_name, color_theme
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        name,
        finalSlug,
        description,
        JSON.stringify(features),
        price_starting_at,
        currency,
        duration_weeks,
        category,
        is_active,
        display_order,
        icon_name,
        color_theme
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating offer:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de l\'offre' });
  }
};

// ============================================
// UPDATE OFFER (Admin only)
// ============================================
const updateOffer = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      features,
      price_starting_at,
      currency,
      duration_weeks,
      category,
      is_active,
      display_order,
      icon_name,
      color_theme
    } = req.body;
    
    const result = await pool.query(
      `UPDATE offers SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        features = COALESCE($4, features),
        price_starting_at = COALESCE($5, price_starting_at),
        currency = COALESCE($6, currency),
        duration_weeks = COALESCE($7, duration_weeks),
        category = COALESCE($8, category),
        is_active = COALESCE($9, is_active),
        display_order = COALESCE($10, display_order),
        icon_name = COALESCE($11, icon_name),
        color_theme = COALESCE($12, color_theme),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *`,
      [
        name,
        slug,
        description,
        features ? JSON.stringify(features) : null,
        price_starting_at,
        currency,
        duration_weeks,
        category,
        is_active,
        display_order,
        icon_name,
        color_theme,
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offre non trouvée' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating offer:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'offre' });
  }
};

// ============================================
// DELETE OFFER (Admin only)
// ============================================
const deleteOffer = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM offers WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offre non trouvée' });
    }
    
    res.json({ message: 'Offre supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'offre' });
  }
};

module.exports = {
  getAllOffers,
  getOfferBySlug,
  createOffer,
  updateOffer,
  deleteOffer
};
