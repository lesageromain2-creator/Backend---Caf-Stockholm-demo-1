const fileService = require('../services/fileService');
const { pool } = require('../database/db');

class PortfolioFileController {

  /**
   * Upload images portfolio
   * POST /api/portfolio/:portfolioId/images
   */
  async uploadImages(req, res) {
    try {
      const { portfolioId } = req.params;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No images provided'
        });
      }

      // Vérifier que le projet portfolio existe
      const projectQuery = 'SELECT * FROM portfolio_projects WHERE id = $1';
      const projectResult = await pool.query(projectQuery, [portfolioId]);

      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Portfolio project not found'
        });
      }

      // Upload toutes les images
      const uploadPromises = files.map(file => 
        fileService.uploadPortfolioImage(file, portfolioId)
      );
      const uploadedImages = await Promise.all(uploadPromises);

      // Obtenir le dernier display_order
      const orderQuery = `
        SELECT COALESCE(MAX(display_order), 0) as max_order 
        FROM portfolio_images 
        WHERE portfolio_project_id = $1
      `;
      const orderResult = await pool.query(orderQuery, [portfolioId]);
      let currentOrder = orderResult.rows[0].max_order;

      // Insérer dans la base de données
      const insertPromises = uploadedImages.map((image, index) => {
        currentOrder++;
        const query = `
          INSERT INTO portfolio_images 
          (portfolio_project_id, cloudinary_public_id, image_url, thumbnail_url, medium_url, width, height, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        return pool.query(query, [
          portfolioId,
          image.publicId,
          image.url,
          image.thumbnailUrl,
          image.mediumUrl,
          image.width,
          image.height,
          currentOrder
        ]);
      });

      const insertResults = await Promise.all(insertPromises);
      const savedImages = insertResults.map(result => result.rows[0]);

      res.status(201).json({
        success: true,
        message: `${savedImages.length} image(s) uploaded successfully`,
        images: savedImages
      });
    } catch (error) {
      console.error('Upload images error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload images'
      });
    }
  }

  /**
   * Supprimer une image portfolio
   * DELETE /api/portfolio/:portfolioId/images/:imageId
   */
  async deleteImage(req, res) {
    try {
      const { portfolioId, imageId } = req.params;

      // Récupérer l'image
      const imageQuery = `
        SELECT * FROM portfolio_images 
        WHERE id = $1 AND portfolio_project_id = $2
      `;
      const imageResult = await pool.query(imageQuery, [imageId, portfolioId]);

      if (imageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      const image = imageResult.rows[0];

      // Supprimer de Cloudinary
      const cloudinaryService = require('../services/cloudinaryService');
      await cloudinaryService.deleteFile(image.cloudinary_public_id);

      // Supprimer de la DB
      await pool.query('DELETE FROM portfolio_images WHERE id = $1', [imageId]);

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Delete image error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete image'
      });
    }
  }

  /**
   * Réorganiser images portfolio
   * PUT /api/portfolio/:portfolioId/images/reorder
   * Body: { imageIds: [id1, id2, id3, ...] }
   */
  async reorderImages(req, res) {
    try {
      const { portfolioId } = req.params;
      const { imageIds } = req.body;

      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image IDs array'
        });
      }

      // Mettre à jour l'ordre de chaque image
      const updatePromises = imageIds.map((imageId, index) => {
        const query = `
          UPDATE portfolio_images 
          SET display_order = $1, updated_at = NOW()
          WHERE id = $2 AND portfolio_project_id = $3
          RETURNING *
        `;
        return pool.query(query, [index, imageId, portfolioId]);
      });

      await Promise.all(updatePromises);

      // Récupérer les images réorganisées
      const imagesQuery = `
        SELECT * FROM portfolio_images 
        WHERE portfolio_project_id = $1
        ORDER BY display_order ASC
      `;
      const imagesResult = await pool.query(imagesQuery, [portfolioId]);

      res.json({
        success: true,
        message: 'Images reordered successfully',
        images: imagesResult.rows
      });
    } catch (error) {
      console.error('Reorder images error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reorder images'
      });
    }
  }

  /**
   * Obtenir toutes les images d'un projet portfolio
   * GET /api/portfolio/:portfolioId/images
   */
  async getPortfolioImages(req, res) {
    try {
      const { portfolioId } = req.params;

      const query = `
        SELECT * FROM portfolio_images 
        WHERE portfolio_project_id = $1
        ORDER BY display_order ASC
      `;
      const result = await pool.query(query, [portfolioId]);

      res.json({
        success: true,
        count: result.rows.length,
        images: result.rows
      });
    } catch (error) {
      console.error('Get portfolio images error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve images'
      });
    }
  }

  /**
   * Mettre à jour les détails d'une image
   * PATCH /api/portfolio/:portfolioId/images/:imageId
   */
  async updateImage(req, res) {
    try {
      const { portfolioId, imageId } = req.params;
      const { altText, caption, isFeatured } = req.body;

      const query = `
        UPDATE portfolio_images 
        SET 
          alt_text = COALESCE($1, alt_text),
          caption = COALESCE($2, caption),
          is_featured = COALESCE($3, is_featured)
        WHERE id = $4 AND portfolio_project_id = $5
        RETURNING *
      `;

      const result = await pool.query(query, [
        altText,
        caption,
        isFeatured,
        imageId,
        portfolioId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      res.json({
        success: true,
        message: 'Image updated successfully',
        image: result.rows[0]
      });
    } catch (error) {
      console.error('Update image error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update image'
      });
    }
  }
}

module.exports = new PortfolioFileController();