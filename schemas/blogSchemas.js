// backend/schemas/blogSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les articles de blog
 */

const blogStatuses = ['draft', 'published', 'archived'];
const blogCategories = [
  'web-development',
  'design',
  'seo',
  'marketing',
  'tutorial',
  'news',
  'business',
  'tech'
];

// Schéma pour créer un article de blog
const createBlogPostSchema = z.object({
  title: z
    .string()
    .min(5, 'Le titre doit contenir au moins 5 caractères')
    .max(255, 'Le titre ne peut pas dépasser 255 caractères')
    .trim(),
  slug: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[a-z0-9-]+$/, 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets')
    .trim()
    .optional(), // Généré automatiquement si non fourni
  excerpt: z
    .string()
    .max(500, 'L\'extrait ne peut pas dépasser 500 caractères')
    .trim()
    .optional(),
  content: z
    .string()
    .min(100, 'Le contenu doit contenir au moins 100 caractères')
    .trim(),
  metaDescription: z
    .string()
    .max(160, 'La meta description ne peut pas dépasser 160 caractères')
    .trim()
    .optional(),
  metaKeywords: z
    .array(z.string().max(50))
    .max(10, 'Maximum 10 mots-clés')
    .optional(),
  featuredImageUrl: z
    .string()
    .url('URL d\'image invalide')
    .optional()
    .nullable(),
  category: z
    .enum(blogCategories)
    .optional(),
  tags: z
    .array(z.string().max(30))
    .max(10, 'Maximum 10 tags')
    .default([])
    .optional(),
  status: z
    .enum(blogStatuses)
    .default('draft')
    .optional(),
  isFeatured: z
    .boolean()
    .default(false)
    .optional(),
  publishedAt: z
    .string()
    .datetime()
    .or(z.date())
    .optional()
    .nullable()
});

// Schéma pour mettre à jour un article
const updateBlogPostSchema = z.object({
  title: z.string().min(5).max(255).trim().optional(),
  slug: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[a-z0-9-]+$/)
    .trim()
    .optional(),
  excerpt: z.string().max(500).trim().optional(),
  content: z.string().min(100).trim().optional(),
  metaDescription: z.string().max(160).trim().optional(),
  metaKeywords: z.array(z.string().max(50)).max(10).optional(),
  featuredImageUrl: z.string().url().optional().nullable(),
  category: z.enum(blogCategories).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  status: z.enum(blogStatuses).optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().datetime().or(z.date()).optional().nullable()
});

// Schéma pour filtrer les articles
const blogFiltersSchema = z.object({
  status: z.enum(blogStatuses).optional(),
  category: z.enum(blogCategories).optional(),
  tag: z.string().max(30).optional(),
  featured: z.coerce.boolean().optional(),
  authorId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'publishedAt', 'viewsCount', 'title'])
    .default('publishedAt')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

// Schéma pour les paramètres slug
const blogSlugSchema = z.object({
  slug: z.string().min(3).max(300)
});

module.exports = {
  createBlogPostSchema,
  updateBlogPostSchema,
  blogFiltersSchema,
  blogSlugSchema,
  blogStatuses,
  blogCategories
};
