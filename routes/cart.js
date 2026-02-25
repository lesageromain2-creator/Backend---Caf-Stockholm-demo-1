/**
 * Routes API - Panier E-commerce
 * GET /api/cart - Récupérer le panier
 * POST /api/cart/items - Ajouter un produit
 * PATCH /api/cart/items/:id - Modifier quantité
 * DELETE /api/cart/items/:id - Retirer un produit
 * DELETE /api/cart - Vider le panier
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requireAdmin } = require('../middleware/auths');
const { z } = require('zod');
const crypto = require('crypto');

// ============================================
// VALIDATION SCHEMAS
// ============================================
const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

// ============================================
// HELPER: Obtenir ou créer un panier
// ============================================
async function getOrCreateCart(userId, sessionId) {
  let cart;

  if (userId) {
    // Chercher panier utilisateur
    const userCartResult = await db.query(
      'SELECT * FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    cart = userCartResult.rows[0];
  } else if (sessionId) {
    // Chercher panier session
    const sessionCartResult = await db.query(
      'SELECT * FROM carts WHERE session_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    );
    cart = sessionCartResult.rows[0];
  }

  // Créer nouveau panier si nécessaire
  if (!cart) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 jours

    const insertResult = await db.query(
      `INSERT INTO carts (user_id, session_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId || null, sessionId || null, expiresAt]
    );
    cart = insertResult.rows[0];
  }

  return cart;
}

// ============================================
// HELPER: Calculer totaux du panier
// ============================================
async function calculateCartTotals(cartId) {
  const itemsResult = await db.query(
    `SELECT 
      ci.*,
      p.name as product_name,
      p.images,
      p.slug,
      p.stock_quantity,
      pv.name as variant_name,
      pv.stock_quantity as variant_stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     LEFT JOIN product_variants pv ON ci.variant_id = pv.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  const items = itemsResult.rows;
  const subtotal = items.reduce((sum, item) => {
    return sum + parseFloat(item.price_snapshot) * item.quantity;
  }, 0);

  return {
    items,
    itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: subtotal.toFixed(2),
  };
}

// ============================================
// GET /api/cart/admin/active-carts - Paniers en cours (admin, temps réel)
// ============================================
router.get('/admin/active-carts', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        c.id,
        c.user_id,
        c.session_id,
        c.created_at,
        c.updated_at,
        u.email as user_email,
        u.name as user_name,
        COUNT(ci.id)::int as items_count,
        COALESCE(SUM(ci.price_snapshot * ci.quantity), 0)::numeric(10,2) as subtotal
       FROM carts c
       LEFT JOIN users u ON c.user_id = u.id
       INNER JOIN cart_items ci ON ci.cart_id = c.id
       WHERE c.expires_at IS NULL OR c.expires_at > NOW()
       GROUP BY c.id, c.user_id, c.session_id, c.created_at, c.updated_at, u.email, u.name
       HAVING COUNT(ci.id) > 0
       ORDER BY c.updated_at DESC
       LIMIT 50`
    );
    res.json({
      success: true,
      carts: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/cart - Récupérer le panier
// ============================================
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let sessionId = req.headers['x-session-id'];

    // Générer sessionId si nécessaire
    if (!userId && !sessionId) {
      sessionId = crypto.randomUUID();
    }

    const cart = await getOrCreateCart(userId, sessionId);
    const cartData = await calculateCartTotals(cart.id);

    res.json({
      success: true,
      cart: {
        id: cart.id,
        sessionId: cart.session_id || sessionId,
        ...cartData,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/cart/items - Ajouter au panier
// ============================================
router.post('/items', async (req, res, next) => {
  try {
    const validated = addToCartSchema.parse(req.body);
    const userId = req.user?.id;
    let sessionId = req.headers['x-session-id'];

    if (!userId && !sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Vérifier disponibilité produit
    const productQuery = validated.variantId
      ? `SELECT 
          p.id, p.name, p.price, p.status, p.stock_quantity,
          pv.stock_quantity as variant_stock, pv.price_adjustment
         FROM products p
         JOIN product_variants pv ON pv.product_id = p.id
         WHERE p.id = $1 AND pv.id = $2 AND p.status = 'active'`
      : `SELECT id, name, price, status, stock_quantity
         FROM products 
         WHERE id = $1 AND status = 'active'`;

    const productParams = validated.variantId
      ? [validated.productId, validated.variantId]
      : [validated.productId];

    const productResult = await db.query(productQuery, productParams);

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non disponible',
      });
    }

    const product = productResult.rows[0];
    const availableStock = validated.variantId
      ? product.variant_stock
      : product.stock_quantity;

    if (availableStock < validated.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock insuffisant',
        availableStock,
      });
    }

    // Prix final
    const finalPrice = validated.variantId
      ? parseFloat(product.price) + parseFloat(product.price_adjustment || 0)
      : parseFloat(product.price);

    // Obtenir ou créer panier
    const cart = await getOrCreateCart(userId, sessionId);

    // Vérifier si produit déjà dans panier
    const existingItemResult = await db.query(
      `SELECT * FROM cart_items 
       WHERE cart_id = $1 AND product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))`,
      [cart.id, validated.productId, validated.variantId || null]
    );

    if (existingItemResult.rows.length > 0) {
      // Mettre à jour quantité
      const existingItem = existingItemResult.rows[0];
      const newQuantity = existingItem.quantity + validated.quantity;

      if (availableStock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Stock insuffisant pour cette quantité',
          availableStock,
        });
      }

      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQuantity, existingItem.id]
      );
    } else {
      // Ajouter nouvel item
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [cart.id, validated.productId, validated.variantId || null, validated.quantity, finalPrice]
      );
    }

    // Mettre à jour timestamp panier
    await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);

    // Récupérer panier mis à jour
    const cartData = await calculateCartTotals(cart.id);

    res.json({
      success: true,
      message: 'Produit ajouté au panier',
      cart: {
        id: cart.id,
        sessionId: cart.session_id || sessionId,
        ...cartData,
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
// PATCH /api/cart/items/:id - Modifier quantité
// ============================================
router.patch('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = updateQuantitySchema.parse(req.body);
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    // Vérifier que l'item appartient au panier de l'utilisateur
    const itemQuery = `
      SELECT ci.*, c.user_id, c.session_id, p.stock_quantity,
             pv.stock_quantity as variant_stock
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_variants pv ON ci.variant_id = pv.id
      WHERE ci.id = $1
    `;

    const itemResult = await db.query(itemQuery, [id]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé dans le panier',
      });
    }

    const item = itemResult.rows[0];

    // Vérifier autorisation
    if (
      (userId && item.user_id !== userId) ||
      (!userId && item.session_id !== sessionId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Si quantité = 0, supprimer l'item
    if (validated.quantity === 0) {
      await db.query('DELETE FROM cart_items WHERE id = $1', [id]);
    } else {
      // Vérifier stock
      const availableStock = item.variant_id ? item.variant_stock : item.stock_quantity;

      if (availableStock < validated.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Stock insuffisant',
          availableStock,
        });
      }

      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [validated.quantity, id]
      );
    }

    // Récupérer panier mis à jour
    const cartData = await calculateCartTotals(item.cart_id);

    res.json({
      success: true,
      message: validated.quantity === 0 ? 'Article retiré du panier' : 'Quantité mise à jour',
      cart: {
        id: item.cart_id,
        ...cartData,
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
// DELETE /api/cart/items/:id - Retirer du panier
// ============================================
router.delete('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    // Vérifier autorisation
    const itemQuery = `
      SELECT ci.cart_id, c.user_id, c.session_id
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      WHERE ci.id = $1
    `;

    const itemResult = await db.query(itemQuery, [id]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé',
      });
    }

    const item = itemResult.rows[0];

    if (
      (userId && item.user_id !== userId) ||
      (!userId && item.session_id !== sessionId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    await db.query('DELETE FROM cart_items WHERE id = $1', [id]);

    // Récupérer panier mis à jour
    const cartData = await calculateCartTotals(item.cart_id);

    res.json({
      success: true,
      message: 'Article retiré du panier',
      cart: {
        id: item.cart_id,
        ...cartData,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /api/cart - Vider le panier
// ============================================
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session invalide',
      });
    }

    const cart = await getOrCreateCart(userId, sessionId);

    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    res.json({
      success: true,
      message: 'Panier vidé',
      cart: {
        id: cart.id,
        items: [],
        itemsCount: 0,
        subtotal: '0.00',
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
