// backend/services/stripeService.js
const { getPool } = require('../database/db');
const { sendEmail } = require('./emailService');
const { 
  paymentSuccessEmail, 
  paymentFailedEmail, 
  invoiceEmail 
} = require('../templates/emails');

// Initialize Stripe (only if API key is provided)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
  } else {
    console.warn('⚠️ STRIPE_SECRET_KEY not found - Payment features disabled');
  }
} catch (error) {
  console.error('❌ Error initializing Stripe:', error.message);
}

// ============================================
// CREATE PAYMENT INTENT
// ============================================
const createPaymentIntent = async ({
  amount,
  currency = 'eur',
  customer_email,
  customer_name,
  project_id,
  description,
  metadata = {}
}) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description: description || 'Payment for LE SAGE DEV services',
      receipt_email: customer_email,
      metadata: {
        project_id: project_id || '',
        customer_name: customer_name || '',
        ...metadata
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// ============================================
// CREATE CHECKOUT SESSION
// ============================================
const createCheckoutSession = async ({
  line_items,
  customer_email,
  customer_name,
  project_id,
  success_url,
  cancel_url,
  metadata = {}
}) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email,
      success_url: success_url || `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        project_id: project_id || '',
        customer_name: customer_name || '',
        ...metadata
      }
    });

    return {
      sessionId: session.id,
      url: session.url
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// ============================================
// CREATE INVOICE (Stripe Invoice)
// ============================================
const createInvoice = async ({
  customer_id,
  amount,
  currency = 'eur',
  description,
  project_id,
  due_date
}) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer_id,
      collection_method: 'send_invoice',
      days_until_due: due_date ? Math.ceil((new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24)) : 30,
      description,
      metadata: {
        project_id: project_id || ''
      }
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customer_id,
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      description,
      invoice: invoice.id
    });

    // Finalize and send invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return {
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      status: finalizedInvoice.status,
      amount: finalizedInvoice.amount_due / 100,
      currency: finalizedInvoice.currency
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

// ============================================
// CREATE CUSTOMER
// ============================================
const createCustomer = async ({ email, name, phone, metadata = {} }) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata
    });

    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

// ============================================
// CREATE OR GET CUSTOMER
// ============================================
const createOrGetCustomer = async ({ email, name, user_id }) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Search for existing customer
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        user_id: user_id || ''
      }
    });

    return customer;
  } catch (error) {
    console.error('Error creating/getting customer:', error);
    throw error;
  }
};

// ============================================
// CREATE SUBSCRIPTION
// ============================================
const createSubscription = async ({
  customer_id,
  price_id,
  trial_period_days = 0,
  metadata = {}
}) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customer_id,
      items: [{ price: price_id }],
      trial_period_days: trial_period_days > 0 ? trial_period_days : undefined,
      metadata
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_end: subscription.trial_end
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// ============================================
// CANCEL SUBSCRIPTION
// ============================================
const cancelSubscription = async (subscription_id, cancel_at_period_end = true) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    let subscription;
    
    if (cancel_at_period_end) {
      subscription = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: true
      });
    } else {
      subscription = await stripe.subscriptions.del(subscription_id);
    }

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      canceled_at: subscription.canceled_at
    };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// ============================================
// HANDLE WEBHOOK EVENT
// ============================================
const handleWebhookEvent = async (event) => {
  const pool = getPool();

  try {
    switch (event.type) {
      // Payment succeeded
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { project_id, customer_name } = paymentIntent.metadata;

        // Log payment in database (you may want to create a payments table)
        console.log('✅ Payment succeeded:', paymentIntent.id);

        // Get user email for notification
        if (project_id) {
          const projectResult = await pool.query(
            `SELECT u.email, u.firstname, cp.title 
             FROM client_projects cp 
             JOIN users u ON cp.user_id = u.id 
             WHERE cp.id = $1`,
            [project_id]
          );

          if (projectResult.rows.length > 0) {
            const { email, firstname, title } = projectResult.rows[0];
            
            // Send success email
            await sendEmail({
              to: email,
              toName: firstname,
              subject: 'Paiement confirmé - LE SAGE DEV',
              html: paymentSuccessEmail({
                firstname,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase(),
                payment_date: new Date(),
                project_title: title
              }),
              emailType: 'payment_success',
              context: { payment_intent_id: paymentIntent.id }
            });
          }
        }
        break;
      }

      // Payment failed
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const { project_id } = paymentIntent.metadata;

        console.error('❌ Payment failed:', paymentIntent.id);

        if (project_id) {
          const projectResult = await pool.query(
            `SELECT u.email, u.firstname 
             FROM client_projects cp 
             JOIN users u ON cp.user_id = u.id 
             WHERE cp.id = $1`,
            [project_id]
          );

          if (projectResult.rows.length > 0) {
            const { email, firstname } = projectResult.rows[0];
            
            // Send failure email
            await sendEmail({
              to: email,
              toName: firstname,
              subject: 'Échec du paiement - LE SAGE DEV',
              html: paymentFailedEmail({
                firstname,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase(),
                error_message: paymentIntent.last_payment_error?.message
              }),
              emailType: 'payment_failed',
              context: { payment_intent_id: paymentIntent.id }
            });
          }
        }
        break;
      }

      // Invoice created
      case 'invoice.created': {
        const invoice = event.data.object;
        console.log('📄 Invoice created:', invoice.id);
        break;
      }

      // Invoice paid
      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log('✅ Invoice paid:', invoice.id);
        break;
      }

      // Invoice payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.error('❌ Invoice payment failed:', invoice.id);
        break;
      }

      // Subscription created
      case 'customer.subscription.created': {
        const subscription = event.data.object;
        console.log('📋 Subscription created:', subscription.id);
        break;
      }

      // Subscription updated
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('🔄 Subscription updated:', subscription.id);
        break;
      }

      // Subscription deleted
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('🗑️ Subscription deleted:', subscription.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
};

// ============================================
// VERIFY WEBHOOK SIGNATURE
// ============================================
const verifyWebhookSignature = (payload, signature) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured');
    return null;
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    return event;
  } catch (error) {
    console.error('⚠️ Webhook signature verification failed:', error.message);
    return null;
  }
};

// ============================================
// GET PAYMENT STATUS
// ============================================
const getPaymentStatus = async (payment_intent_id) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      created: paymentIntent.created,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw error;
  }
};

// ============================================
// REFUND PAYMENT
// ============================================
const refundPayment = async ({ paymentIntentId, amount, reason }) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const refundParams = {
      payment_intent: paymentIntentId
    };

    // Si un montant spécifique est fourni, l'utiliser
    if (amount) {
      refundParams.amount = Math.round(amount); // Amount is already in cents
    }

    // Si une raison est fournie
    if (reason) {
      refundParams.reason = reason;
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
      created: refund.created
    };
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw error;
  }
};

// ============================================
// CONFIRM PAYMENT INTENT
// ============================================
const confirmPaymentIntent = async (paymentIntentId, paymentMethodId) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret
    };
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    throw error;
  }
};

// ============================================
// RETRIEVE CUSTOMER
// ============================================
const retrieveCustomer = async (customerId) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.error('Error retrieving customer:', error);
    throw error;
  }
};

// ============================================
// UPDATE CUSTOMER
// ============================================
const updateCustomer = async (customerId, updates) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const customer = await stripe.customers.update(customerId, updates);
    return customer;
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

// ============================================
// LIST PAYMENT METHODS
// ============================================
const listPaymentMethods = async (customerId, type = 'card') => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type
    });
    return paymentMethods.data;
  } catch (error) {
    console.error('Error listing payment methods:', error);
    throw error;
  }
};

module.exports = {
  createPaymentIntent,
  createCheckoutSession,
  createInvoice,
  createCustomer,
  createOrGetCustomer,
  createSubscription,
  cancelSubscription,
  handleWebhookEvent,
  verifyWebhookSignature,
  getPaymentStatus,
  refundPayment,
  confirmPaymentIntent,
  retrieveCustomer,
  updateCustomer,
  listPaymentMethods
};
