/**
 * Routes API - Codes Promo / Coupons
 * POST /api/coupons/validate - Valider un code promo
 * GET /api/admin/coupons - Liste tous les coupons (admin)
 * POST /api/admin/coupons - Créer un coupon (admin)
 * PATCH /api/admin/coupons/:id - Modifier un coupon (admin)
 * DELETE /api/admin/coupons/:id - Supprimer un coupon (admin)
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { verifyToken, isAdmin } = require('../middleware/auths');
const { z } = require('zod');

// ============================================
// VALIDATION SCHEMAS
// ============================================
const validateCouponSchema = z.object({
  code: z.string().min(1),
  cartTotal: z.number().positive(),
  userId: z.string().uuid().optional(),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(50).transform(val => val.toUpperCase()),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  discountValue: z.number().positive(),
  minPurchaseAmount: z.number().positive().optional(),
  maxDiscountAmount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  usageLimitPerUser: z.number().int().positive().default(1),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  applicableTo: z.enum(['all', 'categories', 'products']).default('all'),
  applicableIds: z.array(z.string().uuid()).default([]),
  excludedIds: z.array(z.string().uuid()).default([]),
  isActive: z.boolean().default(true),
});

// ============================================
// POST /api/coupons/validate - Valider code promo
// ============================================
router.post('/validate', async (req, res, next) => {
  try {
    const validated = validateCouponSchema.parse(req.body);

    // Chercher le coupon
    const couponResult = await db.query(
      `SELECT * FROM coupons 
       WHERE UPPER(code) = $1 AND is_active = true`,
      [validated.code.toUpperCase()]
    );

    if (couponResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code promo invalide',
      });
    }

    const coupon = couponResult.rows[0];

    // Vérifier validité temporelle
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({
        success: false,
        message: 'Ce code n\'est pas encore actif',
        availableFrom: coupon.valid_from,
      });
    }

    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      return res.status(400).json({
        success: false,
        message: 'Ce code a expiré',
        expiredAt: coupon.valid_to,
      });
    }

    // Vérifier limite d'utilisation globale
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        message: 'Ce code a atteint sa limite d\'utilisation',
      });
    }

    // Vérifier limite par utilisateur
    if (validated.userId && coupon.usage_limit_per_user) {
      const userUsageResult = await db.query(
        `SELECT COUNT(*) as count FROM coupon_usage 
         WHERE coupon_id = $1 AND user_id = $2`,
        [coupon.id, validated.userId]
      );

      const userUsageCount = parseInt(userUsageResult.rows[0].count);
      if (userUsageCount >= coupon.usage_limit_per_user) {
        return res.status(400).json({
          success: false,
          message: 'Vous avez déjà utilisé ce code le nombre maximum de fois',
        });
      }
    }

    // Vérifier montant minimum
    if (coupon.min_purchase_amount && validated.cartTotal < parseFloat(coupon.min_purchase_amount)) {
      return res.status(400).json({
        success: false,
        message: `Montant minimum requis : ${coupon.min_purchase_amount}€`,
        minAmount: parseFloat(coupon.min_purchase_amount),
      });
    }

    // Calculer la réduction
    let discountAmount = 0;

    if (coupon.discount_type === 'percentage') {
      discountAmount = validated.cartTotal * (parseFloat(coupon.discount_value) / 100);
      
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
      }
    } else if (coupon.discount_type === 'fixed_amount') {
      discountAmount = Math.min(parseFloat(coupon.discount_value), validated.cartTotal);
    }

    res.json({
      success: true,
      message: 'Code promo valide',
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountAmount: discountAmount.toFixed(2),
      },
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
// GET /api/admin/coupons - Liste coupons (admin)
// ============================================
router.get('/admin', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const { active = '', search = '', page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        c.*,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM coupons c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (active === 'true') {
      query += ` AND c.is_active = true`;
    } else if (active === 'false') {
      query += ` AND c.is_active = false`;
    }

    if (search) {
      query += ` AND (c.code ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) as total FROM coupons WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (active === 'true') {
      countQuery += ' AND is_active = true';
    } else if (active === 'false') {
      countQuery += ' AND is_active = false';
    }

    if (search) {
      countQuery += ` AND (code ILIKE $${countIndex} OR description ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      coupons: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/admin/coupons - Créer coupon (admin)
// ============================================
router.post('/admin', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const validated = createCouponSchema.parse(req.body);
    const adminId = req.user.id;

    // Vérifier unicité du code
    const existingCode = await db.query(
      'SELECT id FROM coupons WHERE code = $1',
      [validated.code]
    );

    if (existingCode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce code existe déjà',
      });
    }

    const insertQuery = `
      INSERT INTO coupons (
        code, description, discount_type, discount_value,
        min_purchase_amount, max_discount_amount,
        usage_limit, usage_limit_per_user,
        valid_from, valid_to,
        applicable_to, applicable_ids, excluded_ids,
        is_active, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *
    `;

    const values = [
      validated.code,
      validated.description || null,
      validated.discountType,
      validated.discountValue,
      validated.minPurchaseAmount || null,
      validated.maxDiscountAmount || null,
      validated.usageLimit || null,
      validated.usageLimitPerUser,
      validated.validFrom || null,
      validated.validTo || null,
      validated.applicableTo,
      validated.applicableIds,
      validated.excludedIds,
      validated.isActive,
      adminId,
    ];

    const result = await db.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: 'Code promo créé avec succès',
      coupon: result.rows[0],
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
// PATCH /api/admin/coupons/:id - Modifier coupon (admin)
// ============================================
router.patch('/admin/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = createCouponSchema.partial().parse(req.body);

    // Vérifier existence
    const existing = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé',
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
      UPDATE coupons 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Code promo mis à jour avec succès',
      coupon: result.rows[0],
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
// DELETE /api/admin/coupons/:id - Supprimer coupon (admin)
// ============================================
router.delete('/admin/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier si le coupon a été utilisé
    const usageCheck = await db.query(
      'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un code qui a déjà été utilisé. Désactivez-le plutôt.',
      });
    }

    const result = await db.query(
      'DELETE FROM coupons WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Code promo supprimé avec succès',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
