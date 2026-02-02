// backend/schemas/offerSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les offres de services
 */

const offerCategories = [
  'vitrine',
  'ecommerce',
  'webapp',
  'maintenance',
  'seo',
  'custom'
];

const priceTypes = ['fixed', 'range', 'custom'];
const currencies = ['EUR', 'USD', 'GBP', 'CHF'];

// Schéma pour créer une offre
const createOfferSchema = z.object({
  name: z
    .string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim(),
  slug: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[a-z0-9-]+$/, 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets')
    .trim()
    .optional(),
  description: z
    .string()
    .min(20, 'La description doit contenir au moins 20 caractères')
    .trim(),
  shortDescription: z
    .string()
    .max(500, 'La description courte ne peut pas dépasser 500 caractères')
    .trim()
    .optional(),
  priceFrom: z
    .number()
    .positive('Le prix doit être positif')
    .max(999999.99)
    .optional(),
  priceTo: z
    .number()
    .positive()
    .max(999999.99)
    .optional(),
  priceType: z
    .enum(priceTypes)
    .default('range')
    .optional(),
  priceStartingAt: z
    .number()
    .positive()
    .max(999999.99)
    .optional(),
  currency: z
    .enum(currencies)
    .default('EUR')
    .optional(),
  durationWeeks: z
    .number()
    .int()
    .positive()
    .max(104) // Max 2 ans
    .optional(),
  category: z
    .enum(offerCategories)
    .optional(),
  features: z
    .array(z.string().max(200))
    .max(20, 'Maximum 20 fonctionnalités')
    .optional(),
  deliverables: z
    .array(z.string().max(200))
    .max(20, 'Maximum 20 livrables')
    .optional(),
  timelineMin: z
    .number()
    .int()
    .positive()
    .optional(),
  timelineMax: z
    .number()
    .int()
    .positive()
    .optional(),
  icon: z
    .string()
    .max(50)
    .optional(),
  imageUrl: z
    .string()
    .url('URL d\'image invalide')
    .optional()
    .nullable(),
  colorTheme: z
    .string()
    .max(50)
    .optional(),
  displayOrder: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional(),
  isActive: z
    .boolean()
    .default(true)
    .optional(),
  isFeatured: z
    .boolean()
    .default(false)
    .optional()
}).refine(
  (data) => {
    // Si priceType est range, vérifier que priceFrom < priceTo
    if (data.priceType === 'range' && data.priceFrom && data.priceTo) {
      return data.priceFrom < data.priceTo;
    }
    return true;
  },
  {
    message: 'Le prix minimum doit être inférieur au prix maximum',
    path: ['priceFrom']
  }
).refine(
  (data) => {
    // Si timeline est défini, vérifier que min < max
    if (data.timelineMin && data.timelineMax) {
      return data.timelineMin < data.timelineMax;
    }
    return true;
  },
  {
    message: 'La durée minimale doit être inférieure à la durée maximale',
    path: ['timelineMin']
  }
);

// Schéma pour mettre à jour une offre
const updateOfferSchema = z.object({
  name: z.string().min(3).max(255).trim().optional(),
  slug: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[a-z0-9-]+$/)
    .trim()
    .optional(),
  description: z.string().min(20).trim().optional(),
  shortDescription: z.string().max(500).trim().optional(),
  priceFrom: z.number().positive().max(999999.99).optional(),
  priceTo: z.number().positive().max(999999.99).optional(),
  priceType: z.enum(priceTypes).optional(),
  priceStartingAt: z.number().positive().max(999999.99).optional(),
  currency: z.enum(currencies).optional(),
  durationWeeks: z.number().int().positive().max(104).optional(),
  category: z.enum(offerCategories).optional(),
  features: z.array(z.string().max(200)).max(20).optional(),
  deliverables: z.array(z.string().max(200)).max(20).optional(),
  timelineMin: z.number().int().positive().optional(),
  timelineMax: z.number().int().positive().optional(),
  icon: z.string().max(50).optional(),
  imageUrl: z.string().url().optional().nullable(),
  colorTheme: z.string().max(50).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional()
});

// Schéma pour filtrer les offres
const offerFiltersSchema = z.object({
  category: z.enum(offerCategories).optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  priceMin: z.coerce.number().positive().optional(),
  priceMax: z.coerce.number().positive().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['displayOrder', 'priceStartingAt', 'name', 'createdAt'])
    .default('displayOrder')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});

// Schéma pour les paramètres slug
const offerSlugSchema = z.object({
  slug: z.string().min(3).max(300)
});

module.exports = {
  createOfferSchema,
  updateOfferSchema,
  offerFiltersSchema,
  offerSlugSchema,
  offerCategories,
  priceTypes,
  currencies
};
