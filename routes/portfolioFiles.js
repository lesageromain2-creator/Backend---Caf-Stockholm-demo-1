const express = require('express');
const router = express.Router();
const portfolioFileController = require('../controllers/portfolioFileController');
const { requireAuth } = require('../middleware/auths');
const { uploadMiddleware, validateImage } = require('../middleware/fileUpload');
const { isAdmin } = require('../middleware/permissions');

/**
 * @route   POST /api/portfolio/:portfolioId/images
 * @desc    Upload images pour un projet portfolio
 * @access  Private (Admin uniquement)
 */
router.post(
  '/:portfolioId/images',
  requireAuth,
  isAdmin,
  uploadMiddleware.array('images', 10),
  validateImage,
  portfolioFileController.uploadImages
);

/**
 * @route   GET /api/portfolio/:portfolioId/images
 * @desc    Obtenir toutes les images d'un projet portfolio
 * @access  Public
 */
router.get(
  '/:portfolioId/images',
  portfolioFileController.getPortfolioImages
);

/**
 * @route   DELETE /api/portfolio/:portfolioId/images/:imageId
 * @desc    Supprimer une image portfolio
 * @access  Private (Admin uniquement)
 */
router.delete(
  '/:portfolioId/images/:imageId',
  requireAuth,
  isAdmin,
  portfolioFileController.deleteImage
);

/**
 * @route   PUT /api/portfolio/:portfolioId/images/reorder
 * @desc    Réorganiser les images d'un portfolio
 * @access  Private (Admin uniquement)
 */
router.put(
  '/:portfolioId/images/reorder',
  requireAuth,
  isAdmin,
  portfolioFileController.reorderImages
);

/**
 * @route   PATCH /api/portfolio/:portfolioId/images/:imageId
 * @desc    Mettre à jour les détails d'une image
 * @access  Private (Admin uniquement)
 */
router.patch(
  '/:portfolioId/images/:imageId',
  requireAuth,
  isAdmin,
  portfolioFileController.updateImage
);

module.exports = router;