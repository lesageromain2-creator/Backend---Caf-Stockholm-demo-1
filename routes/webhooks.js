// backend/routes/webhooks.js
const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');

/**
 * WEBHOOK STRIPE
 * 
 * SÉCURITÉ CRITIQUE:
 * - Ce endpoint DOIT vérifier la signature Stripe
 * - Ne JAMAIS faire confiance aux données sans vérification
 * - Utiliser express.raw() pour recevoir le body brut
 * - JAMAIS utiliser de rate limiting sur ce endpoint
 * 
 * Configuration requise dans Stripe Dashboard:
 * - URL: https://votre-domaine.com/webhooks/stripe
 * - Events: payment_intent.succeeded, payment_intent.payment_failed, etc.
 * - Secret: Copier dans STRIPE_WEBHOOK_SECRET
 */

/**
 * POST /webhooks/stripe
 * Webhook pour recevoir les événements Stripe
 * 
 * IMPORTANT: Ce endpoint doit recevoir le body en raw (buffer)
 * Ajoutez ceci dans server.js AVANT express.json():
 * 
 * app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
 */
router.post('/stripe', async (req, res) => {
  // Récupérer la signature Stripe
  const signature = req.headers['stripe-signature'];
  
  if (!signature) {
    console.error('❌ Webhook: Signature Stripe manquante');
    return res.status(400).json({ error: 'Signature manquante' });
  }

  // Le body doit être brut (buffer) pour la vérification de signature
  const payload = req.body;

  try {
    // ÉTAPE 1: Vérifier la signature Stripe (CRITIQUE)
    const event = stripeService.verifyWebhookSignature(payload, signature);

    if (!event) {
      console.error('❌ Webhook: Signature invalide');
      return res.status(400).json({ error: 'Signature invalide' });
    }

    console.log(`✅ Webhook reçu: ${event.type}`);

    // ÉTAPE 2: Traiter l'événement
    await handleStripeEvent(event, req.app.locals.pool);

    // ÉTAPE 3: Répondre rapidement à Stripe
    // IMPORTANT: Ne pas attendre les opérations longues
    res.json({ received: true });

  } catch (error) {
    console.error('❌ Erreur traitement webhook:', error);
    
    // Toujours retourner 200 à Stripe pour éviter les retry
    // sauf si c'est une erreur de signature
    res.status(400).json({ 
      error: 'Erreur webhook',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Gestionnaire d'événements Stripe
 */
async function handleStripeEvent(event, pool) {
  const eventType = event.type;
  const data = event.data.object;

  try {
    switch (eventType) {
      // ============================================
      // PAIEMENTS
      // ============================================
      
      case 'payment_intent.succeeded': {
        console.log('💰 Payment succeeded:', data.id);
        
        // Mettre à jour la base de données
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'succeeded', 
               paid_at = CURRENT_TIMESTAMP,
               stripe_payment_intent_id = $1
           WHERE payment_intent_id = $1 OR stripe_payment_intent_id = $1`,
          [data.id]
        );

        // Récupérer les informations du projet
        const metadata = data.metadata || {};
        const { projectId, userId } = metadata;

        if (projectId) {
          // Marquer le paiement comme reçu dans le projet
          await pool.query(
            `UPDATE client_projects 
             SET deposit_paid = true 
             WHERE id = $1`,
            [projectId]
          );

          // Créer une notification
          await pool.query(
            `INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              'Paiement confirmé',
              `Votre paiement de ${data.amount / 100} ${data.currency.toUpperCase()} a été confirmé.`,
              'success',
              'payment',
              data.id
            ]
          );
        }

        // Envoyer un email de confirmation (géré par le service Stripe)
        await stripeService.handleWebhookEvent(event);
        break;
      }

      case 'payment_intent.payment_failed': {
        console.error('❌ Payment failed:', data.id);
        
        // Mettre à jour la base de données
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'failed', 
               error_message = $2,
               failed_at = CURRENT_TIMESTAMP
           WHERE payment_intent_id = $1 OR stripe_payment_intent_id = $1`,
          [data.id, data.last_payment_error?.message || 'Paiement échoué']
        );

        // Créer une alerte admin
        await pool.query(
          `INSERT INTO admin_alerts (alert_type, title, message, severity)
           VALUES ($1, $2, $3, $4)`,
          [
            'payment_failed',
            'Paiement échoué',
            `Paiement ${data.id} a échoué: ${data.last_payment_error?.message}`,
            'high'
          ]
        );

        // Envoyer un email d'échec
        await stripeService.handleWebhookEvent(event);
        break;
      }

      case 'payment_intent.canceled': {
        console.log('🚫 Payment canceled:', data.id);
        
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'canceled', 
               canceled_at = CURRENT_TIMESTAMP
           WHERE payment_intent_id = $1 OR stripe_payment_intent_id = $1`,
          [data.id]
        );
        break;
      }

      case 'payment_intent.requires_action': {
        console.log('⏳ Payment requires action:', data.id);
        
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'requires_action'
           WHERE payment_intent_id = $1 OR stripe_payment_intent_id = $1`,
          [data.id]
        );
        break;
      }

      // ============================================
      // CHECKOUT SESSIONS
      // ============================================

      case 'checkout.session.completed': {
        console.log('✅ Checkout session completed:', data.id);
        
        const metadata = data.metadata || {};
        const { projectId, userId, paymentType } = metadata;

        // Créer un log de paiement
        await pool.query(
          `INSERT INTO payment_logs 
           (user_id, payment_intent_id, stripe_payment_intent_id, amount, currency, payment_type, project_id, status, paid_at)
           VALUES ($1, $2, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (payment_intent_id) DO UPDATE
           SET status = 'succeeded', paid_at = CURRENT_TIMESTAMP`,
          [
            userId,
            data.payment_intent,
            data.amount_total,
            data.currency,
            paymentType || 'checkout',
            projectId,
            'succeeded'
          ]
        );
        break;
      }

      case 'checkout.session.expired': {
        console.log('⏰ Checkout session expired:', data.id);
        break;
      }

      // ============================================
      // FACTURES
      // ============================================

      case 'invoice.paid': {
        console.log('✅ Invoice paid:', data.id);
        
        await pool.query(
          `INSERT INTO payment_logs 
           (invoice_id, stripe_invoice_id, amount, currency, status, paid_at)
           VALUES ($1, $1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (invoice_id) DO UPDATE
           SET status = 'succeeded', paid_at = CURRENT_TIMESTAMP`,
          [data.id, data.amount_paid, data.currency, 'succeeded']
        );
        break;
      }

      case 'invoice.payment_failed': {
        console.error('❌ Invoice payment failed:', data.id);
        
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'failed',
               error_message = $2,
               failed_at = CURRENT_TIMESTAMP
           WHERE invoice_id = $1 OR stripe_invoice_id = $1`,
          [data.id, 'Paiement de la facture échoué']
        );
        break;
      }

      // ============================================
      // ABONNEMENTS
      // ============================================

      case 'customer.subscription.created': {
        console.log('📋 Subscription created:', data.id);
        // Logique pour gérer la création d'abonnement
        break;
      }

      case 'customer.subscription.updated': {
        console.log('🔄 Subscription updated:', data.id);
        // Logique pour gérer la mise à jour d'abonnement
        break;
      }

      case 'customer.subscription.deleted': {
        console.log('🗑️ Subscription deleted:', data.id);
        // Logique pour gérer la suppression d'abonnement
        break;
      }

      // ============================================
      // REMBOURSEMENTS
      // ============================================

      case 'charge.refunded': {
        console.log('↩️ Charge refunded:', data.id);
        
        await pool.query(
          `UPDATE payment_logs 
           SET status = 'refunded',
               refunded_at = CURRENT_TIMESTAMP,
               refund_amount = $2
           WHERE stripe_charge_id = $1`,
          [data.id, data.amount_refunded]
        );
        break;
      }

      // ============================================
      // CLIENTS
      // ============================================

      case 'customer.created': {
        console.log('👤 Customer created:', data.id);
        break;
      }

      case 'customer.updated': {
        console.log('🔄 Customer updated:', data.id);
        break;
      }

      case 'customer.deleted': {
        console.log('🗑️ Customer deleted:', data.id);
        break;
      }

      // ============================================
      // ÉVÉNEMENTS NON GÉRÉS
      // ============================================

      default:
        console.log(`ℹ️ Unhandled event type: ${eventType}`);
    }

    // Log l'événement pour audit
    await pool.query(
      `INSERT INTO stripe_events (event_id, event_type, data, processed_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(data)]
    );

  } catch (error) {
    console.error(`❌ Erreur traitement événement ${eventType}:`, error);
    
    // Log l'erreur
    await pool.query(
      `INSERT INTO stripe_events (event_id, event_type, data, error, processed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO UPDATE
       SET error = $4, processed_at = CURRENT_TIMESTAMP`,
      [event.id, event.type, JSON.stringify(data), error.message]
    );

    throw error;
  }
}

/**
 * GET /webhooks/test
 * Endpoint de test (développement uniquement)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/test', (req, res) => {
    res.json({
      message: 'Webhook endpoint is running',
      environment: process.env.NODE_ENV,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'missing'
    });
  });
}

module.exports = router;
