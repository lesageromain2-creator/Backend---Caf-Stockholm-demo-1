/**
 * Routes API - Catégories E-commerce
 * GET /api/ecommerce/categories - Liste toutes catégories
 * GET /api/ecommerce/categories/:slug - Détail catégorie avec produits
 * POST /api/ecommerce/categories - Création (admin)
 * PATCH /api/ecommerce/categories/:id - Mise à jour (admin)
 * DELETE /api/ecommerce/categories/:id - Suppression (admin)
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { verifyToken, isAdmin } = require('../middleware/auths');
const { z } = require('zod');

// ============================================
// VALIDATION SCHEMAS
// ============================================
const categorySchema = z.object({
  parentId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(250),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

// ============================================
// GET /api/ecommerce/categories - Liste
// ============================================
router.get('/', async (req, res, next) => {
  try {
    const { active = 'true', tree = 'false' } = req.query;

    let query = `
      SELECT 
        c.*,
        parent.name as parent_name,
        COUNT(p.id) as products_count
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (active === 'true') {
      query += ` AND c.is_active = true`;
    }

    query += `
      GROUP BY c.id, parent.name
      ORDER BY c.display_order, c.name
    `;

    const result = await db.query(query, params);

    // Si mode tree, construire hiérarchie
    if (tree === 'true') {
      const categoriesMap = new Map();
      const rootCategories = [];

      // Créer map et initialiser children
      result.rows.forEach(cat => {
        categoriesMap.set(cat.id, { ...cat, children: [] });
      });

      // Construire hiérarchie
      result.rows.forEach(cat => {
        const category = categoriesMap.get(cat.id);
        if (cat.parent_id) {
          const parent = categoriesMap.get(cat.parent_id);
          if (parent) {
            parent.children.push(category);
          }
        } else {
          rootCategories.push(category);
        }
      });

      return res.json({
        success: true,
        categories: rootCategories,
      });
    }

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/ecommerce/categories/:slug - Détail
// ============================================
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const query = `
      SELECT 
        c.*,
        parent.name as parent_name,
        parent.slug as parent_slug,
        COUNT(p.id) as products_count
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
      WHERE c.slug = $1
      GROUP BY c.id, parent.name, parent.slug
    `;

    const result = await db.query(query, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
      });
    }

    const category = result.rows[0];

    // Récupérer sous-catégories
    const subCategoriesResult = await db.query(
      `SELECT 
        c.*,
        COUNT(p.id) as products_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
       WHERE c.parent_id = $1 AND c.is_active = true
       GROUP BY c.id
       ORDER BY c.display_order, c.name`,
      [category.id]
    );

    res.json({
      success: true,
      category: {
        ...category,
        subCategories: subCategoriesResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/ecommerce/categories - Création (admin)
// ============================================
router.post('/', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const validated = categorySchema.parse(req.body);

    // Vérifier unicité slug
    const existingSlug = await db.query(
      'SELECT id FROM categories WHERE slug = $1',
      [validated.slug]
    );

    if (existingSlug.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Slug déjà utilisé',
      });
    }

    const insertQuery = `
      INSERT INTO categories (
        parent_id, name, slug, description, image_url,
        display_order, is_active, meta_title, meta_description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      validated.parentId || null,
      validated.name,
      validated.slug,
      validated.description || null,
      validated.imageUrl || null,
      validated.displayOrder,
      validated.isActive,
      validated.metaTitle || null,
      validated.metaDescription || null,
    ];

    const result = await db.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: 'Catégorie créée avec succès',
      category: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// ============================================
// PATCH /api/ecommerce/categories/:id - Mise à jour (admin)
// ============================================
router.patch('/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = categorySchema.partial().parse(req.body);

    // Vérifier existence
    const existing = await db.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
      });
    }

    // Construire query dynamique
    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
      });
    }

    values.push(id);
    const updateQuery = `
      UPDATE categories 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Catégorie mise à jour avec succès',
      category: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// ============================================
// DELETE /api/ecommerce/categories/:id - Suppression (admin)
// ============================================
router.delete('/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier si la catégorie a des produits
    const productsCheck = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une catégorie contenant des produits',
      });
    }

    // Vérifier si la catégorie a des sous-catégories
    const subCategoriesCheck = await db.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
      [id]
    );

    if (parseInt(subCategoriesCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une catégorie ayant des sous-catégories',
      });
    }

    const result = await db.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
      });
    }

    res.json({
      success: true,
      message: 'Catégorie supprimée avec succès',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
