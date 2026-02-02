// backend/middleware/zodValidation.js
const { ZodError } = require('zod');

/**
 * Middleware de validation Zod générique
 * Valide les données entrantes selon un schéma Zod
 * 
 * @param {Object} schema - Schéma Zod de validation
 * @param {String} source - Source des données: 'body', 'query', 'params'
 * @returns {Function} Middleware Express
 */
const validateSchema = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      // Récupérer les données à valider
      const dataToValidate = req[source];
      
      // Valider avec le schéma Zod
      const validatedData = await schema.parseAsync(dataToValidate);
      
      // Remplacer les données par les données validées et nettoyées
      req[source] = validatedData;
      
      // Log en développement
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Validation réussie [${source}]:`, Object.keys(validatedData));
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formater les erreurs Zod de manière lisible
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        console.error('❌ Erreur de validation Zod:', errors);
        
        return res.status(400).json({
          error: 'Données invalides',
          validationErrors: errors,
          details: process.env.NODE_ENV === 'development' ? error.errors : undefined
        });
      }
      
      // Erreur inattendue
      console.error('❌ Erreur inattendue dans la validation:', error);
      return res.status(500).json({
        error: 'Erreur lors de la validation des données'
      });
    }
  };
};

/**
 * Middleware pour valider le body d'une requête
 */
const validateBody = (schema) => validateSchema(schema, 'body');

/**
 * Middleware pour valider les query params
 */
const validateQuery = (schema) => validateSchema(schema, 'query');

/**
 * Middleware pour valider les route params
 */
const validateParams = (schema) => validateSchema(schema, 'params');

/**
 * Middleware pour valider plusieurs sources en même temps
 */
const validateMultiple = (schemas) => {
  return async (req, res, next) => {
    try {
      const validations = [];
      
      if (schemas.body) {
        const validated = await schemas.body.parseAsync(req.body);
        req.body = validated;
        validations.push('body');
      }
      
      if (schemas.query) {
        const validated = await schemas.query.parseAsync(req.query);
        req.query = validated;
        validations.push('query');
      }
      
      if (schemas.params) {
        const validated = await schemas.params.parseAsync(req.params);
        req.params = validated;
        validations.push('params');
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Validation réussie [${validations.join(', ')}]`);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        console.error('❌ Erreur de validation Zod:', errors);
        
        return res.status(400).json({
          error: 'Données invalides',
          validationErrors: errors
        });
      }
      
      console.error('❌ Erreur inattendue dans la validation:', error);
      return res.status(500).json({
        error: 'Erreur lors de la validation des données'
      });
    }
  };
};

/**
 * Middleware pour valider les UUIDs dans les params
 */
const validateUUID = (paramName = 'id') => {
  const { z } = require('zod');
  const schema = z.object({
    [paramName]: z.string().uuid(`${paramName} invalide`)
  });
  return validateParams(schema);
};

/**
 * Utilitaire pour créer des schémas de pagination standardisés
 */
const createPaginationSchema = (additionalFields = {}) => {
  const { z } = require('zod');
  return z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
    ...additionalFields
  });
};

module.exports = {
  validateSchema,
  validateBody,
  validateQuery,
  validateParams,
  validateMultiple,
  validateUUID,
  createPaginationSchema
};
