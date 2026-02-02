// backend/scripts/testStripe.js
require('dotenv').config();
const stripeService = require('../services/stripeService');

/**
 * Script de test pour Stripe
 * Usage: node scripts/testStripe.js
 */

console.log('🧪 Test Stripe Service\n');

async function testStripe() {
  try {
    // ============================================
    // 1. Test création Payment Intent
    // ============================================
    console.log('1️⃣ Test création Payment Intent...');
    
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: 5000, // 50.00 EUR en centimes
      currency: 'EUR',
      description: 'Test Payment Intent',
      metadata: {
        test: 'true',
        projectId: 'test-project-123'
      }
    });

    console.log('✅ Payment Intent créé:');
    console.log('   ID:', paymentIntent.id);
    console.log('   Client Secret:', paymentIntent.client_secret.substring(0, 20) + '...');
    console.log('   Montant:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
    console.log('');

    // ============================================
    // 2. Test création Customer
    // ============================================
    console.log('2️⃣ Test création Customer...');
    
    const customer = await stripeService.createCustomer({
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      phone: '+33612345678',
      metadata: {
        test: 'true',
        userId: 'test-user-123'
      }
    });

    console.log('✅ Customer créé:');
    console.log('   ID:', customer.id);
    console.log('   Email:', customer.email);
    console.log('   Nom:', customer.name);
    console.log('');

    // ============================================
    // 3. Test création Checkout Session
    // ============================================
    console.log('3️⃣ Test création Checkout Session...');
    
    const session = await stripeService.createCheckoutSession({
      amount: 10000, // 100.00 EUR
      currency: 'EUR',
      successUrl: 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/payment/cancel',
      customerEmail: customer.email,
      metadata: {
        test: 'true',
        projectId: 'test-project-123'
      }
    });

    console.log('✅ Checkout Session créée:');
    console.log('   ID:', session.id);
    console.log('   URL:', session.url);
    console.log('');

    // ============================================
    // 4. Test récupération statut paiement
    // ============================================
    console.log('4️⃣ Test récupération statut Payment Intent...');
    
    const status = await stripeService.getPaymentStatus(paymentIntent.id);

    console.log('✅ Statut récupéré:');
    console.log('   ID:', status.id);
    console.log('   Status:', status.status);
    console.log('   Montant:', status.amount, status.currency.toUpperCase());
    console.log('');

    // ============================================
    // 5. Test création Invoice
    // ============================================
    console.log('5️⃣ Test création Invoice...');
    
    const invoice = await stripeService.createInvoice({
      customerId: customer.id,
      items: [
        {
          description: 'Développement site web',
          amount: 500000, // 5000.00 EUR
          quantity: 1,
          currency: 'EUR'
        },
        {
          description: 'Hébergement 1 an',
          amount: 30000, // 300.00 EUR
          quantity: 1,
          currency: 'EUR'
        }
      ],
      metadata: {
        test: 'true',
        projectId: 'test-project-123'
      }
    });

    console.log('✅ Invoice créée:');
    console.log('   ID:', invoice.invoiceId);
    console.log('   URL:', invoice.invoiceUrl);
    console.log('   Status:', invoice.status);
    console.log('   Total:', invoice.total / 100, 'EUR');
    console.log('');

    // ============================================
    // Résumé
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Tous les tests sont passés avec succès !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 IDs créés (à nettoyer dans Stripe Dashboard):');
    console.log('   Payment Intent:', paymentIntent.id);
    console.log('   Customer:', customer.id);
    console.log('   Checkout Session:', session.id);
    console.log('   Invoice:', invoice.invoiceId);
    console.log('');
    console.log('🧹 Nettoyage:');
    console.log('   Aller sur https://dashboard.stripe.com/test/payments');
    console.log('   Supprimer les éléments de test créés');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur durant les tests:', error);
    console.error('');
    console.error('🔍 Vérifications:');
    console.error('   1. STRIPE_SECRET_KEY est défini dans .env');
    console.error('   2. La clé commence par sk_test_ (mode test)');
    console.error('   3. Stripe SDK est bien installé (npm install stripe)');
    console.error('');
    process.exit(1);
  }
}

// Vérifier la configuration avant de lancer les tests
console.log('📋 Configuration:');
console.log('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Définie' : '❌ Manquante');
console.log('   Mode:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'Test' : 'Live');
console.log('');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY n\'est pas définie dans .env');
  console.error('   Copier .env.example vers .env et configurer Stripe');
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('⚠️  ATTENTION: Vous utilisez une clé LIVE !');
  console.error('   Pour les tests, utilisez une clé sk_test_xxx');
  console.error('');
  process.exit(1);
}

// Lancer les tests
testStripe();
