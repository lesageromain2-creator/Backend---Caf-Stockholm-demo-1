/**
 * Service de gestion des promotions
 * Promotions automatiques, codes promo, flash sales
 */

const { getPool } = require('../database/db');

// ============================================
// APPLY PROMOTIONS TO CART
// ============================================
/**
 * Appliquer les promotions automatiques à un panier
 * @param {Array} cartItems - Articles du panier
 * @returns {Promise<Object>} Promotions appliquées et réductions
 */
const applyPromotions = async (cartItems) => {
  const pool = getPool();
  const now = new Date();

  try {
    // Récupérer les promotions actives
    const promotionsResult = await pool.query(
      `SELECT * FROM promotions 
       WHERE is_active = true 
       AND (starts_at IS NULL OR starts_at <= $1)
       AND (ends_at IS NULL OR ends_at >= $1)
       ORDER BY priority DESC`,
      [now]
    );

    const promotions = promotionsResult.rows;
    let totalDiscount = 0;
    const appliedPromotions = [];

    for (const promo of promotions) {
      const discount = calculatePromoDiscount(promo, cartItems);
      
      if (discount > 0) {
        totalDiscount += discount;
        appliedPromotions.push({
          id: promo.id,
          name: promo.name,
          type: promo.type,
          discount: discount,
        });
      }
    }

    return {
      totalDiscount: totalDiscount.toFixed(2),
      appliedPromotions,
    };
  } catch (error) {
    console.error('Error applying promotions:', error);
    return {
      totalDiscount: 0,
      appliedPromotions: [],
    };
  }
};

// ============================================
// CALCULATE PROMO DISCOUNT
// ============================================
/**
 * Calculer la réduction d'une promotion
 * @param {Object} promo - Promotion à appliquer
 * @param {Array} cartItems - Articles du panier
 * @returns {number} Montant de la réduction
 */
const calculatePromoDiscount = (promo, cartItems) => {
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  switch (promo.type) {
    case 'category_discount': {
      // Réduction sur une catégorie spécifique
      const rules = promo.rules || {};
      const categoryId = rules.categoryId;
      
      if (!categoryId) return 0;

      const categoryTotal = cartItems
        .filter((item) => item.categoryId === categoryId)
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (promo.discount_type === 'percentage') {
        return categoryTotal * (parseFloat(promo.discount_value) / 100);
      } else if (promo.discount_type === 'fixed') {
        return Math.min(parseFloat(promo.discount_value), categoryTotal);
      }
      
      return 0;
    }

    case 'buy_x_get_y': {
      // Achetez X, obtenez Y gratuit
      const rules = promo.rules || {};
      const buyQuantity = rules.buyQuantity || 2;
      const getQuantity = rules.getQuantity || 1;
      const productId = rules.productId;

      if (!productId) return 0;

      const matchingItem = cartItems.find((item) => item.productId === productId);
      if (!matchingItem) return 0;

      const setsCount = Math.floor(matchingItem.quantity / buyQuantity);
      const freeItems = setsCount * getQuantity;

      return matchingItem.price * freeItems;
    }

    case 'flash_sale': {
      // Flash sale : réduction globale
      if (promo.discount_type === 'percentage') {
        return cartTotal * (parseFloat(promo.discount_value) / 100);
      } else if (promo.discount_type === 'fixed') {
        return Math.min(parseFloat(promo.discount_value), cartTotal);
      }
      
      return 0;
    }

    case 'min_purchase': {
      // Réduction si montant minimum atteint
      const rules = promo.rules || {};
      const minAmount = rules.minAmount || 0;

      if (cartTotal < minAmount) return 0;

      if (promo.discount_type === 'percentage') {
        return cartTotal * (parseFloat(promo.discount_value) / 100);
      } else if (promo.discount_type === 'fixed') {
        return parseFloat(promo.discount_value);
      }
      
      return 0;
    }

    default:
      return 0;
  }
};

// ============================================
// VALIDATE COUPON
// ============================================
/**
 * Valider un code promo
 * @param {string} code - Code promo
 * @param {string} userId - ID utilisateur (optionnel)
 * @param {number} cartTotal - Total du panier
 * @param {Array} cartItems - Articles du panier
 * @returns {Promise<Object>} Informations sur le coupon et réduction
 */
const validateCoupon = async (code, userId, cartTotal, cartItems = []) => {
  const pool = getPool();
  const now = new Date();

  try {
    // Récupérer le coupon
    const couponResult = await pool.query(
      `SELECT * FROM coupons 
       WHERE UPPER(code) = UPPER($1) AND is_active = true`,
      [code]
    );

    if (couponResult.rows.length === 0) {
      throw new Error('Code promo invalide');
    }

    const coupon = couponResult.rows[0];

    // Vérifier validité temporelle
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      throw new Error('Code promo pas encore actif');
    }

    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      throw new Error('Code promo expiré');
    }

    // Vérifier limite d'utilisation globale
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new Error('Code promo épuisé');
    }

    // Vérifier montant minimum
    if (coupon.min_purchase_amount && cartTotal < parseFloat(coupon.min_purchase_amount)) {
      throw new Error(
        `Montant minimum requis : ${coupon.min_purchase_amount}€`
      );
    }

    // Vérifier limite par utilisateur
    if (userId && coupon.usage_limit_per_user) {
      const userUsageResult = await pool.query(
        `SELECT COUNT(*) as count FROM coupon_usage 
         WHERE coupon_id = $1 AND user_id = $2`,
        [coupon.id, userId]
      );

      const userUsageCount = parseInt(userUsageResult.rows[0].count);
      if (userUsageCount >= coupon.usage_limit_per_user) {
        throw new Error('Limite atteinte pour ce code');
      }
    }

    // Calculer la réduction
    let discountAmount = 0;

    if (coupon.discount_type === 'percentage') {
      discountAmount = cartTotal * (parseFloat(coupon.discount_value) / 100);
      
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(coupon.max_discount_amount)
        );
      }
    } else if (coupon.discount_type === 'fixed_amount') {
      discountAmount = Math.min(parseFloat(coupon.discount_value), cartTotal);
    } else if (coupon.discount_type === 'free_shipping') {
      discountAmount = 0; // Géré ailleurs
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      },
      discountAmount: discountAmount.toFixed(2),
      freeShipping: coupon.discount_type === 'free_shipping',
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};

// ============================================
// RECORD COUPON USAGE
// ============================================
/**
 * Enregistrer l'utilisation d'un coupon
 * @param {string} couponId - ID du coupon
 * @param {string} userId - ID utilisateur (optionnel)
 * @param {string} orderId - ID de la commande
 * @param {number} discountAmount - Montant de la réduction
 */
const recordCouponUsage = async (couponId, userId, orderId, discountAmount) => {
  const pool = getPool();

  try {
    // Incrémenter le compteur d'utilisation
    await pool.query(
      'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1',
      [couponId]
    );

    // Enregistrer l'utilisation
    await pool.query(
      `INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount)
       VALUES ($1, $2, $3, $4)`,
      [couponId, userId || null, orderId, discountAmount]
    );

    return { success: true };
  } catch (error) {
    console.error('Error recording coupon usage:', error);
    throw error;
  }
};

// ============================================
// GET ACTIVE PROMOTIONS
// ============================================
/**
 * Récupérer toutes les promotions actives
 * @returns {Promise<Array>} Liste des promotions actives
 */
const getActivePromotions = async () => {
  const pool = getPool();
  const now = new Date();

  try {
    const result = await pool.query(
      `SELECT * FROM promotions 
       WHERE is_active = true 
       AND (starts_at IS NULL OR starts_at <= $1)
       AND (ends_at IS NULL OR ends_at >= $1)
       ORDER BY priority DESC, created_at DESC`,
      [now]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting active promotions:', error);
    return [];
  }
};

// ============================================
// CREATE PROMOTION
// ============================================
/**
 * Créer une nouvelle promotion
 * @param {Object} promotionData - Données de la promotion
 * @returns {Promise<Object>} Promotion créée
 */
const createPromotion = async (promotionData) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `INSERT INTO promotions (
        name, description, type, discount_type, discount_value,
        rules, priority, starts_at, ends_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        promotionData.name,
        promotionData.description || null,
        promotionData.type,
        promotionData.discountType || null,
        promotionData.discountValue || null,
        JSON.stringify(promotionData.rules || {}),
        promotionData.priority || 0,
        promotionData.startsAt || null,
        promotionData.endsAt || null,
        promotionData.isActive !== false,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating promotion:', error);
    throw error;
  }
};

// ============================================
// UPDATE PROMOTION
// ============================================
/**
 * Mettre à jour une promotion
 * @param {string} promotionId - ID de la promotion
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} Promotion mise à jour
 */
const updatePromotion = async (promotionId, updates) => {
  const pool = getPool();

  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        
        if (key === 'rules' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(promotionId);
    const query = `
      UPDATE promotions 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Promotion not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating promotion:', error);
    throw error;
  }
};

// ============================================
// DELETE PROMOTION
// ============================================
/**
 * Supprimer une promotion
 * @param {string} promotionId - ID de la promotion
 * @returns {Promise<boolean>} Succès
 */
const deletePromotion = async (promotionId) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      'DELETE FROM promotions WHERE id = $1 RETURNING id',
      [promotionId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting promotion:', error);
    throw error;
  }
};

module.exports = {
  applyPromotions,
  validateCoupon,
  recordCouponUsage,
  getActivePromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
