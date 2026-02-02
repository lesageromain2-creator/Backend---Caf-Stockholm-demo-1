// backend/schemas/reservationSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour les réservations
 */

const meetingTypes = ['visio', 'presentiel'];
const reservationStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
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

const budgetRanges = [
  'moins-1000',
  '1000-3000',
  '3000-5000',
  '5000-10000',
  'plus-10000',
  'a-discuter'
];

// Schéma pour créer une réservation
const createReservationSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide').optional(),
  reservationDate: z
    .string()
    .date('Date invalide')
    .or(z.date())
    .refine(
      (date) => {
        const reservationDate = typeof date === 'string' ? new Date(date) : date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return reservationDate >= today;
      },
      { message: 'La date de réservation doit être dans le futur' }
    ),
  reservationTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Format d\'heure invalide (HH:MM)')
    .refine(
      (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        // Heures ouvrables: 9h-18h
        return totalMinutes >= 540 && totalMinutes <= 1080;
      },
      { message: 'Les réservations sont possibles de 9h à 18h' }
    ),
  duration: z
    .number()
    .int()
    .positive()
    .min(30, 'Durée minimum: 30 minutes')
    .max(240, 'Durée maximum: 4 heures')
    .default(60)
    .optional(),
  meetingType: z
    .enum(meetingTypes, { errorMap: () => ({ message: 'Type de rendez-vous invalide' }) })
    .default('visio'),
  projectType: z
    .enum(projectTypes)
    .optional(),
  estimatedBudget: z
    .enum(budgetRanges)
    .optional(),
  message: z
    .string()
    .max(2000, 'Le message ne peut pas dépasser 2000 caractères')
    .trim()
    .optional()
});

// Schéma pour mettre à jour une réservation
const updateReservationSchema = z.object({
  reservationDate: z
    .string()
    .date()
    .or(z.date())
    .refine(
      (date) => {
        const reservationDate = typeof date === 'string' ? new Date(date) : date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return reservationDate >= today;
      },
      { message: 'La date de réservation doit être dans le futur' }
    )
    .optional(),
  reservationTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .refine(
      (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return totalMinutes >= 540 && totalMinutes <= 1080;
      }
    )
    .optional(),
  duration: z
    .number()
    .int()
    .positive()
    .min(30)
    .max(240)
    .optional(),
  meetingType: z
    .enum(meetingTypes)
    .optional(),
  projectType: z
    .enum(projectTypes)
    .optional(),
  estimatedBudget: z
    .enum(budgetRanges)
    .optional(),
  message: z
    .string()
    .max(2000)
    .trim()
    .optional(),
  status: z
    .enum(reservationStatuses)
    .optional()
});

// Schéma pour confirmer une réservation (Admin)
const confirmReservationSchema = z.object({
  confirmedBy: z.string().uuid('ID utilisateur invalide')
});

// Schéma pour annuler une réservation
const cancelReservationSchema = z.object({
  cancellationReason: z
    .string()
    .min(10, 'Veuillez préciser la raison de l\'annulation')
    .max(500, 'La raison ne peut pas dépasser 500 caractères')
    .trim()
});

// Schéma pour vérifier la disponibilité
const checkAvailabilitySchema = z.object({
  date: z
    .string()
    .date()
    .or(z.date())
    .refine(
      (date) => {
        const checkDate = typeof date === 'string' ? new Date(date) : date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return checkDate >= today;
      },
      { message: 'La date doit être dans le futur' }
    ),
  duration: z
    .number()
    .int()
    .positive()
    .min(30)
    .max(240)
    .default(60)
    .optional()
});

// Schéma pour filtrer les réservations
const reservationFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(reservationStatuses).optional(),
  meetingType: z.enum(meetingTypes).optional(),
  projectType: z.enum(projectTypes).optional(),
  dateFrom: z.string().date().or(z.date()).optional(),
  dateTo: z.string().date().or(z.date()).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  sortBy: z
    .enum(['reservationDate', 'createdAt', 'status'])
    .default('reservationDate')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});

module.exports = {
  createReservationSchema,
  updateReservationSchema,
  confirmReservationSchema,
  cancelReservationSchema,
  checkAvailabilitySchema,
  reservationFiltersSchema,
  meetingTypes,
  reservationStatuses,
  projectTypes,
  budgetRanges
};
