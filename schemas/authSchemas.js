// backend/schemas/authSchemas.js
const { z } = require('zod');

/**
 * Schémas de validation pour l'authentification
 * Utilise Zod pour une validation type-safe
 */

// Schéma de base pour l'email
const emailSchema = z
  .string()
  .email('Email invalide')
  .toLowerCase()
  .trim();

// Schéma de base pour le mot de passe
const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

// Schéma pour l'inscription
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstname: z
    .string()
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(100, 'Le prénom ne peut pas dépasser 100 caractères')
    .trim(),
  lastname: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  companyName: z
    .string()
    .max(200, 'Le nom de l\'entreprise ne peut pas dépasser 200 caractères')
    .trim()
    .optional(),
  phone: z
    .string()
    .regex(/^(\+33|0)[1-9](\d{8})$/, 'Numéro de téléphone français invalide')
    .optional(),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, 'Vous devez accepter les conditions d\'utilisation')
});

// Schéma pour la connexion
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis')
});

// Schéma pour la demande de réinitialisation
const forgotPasswordSchema = z.object({
  email: emailSchema
});

// Schéma pour la réinitialisation du mot de passe
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  }
);

// Schéma pour la vérification d'email
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requis')
});

// Schéma pour le changement de mot de passe
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  }
);

// Schéma pour la mise à jour du profil
const updateProfileSchema = z.object({
  firstname: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  lastname: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  companyName: z
    .string()
    .max(200)
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .regex(/^(\+33|0)[1-9](\d{8})$/, 'Numéro de téléphone français invalide')
    .optional()
    .nullable(),
  avatarUrl: z
    .string()
    .url('URL d\'avatar invalide')
    .optional()
    .nullable()
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  updateProfileSchema,
  emailSchema,
  passwordSchema
};
