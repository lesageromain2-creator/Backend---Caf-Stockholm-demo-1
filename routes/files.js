const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { requireAuth } = require('../middleware/auths');
const { uploadMiddleware, validateFile } = require('../middleware/fileUpload');
const { checkProjectPermission } = require('../middleware/permissions');

/**
 * @route   POST /api/files/upload
 * @desc    Upload fichiers (endpoint générique)
 * @access  Private
 */
router.post(
  '/upload',
  requireAuth,
  uploadMiddleware.array('files', 10),
  validateFile,
  async (req, res) => {
    try {
      const { folder = 'temp', tags = [] } = req.body;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files provided'
        });
      }

      const cloudinaryService = require('../services/cloudinaryService');
      
      const uploadPromises = files.map(file => 
        cloudinaryService.uploadFile(file.buffer, {
          folder: `webdev/${folder}`,
          tags: Array.isArray(tags) ? tags : [tags]
        })
      );

      const results = await Promise.all(uploadPromises);

      res.status(201).json({
        success: true,
        message: `${results.length} file(s) uploaded successfully`,
        files: results.map(result => ({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          size: result.bytes,
          width: result.width,
          height: result.height
        }))
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload files'
      });
    }
  }
);

/**
 * @route   DELETE /api/files/:publicId
 * @desc    Supprimer un fichier par publicId
 * @access  Private (Admin)
 */
router.delete(
  '/:publicId',
  requireAuth,
  async (req, res) => {
    try {
      const { publicId } = req.params;
      
      // Remplacer les underscores par des slashes
      const decodedPublicId = publicId.replace(/_/g, '/');

      const cloudinaryService = require('../services/cloudinaryService');
      await cloudinaryService.deleteFile(decodedPublicId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete file'
      });
    }
  }
);

/**
 * @route   GET /api/files/search
 * @desc    Rechercher des fichiers
 * @access  Private (Admin)
 */
router.get(
  '/search',
  requireAuth,
  async (req, res) => {
    try {
      const { folder, expression, maxResults = 50 } = req.query;

      const cloudinaryService = require('../services/cloudinaryService');
      const results = await cloudinaryService.searchFiles({
        folder,
        expression,
        maxResults: parseInt(maxResults)
      });

      res.json({
        success: true,
        total: results.total_count,
        files: results.resources
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search files'
      });
    }
  }
);

module.exports = router;