// backend/controllers/blogController.js
const { getPool } = require('../database/db');

// ============================================
// GET ALL BLOG POSTS (Public - published only)
// ============================================
const getAllBlogPosts = async (req, res) => {
  const pool = getPool();
  try {
    const { category, tag, featured, limit = 10, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        bp.*,
        u.firstname || ' ' || u.lastname as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.status = 'published'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND bp.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (tag) {
      query += ` AND $${paramIndex} = ANY(bp.tags)`;
      params.push(tag);
      paramIndex++;
    }
    
    if (featured === 'true') {
      query += ` AND bp.is_featured = true`;
    }
    
    query += ` ORDER BY bp.published_at DESC NULLS LAST, bp.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM blog_posts 
      WHERE status = 'published'
      ${category ? `AND category = '${category}'` : ''}
      ${tag ? `AND '${tag}' = ANY(tags)` : ''}
      ${featured === 'true' ? `AND is_featured = true` : ''}
    `;
    const countResult = await pool.query(countQuery);
    
    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des articles' });
  }
};

// ============================================
// GET BLOG POST BY SLUG (Public)
// ============================================
const getBlogPostBySlug = async (req, res) => {
  const pool = getPool();
  try {
    const { slug } = req.params;
    
    const result = await pool.query(
      `SELECT 
        bp.*,
        u.firstname || ' ' || u.lastname as author_name,
        u.avatar_url as author_avatar,
        u.company_name as author_company
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.slug = $1 AND bp.status = 'published'`,
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    // Increment views count
    await pool.query(
      'UPDATE blog_posts SET views_count = views_count + 1 WHERE slug = $1',
      [slug]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'article' });
  }
};

// ============================================
// CREATE BLOG POST (Admin only)
// ============================================
const createBlogPost = async (req, res) => {
  const pool = getPool();
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category,
      tags,
      status = 'draft',
      is_featured = false
    } = req.body;
    
    const author_id = req.user.id;
    
    // Generate slug if not provided
    const finalSlug = slug || title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const result = await pool.query(
      `INSERT INTO blog_posts (
        author_id, title, slug, excerpt, content, featured_image_url,
        category, tags, status, is_featured, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        author_id,
        title,
        finalSlug,
        excerpt,
        content,
        featured_image_url,
        category,
        tags || [],
        status,
        is_featured,
        status === 'published' ? new Date() : null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating blog post:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de l\'article' });
  }
};

// ============================================
// UPDATE BLOG POST (Admin only)
// ============================================
const updateBlogPost = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      category,
      tags,
      status,
      is_featured
    } = req.body;
    
    // Check if post exists
    const existingPost = await pool.query(
      'SELECT * FROM blog_posts WHERE id = $1',
      [id]
    );
    
    if (existingPost.rows.length === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    const wasPublished = existingPost.rows[0].status === 'published';
    const nowPublished = status === 'published';
    
    const result = await pool.query(
      `UPDATE blog_posts SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        excerpt = COALESCE($3, excerpt),
        content = COALESCE($4, content),
        featured_image_url = COALESCE($5, featured_image_url),
        category = COALESCE($6, category),
        tags = COALESCE($7, tags),
        status = COALESCE($8, status),
        is_featured = COALESCE($9, is_featured),
        published_at = CASE 
          WHEN $8 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
          ELSE published_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [title, slug, excerpt, content, featured_image_url, category, tags, status, is_featured, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating blog post:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'article' });
  }
};

// ============================================
// DELETE BLOG POST (Admin only)
// ============================================
const deleteBlogPost = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM blog_posts WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    res.json({ message: 'Article supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'article' });
  }
};

// ============================================
// GET ALL CATEGORIES (Public)
// ============================================
const getCategories = async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT 
        category, 
        COUNT(*) as count 
      FROM blog_posts 
      WHERE status = 'published' AND category IS NOT NULL
      GROUP BY category 
      ORDER BY count DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
};

// ============================================
// GET ALL TAGS (Public)
// ============================================
const getTags = async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT 
        UNNEST(tags) as tag,
        COUNT(*) as count
      FROM blog_posts
      WHERE status = 'published' AND tags IS NOT NULL
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 50`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tags' });
  }
};

module.exports = {
  getAllBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getCategories,
  getTags
};
