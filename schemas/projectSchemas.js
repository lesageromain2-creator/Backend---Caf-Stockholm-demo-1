// backend/schemas/projectSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les projets clients
 */

// Types de projets autorisés
const projectTypes = [
  'vitrine',
  'ecommerce',
  'webapp',
  'mobile',
  'seo',
  'maintenance',
  'refonte',
  'custom'
];

// Statuts de projets
const projectStatuses = [
  'discovery',
  'design',
  'development',
  'testing',
  'launched',
  'completed',
  'on_hold',
  'cancelled'
];

// Priorités
const priorities = ['low', 'normal', 'high', 'urgent'];

// Schéma pour créer un projet
const createProjectSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  title: z
    .string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères')
    .trim(),
  description: z
    .string()
    .max(5000, 'La description ne peut pas dépasser 5000 caractères')
    .trim()
    .optional(),
  projectType: z
    .enum(projectTypes, { 
      errorMap: () => ({ message: 'Type de projet invalide' })
    }),
  estimatedBudget: z
    .string()
    .max(50)
    .optional(),
  startDate: z
    .string()
    .date()
    .optional()
    .or(z.date().optional()),
  estimatedDelivery: z
    .string()
    .date()
    .optional()
    .or(z.date().optional()),
  totalPrice: z
    .number()
    .positive('Le prix doit être positif')
    .max(999999.99)
    .optional(),
  depositAmount: z
    .number()
    .positive()
    .max(999999.99)
    .optional(),
  priority: z
    .enum(priorities)
    .default('medium')
    .optional()
});

// Schéma pour mettre à jour un projet
const updateProjectSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(200)
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000)
    .trim()
    .optional(),
  projectType: z
    .enum(projectTypes)
    .optional(),
  status: z
    .enum(projectStatuses)
    .optional(),
  progress: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional(),
  startDate: z
    .string()
    .date()
    .optional()
    .or(z.date().optional()),
  estimatedDelivery: z
    .string()
    .date()
    .optional()
    .or(z.date().optional()),
  totalPrice: z
    .number()
    .positive()
    .max(999999.99)
    .optional(),
  depositPaid: z
    .boolean()
    .optional(),
  depositAmount: z
    .number()
    .positive()
    .max(999999.99)
    .optional(),
  finalPaid: z
    .boolean()
    .optional(),
  stagingUrl: z
    .string()
    .url('URL de staging invalide')
    .optional()
    .nullable(),
  productionUrl: z
    .string()
    .url('URL de production invalide')
    .optional()
    .nullable(),
  priority: z
    .enum(priorities)
    .optional(),
  assignedTo: z
    .string()
    .uuid()
    .optional()
    .nullable()
});

// Schéma pour créer une tâche
const createTaskSchema = z.object({
  projectId: z.string().uuid('ID projet invalide'),
  title: z
    .string()
    .min(3)
    .max(255)
    .trim(),
  description: z
    .string()
    .max(5000)
    .trim()
    .optional(),
  priority: z
    .enum(priorities)
    .default('normal')
    .optional(),
  assignedTo: z
    .string()
    .uuid()
    .optional()
    .nullable(),
  dueDate: z
    .string()
    .date()
    .optional()
    .or(z.date().optional())
});

// Schéma pour mettre à jour une tâche
const updateTaskSchema = z.object({
  title: z.string().min(3).max(255).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  status: z
    .enum(['todo', 'in_progress', 'review', 'completed', 'blocked'])
    .optional(),
  priority: z.enum(priorities).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().date().optional().or(z.date().optional()).nullable()
});

// Schéma pour créer une mise à jour de projet
const createProjectUpdateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3).max(255).trim(),
  message: z.string().min(10, 'Le message doit contenir au moins 10 caractères').max(5000).trim(),
  updateType: z
    .enum(['info', 'milestone', 'issue', 'question', 'completed'])
    .default('info')
    .optional()
});

// Schéma pour créer un commentaire
const createCommentSchema = z.object({
  projectId: z.string().uuid(),
  comment: z.string().min(1).max(2000).trim(),
  parentCommentId: z.string().uuid().optional().nullable(),
  isInternal: z.boolean().default(false).optional()
});

// Schéma pour créer un milestone
const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  sequence: z.number().int().min(0).default(0).optional(),
  dueDate: z.string().date().optional().or(z.date().optional()),
  isVisibleToClient: z.boolean().default(true).optional()
});

// Schéma pour mettre à jour un milestone
const updateMilestoneSchema = z.object({
  title: z.string().min(3).max(255).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  sequence: z.number().int().min(0).optional(),
  dueDate: z.string().date().optional().or(z.date().optional()).nullable(),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .optional(),
  progress: z.number().int().min(0).max(100).optional(),
  isVisibleToClient: z.boolean().optional()
});

// Schéma pour les filtres de recherche
const projectFiltersSchema = z.object({
  status: z.enum(projectStatuses).optional(),
  projectType: z.enum(projectTypes).optional(),
  priority: z.enum(priorities).optional(),
  userId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'progress', 'startDate'])
    .default('createdAt')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  createProjectUpdateSchema,
  createCommentSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  projectFiltersSchema,
  projectTypes,
  projectStatuses,
  priorities
};
