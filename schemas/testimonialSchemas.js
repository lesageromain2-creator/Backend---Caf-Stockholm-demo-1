// backend/schemas/testimonialSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les témoignages
 */

// Schéma pour créer un témoignage
const createTestimonialSchema = z.object({
  userId: z
    .string()
    .uuid('ID utilisateur invalide')
    .optional(),
  projectId: z
    .string()
    .uuid('ID projet portfolio invalide')
    .optional()
    .nullable(),
  authorName: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(150, 'Le nom ne peut pas dépasser 150 caractères')
    .trim(),
  authorRole: z
    .string()
    .max(150, 'Le rôle ne peut pas dépasser 150 caractères')
    .trim()
    .optional()
    .nullable(),
  authorCompany: z
    .string()
    .max(200, 'Le nom de l\'entreprise ne peut pas dépasser 200 caractères')
    .trim()
    .optional()
    .nullable(),
  authorAvatarUrl: z
    .string()
    .url('URL d\'avatar invalide')
    .optional()
    .nullable(),
  content: z
    .string()
    .min(20, 'Le contenu doit contenir au moins 20 caractères')
    .max(2000, 'Le contenu ne peut pas dépasser 2000 caractères')
    .trim(),
  rating: z
    .number()
    .int()
    .min(1, 'La note doit être au minimum 1')
    .max(5, 'La note doit être au maximum 5')
    .optional(),
  isFeatured: z
    .boolean()
    .default(false)
    .optional(),
  displayOrder: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
});

// Schéma pour mettre à jour un témoignage
const updateTestimonialSchema = z.object({
  authorName: z.string().min(2).max(150).trim().optional(),
  authorRole: z.string().max(150).trim().optional().nullable(),
  authorCompany: z.string().max(200).trim().optional().nullable(),
  authorAvatarUrl: z.string().url().optional().nullable(),
  content: z.string().min(20).max(2000).trim().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  isFeatured: z.boolean().optional(),
  isApproved: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

// Schéma pour approuver un témoignage (admin)
const approveTestimonialSchema = z.object({
  isApproved: z.boolean()
});

// Schéma pour filtrer les témoignages
const testimonialFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  isApproved: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['createdAt', 'rating', 'displayOrder'])
    .default('displayOrder')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});

module.exports = {
  createTestimonialSchema,
  updateTestimonialSchema,
  approveTestimonialSchema,
  testimonialFiltersSchema
};
