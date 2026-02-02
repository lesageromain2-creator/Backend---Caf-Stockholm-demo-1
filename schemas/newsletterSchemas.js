// backend/schemas/newsletterSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour la newsletter
 */

const subscriberStatuses = ['active', 'unsubscribed', 'bounced'];

// Schéma pour s'abonner à la newsletter
const subscribeNewsletterSchema = z.object({
  email: z
    .string()
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  firstname: z
    .string()
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(100)
    .trim()
    .optional(),
  lastname: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100)
    .trim()
    .optional(),
  // Protection anti-spam
  honeypot: z
    .string()
    .max(0, 'Champ honeypot détecté')
    .optional()
});

// Schéma pour se désabonner
const unsubscribeNewsletterSchema = z.object({
  email: z.string().email().toLowerCase().trim()
}).or(
  z.object({
    token: z.string().min(10)
  })
);

// Schéma pour envoyer une newsletter (admin)
const sendNewsletterSchema = z.object({
  subject: z
    .string()
    .min(5, 'Le sujet doit contenir au moins 5 caractères')
    .max(200, 'Le sujet ne peut pas dépasser 200 caractères')
    .trim(),
  htmlContent: z
    .string()
    .min(50, 'Le contenu doit contenir au moins 50 caractères')
    .trim(),
  textContent: z
    .string()
    .min(50)
    .trim()
    .optional(),
  previewText: z
    .string()
    .max(200)
    .trim()
    .optional(),
  segmentBy: z
    .enum(['all', 'active', 'recent'])
    .default('active')
    .optional(),
  scheduledFor: z
    .string()
    .datetime()
    .or(z.date())
    .optional(),
  testEmails: z
    .array(z.string().email())
    .max(5, 'Maximum 5 emails de test')
    .optional()
});

// Schéma pour mettre à jour un abonné (admin)
const updateSubscriberSchema = z.object({
  firstname: z.string().min(2).max(100).trim().optional(),
  lastname: z.string().min(2).max(100).trim().optional(),
  status: z.enum(subscriberStatuses).optional()
});

// Schéma pour filtrer les abonnés
const subscriberFiltersSchema = z.object({
  status: z.enum(subscriberStatuses).optional(),
  search: z.string().max(200).optional(),
  subscribedAfter: z.string().date().or(z.date()).optional(),
  subscribedBefore: z.string().date().or(z.date()).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['subscribedAt', 'email', 'lastname'])
    .default('subscribedAt')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

// Schéma pour exporter les abonnés
const exportSubscribersSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(subscriberStatuses).optional(),
  fields: z
    .array(z.enum(['email', 'firstname', 'lastname', 'subscribedAt', 'status']))
    .optional()
});

module.exports = {
  subscribeNewsletterSchema,
  unsubscribeNewsletterSchema,
  sendNewsletterSchema,
  updateSubscriberSchema,
  subscriberFiltersSchema,
  exportSubscribersSchema,
  subscriberStatuses
};
