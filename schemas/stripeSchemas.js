// backend/schemas/stripeSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les paiements Stripe
 * SÉCURITÉ: Ces schémas empêchent l'injection de données malveillantes
 */

// Types de paiements supportés
const paymentTypes = ['deposit', 'final', 'subscription', 'invoice', 'custom'];

// Devises supportées
const currencies = ['EUR', 'USD', 'GBP', 'CHF'];

// Schéma pour créer un Payment Intent
const createPaymentIntentSchema = z.object({
  amount: z
    .number()
    .int('Le montant doit être un entier')
    .positive('Le montant doit être positif')
    .max(99999999, 'Montant trop élevé'), // 999,999.99 EUR max
  currency: z
    .enum(currencies, { errorMap: () => ({ message: 'Devise invalide' }) })
    .default('EUR'),
  paymentType: z
    .enum(paymentTypes)
    .default('custom'),
  projectId: z
    .string()
    .uuid('ID projet invalide')
    .optional(),
  description: z
    .string()
    .max(500, 'Description trop longue')
    .trim()
    .optional(),
  metadata: z
    .record(z.string())
    .optional(),
  // Ne JAMAIS accepter customer ou payment_method du client
  // Ces valeurs doivent être gérées côté serveur uniquement
});

// Schéma pour créer une Checkout Session
const createCheckoutSessionSchema = z.object({
  projectId: z
    .string()
    .uuid('ID projet invalide')
    .optional(),
  offerId: z
    .string()
    .uuid('ID offre invalide')
    .optional(),
  amount: z
    .number()
    .int()
    .positive()
    .max(99999999),
  currency: z
    .enum(currencies)
    .default('EUR'),
  paymentType: z
    .enum(paymentTypes)
    .default('custom'),
  successUrl: z
    .string()
    .url('URL de succès invalide'),
  cancelUrl: z
    .string()
    .url('URL d\'annulation invalide'),
  customerEmail: z
    .string()
    .email('Email invalide')
    .optional(),
  metadata: z
    .record(z.string())
    .optional()
}).refine(
  (data) => data.projectId || data.offerId || data.amount,
  {
    message: 'Un projet, une offre ou un montant est requis',
    path: ['projectId']
  }
);

// Schéma pour créer un Customer
const createCustomerSchema = z.object({
  email: z
    .string()
    .email('Email invalide'),
  name: z
    .string()
    .min(2)
    .max(100)
    .trim(),
  phone: z
    .string()
    .regex(/^(\+33|0)[1-9](\d{8})$/, 'Numéro de téléphone français invalide')
    .optional(),
  metadata: z
    .record(z.string())
    .optional()
});

// Schéma pour créer une Invoice
const createInvoiceSchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'ID client Stripe invalide'),
  projectId: z
    .string()
    .uuid('ID projet invalide')
    .optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500).trim(),
        amount: z.number().int().positive().max(99999999),
        quantity: z.number().int().positive().max(1000).default(1),
        currency: z.enum(currencies).default('EUR')
      })
    )
    .min(1, 'Au moins un item est requis')
    .max(50, 'Maximum 50 items par facture'),
  dueDate: z
    .number()
    .int()
    .positive()
    .optional(), // Timestamp UNIX
  metadata: z
    .record(z.string())
    .optional()
});

// Schéma pour créer un Subscription
const createSubscriptionSchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'ID client Stripe invalide'),
  priceId: z
    .string()
    .startsWith('price_', 'ID prix Stripe invalide'),
  metadata: z
    .record(z.string())
    .optional(),
  trialPeriodDays: z
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
});

// Schéma pour annuler un Subscription
const cancelSubscriptionSchema = z.object({
  subscriptionId: z
    .string()
    .startsWith('sub_', 'ID abonnement Stripe invalide'),
  cancelAtPeriodEnd: z
    .boolean()
    .default(true)
    .optional()
});

// Schéma pour confirmer un Payment Intent
const confirmPaymentIntentSchema = z.object({
  paymentIntentId: z
    .string()
    .startsWith('pi_', 'ID Payment Intent invalide'),
  paymentMethodId: z
    .string()
    .startsWith('pm_', 'ID Payment Method invalide')
    .optional()
});

// Schéma pour rembourser un Payment
const refundPaymentSchema = z.object({
  paymentIntentId: z
    .string()
    .startsWith('pi_', 'ID Payment Intent invalide'),
  amount: z
    .number()
    .int()
    .positive()
    .max(99999999)
    .optional(), // Si non fourni, remboursement total
  reason: z
    .enum(['duplicate', 'fraudulent', 'requested_by_customer'])
    .optional()
});

// Schéma pour le webhook Stripe
// CRITIQUE: Ne jamais faire confiance aux données du webhook sans vérification
const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string(),
  data: z.object({
    object: z.record(z.any())
  }),
  livemode: z.boolean(),
  created: z.number()
});

// Schéma pour récupérer les paiements
const getPaymentsSchema = z.object({
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z
    .enum(['succeeded', 'pending', 'failed', 'canceled'])
    .optional(),
  paymentType: z.enum(paymentTypes).optional(),
  startDate: z.string().date().optional().or(z.date().optional()),
  endDate: z.string().date().optional().or(z.date().optional()),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional()
});

module.exports = {
  createPaymentIntentSchema,
  createCheckoutSessionSchema,
  createCustomerSchema,
  createInvoiceSchema,
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  confirmPaymentIntentSchema,
  refundPaymentSchema,
  stripeWebhookSchema,
  getPaymentsSchema,
  paymentTypes,
  currencies
};
