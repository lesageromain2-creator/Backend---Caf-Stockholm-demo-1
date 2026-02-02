// backend/schemas/contactSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les messages de contact
 */

const projectTypes = [
  'vitrine',
  'ecommerce',
  'webapp',
  'mobile',
  'seo',
  'maintenance',
  'refonte',
  'custom',
  'autre'
];

const budgetRanges = [
  'moins-1000',
  '1000-3000',
  '3000-5000',
  '5000-10000',
  'plus-10000',
  'a-discuter'
];

const priorities = ['low', 'normal', 'high', 'urgent'];
const messageStatuses = ['new', 'read', 'in_progress', 'resolved', 'archived'];

// Schéma pour créer un message de contact
const createContactMessageSchema = z.object({
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(150, 'Le nom ne peut pas dépasser 150 caractères')
    .trim(),
  email: z
    .string()
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  phone: z
    .string()
    .regex(/^(\+33|0)[1-9](\d{8})$/, 'Numéro de téléphone français invalide')
    .optional()
    .nullable(),
  company: z
    .string()
    .max(200, 'Le nom de l\'entreprise ne peut pas dépasser 200 caractères')
    .trim()
    .optional()
    .nullable(),
  subject: z
    .string()
    .min(3, 'Le sujet doit contenir au moins 3 caractères')
    .max(255, 'Le sujet ne peut pas dépasser 255 caractères')
    .trim()
    .optional(),
  projectType: z
    .enum(projectTypes)
    .optional()
    .nullable(),
  budgetRange: z
    .enum(budgetRanges)
    .optional()
    .nullable(),
  message: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(5000, 'Le message ne peut pas dépasser 5000 caractères')
    .trim(),
  // Protection anti-spam
  honeypot: z
    .string()
    .max(0, 'Champ honeypot détecté')
    .optional(),
  captchaToken: z
    .string()
    .optional() // Si vous utilisez reCAPTCHA
});

// Schéma pour répondre à un message
const replyToContactMessageSchema = z.object({
  messageId: z.string().uuid('ID message invalide'),
  replyText: z
    .string()
    .min(10, 'La réponse doit contenir au moins 10 caractères')
    .max(5000, 'La réponse ne peut pas dépasser 5000 caractères')
    .trim(),
  sendViaEmail: z
    .boolean()
    .default(true)
    .optional()
});

// Schéma pour mettre à jour un message (Admin)
const updateContactMessageSchema = z.object({
  isRead: z.boolean().optional(),
  status: z.enum(messageStatuses).optional(),
  priority: z.enum(priorities).optional(),
  assignedTo: z.string().uuid().optional().nullable()
});

// Schéma pour filtrer les messages
const contactMessageFiltersSchema = z.object({
  status: z.enum(messageStatuses).optional(),
  priority: z.enum(priorities).optional(),
  projectType: z.enum(projectTypes).optional(),
  assignedTo: z.string().uuid().optional(),
  isRead: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().date().or(z.date()).optional(),
  dateTo: z.string().date().or(z.date()).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['createdAt', 'status', 'priority'])
    .default('createdAt')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

// Schéma pour marquer comme lu/non lu
const markAsReadSchema = z.object({
  isRead: z.boolean()
});

// Schéma pour assigner un message
const assignMessageSchema = z.object({
  assignedTo: z.string().uuid('ID utilisateur invalide').nullable()
});

// Schéma pour archiver un message
const archiveMessageSchema = z.object({
  archived: z.boolean().default(true)
});

module.exports = {
  createContactMessageSchema,
  replyToContactMessageSchema,
  updateContactMessageSchema,
  contactMessageFiltersSchema,
  markAsReadSchema,
  assignMessageSchema,
  archiveMessageSchema,
  projectTypes,
  budgetRanges,
  priorities,
  messageStatuses
};
