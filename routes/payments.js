// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auths');
const { validateBody, validateQuery, validateParams, validateUUID } = require('../middleware/zodValidation');
const stripeService = require('../services/stripeService');
const {
  createPaymentIntentSchema,
  createCheckoutSessionSchema,
  createCustomerSchema,
  createInvoiceSchema,
  refundPaymentSchema,
  getPaymentsSchema
} = require('../schemas/stripeSchemas');

/**
 * ROUTES DE PAIEMENT STRIPE
 * SÉCURITÉ CRITIQUE:
 * - Toutes les routes nécessitent une authentification
 * - Les clés secrètes ne sont JAMAIS exposées au client
 * - Toutes les données sont validées avec Zod
 * - Les webhooks vérifient les signatures
 */

// ============================================
// ROUTES PUBLIQUES (authentifiées)
// ============================================

/**
 * POST /payments/intent
 * Créer un Payment Intent Stripe
 * Authentification requise
 */
router.post(
  '/intent',
  requireAuth,
  validateBody(createPaymentIntentSchema),
  async (req, res) => {
    try {
      const userId = req.userId;
      const { amount, currency, paymentType, projectId, description, metadata } = req.body;

      // Sécurité: Ajouter l'userId dans les metadata
      const secureMetadata = {
        ...metadata,
        userId,
        createdBy: req.userEmail
      };

      // Créer le Payment Intent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: secureMetadata,
        description: description || `Paiement ${paymentType} - ${projectId || 'Custom'}`
      });

      // Log dans la base de données
      const pool = req.app.locals.pool;
      await pool.query(
        `INSERT INTO payment_logs (user_id, payment_intent_id, amount, currency, payment_type, project_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, paymentIntent.paymentIntentId, amount, currency, paymentType, projectId, 'pending']
      );

      res.json({
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });
    } catch (error) {
      console.error('❌ Erreur création Payment Intent:', error);
      res.status(500).json({
        error: 'Erreur lors de la création du paiement',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /payments/checkout-session
 * Créer une Checkout Session Stripe
 * Authentification requise
 */
router.post(
  '/checkout-session',
  requireAuth,
  validateBody(createCheckoutSessionSchema),
  async (req, res) => {
    try {
      const userId = req.userId;
      const {
        projectId,
        offerId,
        amount,
        currency,
        paymentType,
        successUrl,
        cancelUrl,
        customerEmail,
        metadata
      } = req.body;

      // Sécurité: Ajouter l'userId dans les metadata
      const secureMetadata = {
        ...metadata,
        userId,
        paymentType,
        projectId,
        offerId
      };

      // Créer les line_items pour Stripe
      const line_items = [{
        price_data: {
          currency: currency || 'eur',
          product_data: {
            name: paymentType === 'deposit' ? 'Acompte projet' : 
                  paymentType === 'final' ? 'Paiement final' : 
                  'Paiement LE SAGE DEV',
            description: projectId ? `Projet #${projectId.substring(0, 8)}` : undefined
          },
          unit_amount: Math.round(amount * 100) // Stripe attend des centimes
        },
        quantity: 1
      }];

      // Créer la Checkout Session
      const session = await stripeService.createCheckoutSession({
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail || req.userEmail,
        metadata: secureMetadata
      });

      res.json({
        sessionId: session.sessionId,
        url: session.url
      });
    } catch (error) {
      console.error('❌ Erreur création Checkout Session:', error);
      res.status(500).json({
        error: 'Erreur lors de la création de la session de paiement',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /payments
 * Récupérer l'historique des paiements de l'utilisateur
 */
router.get(
  '/',
  requireAuth,
  validateQuery(getPaymentsSchema),
  async (req, res) => {
    try {
      const userId = req.userId;
      const { projectId, status, paymentType, startDate, endDate, page, limit } = req.query;

      const pool = req.app.locals.pool;
      
      // Construction de la requête
      let query = `
        SELECT pl.*, p.title as project_title
        FROM payment_logs pl
        LEFT JOIN client_projects p ON pl.project_id = p.id
        WHERE pl.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (projectId) {
        paramCount++;
        query += ` AND pl.project_id = $${paramCount}`;
        params.push(projectId);
      }

      if (status) {
        paramCount++;
        query += ` AND pl.status = $${paramCount}`;
        params.push(status);
      }

      if (paymentType) {
        paramCount++;
        query += ` AND pl.payment_type = $${paramCount}`;
        params.push(paymentType);
      }

      if (startDate) {
        paramCount++;
        query += ` AND pl.created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND pl.created_at <= $${paramCount}`;
        params.push(endDate);
      }

      // Pagination
      const offset = (page - 1) * limit;
      query += ` ORDER BY pl.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        payments: result.rows,
        pagination: {
          page,
          limit,
          total: result.rowCount
        }
      });
    } catch (error) {
      console.error('❌ Erreur récupération paiements:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération des paiements'
      });
    }
  }
);

/**
 * GET /payments/:id
 * Récupérer les détails d'un paiement
 */
router.get(
  '/:id',
  requireAuth,
  validateUUID('id'),
  async (req, res) => {
    try {
      const userId = req.userId;
      const paymentId = req.params.id;

      const pool = req.app.locals.pool;
      const result = await pool.query(
        `SELECT pl.*, p.title as project_title, p.description as project_description
         FROM payment_logs pl
         LEFT JOIN client_projects p ON pl.project_id = p.id
         WHERE pl.id = $1 AND pl.user_id = $2`,
        [paymentId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur récupération paiement:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération du paiement'
      });
    }
  }
);

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * POST /payments/admin/customer
 * Créer un client Stripe (Admin)
 */
router.post(
  '/admin/customer',
  requireAdmin,
  validateBody(createCustomerSchema),
  async (req, res) => {
    try {
      const { email, name, phone, metadata } = req.body;

      const customer = await stripeService.createCustomer({
        email,
        name,
        phone,
        metadata
      });

      res.json({
        customerId: customer.id,
        email: customer.email,
        name: customer.name
      });
    } catch (error) {
      console.error('❌ Erreur création client Stripe:', error);
      res.status(500).json({
        error: 'Erreur lors de la création du client',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /payments/admin/invoice
 * Créer une facture Stripe (Admin)
 */
router.post(
  '/admin/invoice',
  requireAdmin,
  validateBody(createInvoiceSchema),
  async (req, res) => {
    try {
      const { customerId, projectId, items, dueDate, metadata } = req.body;

      const invoice = await stripeService.createInvoice({
        customerId,
        items,
        dueDate,
        metadata: {
          ...metadata,
          projectId,
          createdBy: req.userEmail
        }
      });

      res.json({
        invoiceId: invoice.id,
        invoiceUrl: invoice.hosted_invoice_url,
        status: invoice.status,
        total: invoice.total
      });
    } catch (error) {
      console.error('❌ Erreur création facture:', error);
      res.status(500).json({
        error: 'Erreur lors de la création de la facture',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /payments/admin/refund
 * Rembourser un paiement (Admin)
 */
router.post(
  '/admin/refund',
  requireAdmin,
  validateBody(refundPaymentSchema),
  async (req, res) => {
    try {
      const { paymentIntentId, amount, reason } = req.body;

      const refund = await stripeService.refundPayment({
        paymentIntentId,
        amount,
        reason
      });

      // Log dans la base de données
      const pool = req.app.locals.pool;
      await pool.query(
        `UPDATE payment_logs 
         SET status = 'refunded', 
             refund_id = $1, 
             refunded_at = CURRENT_TIMESTAMP,
             refunded_by = $2
         WHERE payment_intent_id = $3`,
        [refund.id, req.userId, paymentIntentId]
      );

      res.json({
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status
      });
    } catch (error) {
      console.error('❌ Erreur remboursement:', error);
      res.status(500).json({
        error: 'Erreur lors du remboursement',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /payments/admin/all
 * Récupérer tous les paiements (Admin)
 */
router.get(
  '/admin/all',
  requireAdmin,
  validateQuery(getPaymentsSchema),
  async (req, res) => {
    try {
      const { userId, projectId, status, paymentType, startDate, endDate, page, limit } = req.query;

      const pool = req.app.locals.pool;
      
      let query = `
        SELECT pl.*, 
               p.title as project_title,
               u.email as user_email,
               u.firstname || ' ' || u.lastname as user_name
        FROM payment_logs pl
        LEFT JOIN client_projects p ON pl.project_id = p.id
        LEFT JOIN users u ON pl.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (userId) {
        paramCount++;
        query += ` AND pl.user_id = $${paramCount}`;
        params.push(userId);
      }

      if (projectId) {
        paramCount++;
        query += ` AND pl.project_id = $${paramCount}`;
        params.push(projectId);
      }

      if (status) {
        paramCount++;
        query += ` AND pl.status = $${paramCount}`;
        params.push(status);
      }

      if (paymentType) {
        paramCount++;
        query += ` AND pl.payment_type = $${paramCount}`;
        params.push(paymentType);
      }

      if (startDate) {
        paramCount++;
        query += ` AND pl.created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND pl.created_at <= $${paramCount}`;
        params.push(endDate);
      }

      // Pagination
      const offset = (page - 1) * limit;
      query += ` ORDER BY pl.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Statistiques
      const statsResult = await pool.query(
        `SELECT 
           COUNT(*) as total_payments,
           SUM(amount) as total_amount,
           COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
         FROM payment_logs`
      );

      res.json({
        payments: result.rows,
        pagination: {
          page,
          limit,
          total: result.rowCount
        },
        statistics: statsResult.rows[0]
      });
    } catch (error) {
      console.error('❌ Erreur récupération paiements admin:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération des paiements'
      });
    }
  }
);

module.exports = router;
