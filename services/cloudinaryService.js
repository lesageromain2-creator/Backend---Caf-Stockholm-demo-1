const { cloudinary, FOLDERS, TRANSFORMATIONS } = require('../config/cloudinary');
const { pool } = require('../database/db');

class CloudinaryService {
  
  /**
   * Upload un fichier vers Cloudinary
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Résultat upload
   */
  async uploadFile(fileBuffer, options = {}) {
    try {
      const {
        folder = FOLDERS.TEMP,
        publicId,
        transformation,
        resourceType = 'auto',
        tags = []
      } = options;

      const uploadOptions = {
        folder,
        resource_type: resourceType,
        tags: [...tags, 'webdev'],
        overwrite: false,
        unique_filename: true
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      if (transformation) {
        uploadOptions.transformation = transformation;
      }

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple fichiers
   * @param {Array} files - Tableau de fichiers
   * @param {Object} options - Options d'upload
   * @returns {Promise<Array>} Résultats upload
   */
  async uploadMultiple(files, options = {}) {
    const uploadPromises = files.map(file => 
      this.uploadFile(file.buffer, {
        ...options,
        tags: [...(options.tags || []), file.originalname]
      })
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Supprimer un fichier
   * @param {String} publicId - ID public du fichier
   * @param {String} resourceType - Type de ressource
   * @returns {Promise<Object>} Résultat suppression
   */
  async deleteFile(publicId, resourceType = 'image') {
    try {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Supprimer plusieurs fichiers
   * @param {Array} publicIds - Tableau d'IDs publics
   * @param {String} resourceType - Type de ressource
   * @returns {Promise<Object>} Résultat suppression
   */
  async deleteMultiple(publicIds, resourceType = 'image') {
    try {
      return await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType
      });
    } catch (error) {
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Générer URL de transformation
   * @param {String} publicId - ID public
   * @param {String} transformationType - Type de transformation
   * @returns {String} URL transformée
   */
  getTransformedUrl(publicId, transformationType) {
    const transformation = TRANSFORMATIONS[transformationType];
    if (!transformation) {
      return cloudinary.url(publicId);
    }
    return cloudinary.url(publicId, transformation);
  }

  /**
   * Générer URL signée (sécurisée)
   * @param {String} publicId - ID public
   * @param {Number} expiresIn - Expiration en secondes
   * @returns {String} URL signée
   */
  getSignedUrl(publicId, expiresIn = 3600) {
    const timestamp = Math.round(Date.now() / 1000) + expiresIn;
    return cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      expires_at: timestamp
    });
  }

  /**
   * Rechercher des fichiers
   * @param {Object} searchOptions - Options de recherche
   * @returns {Promise<Object>} Résultats recherche
   */
  async searchFiles(searchOptions = {}) {
    try {
      const {
        expression,
        folder,
        resourceType = 'image',
        maxResults = 50
      } = searchOptions;

      let searchExpression = expression || '';
      if (folder) {
        searchExpression = `folder:${folder}${expression ? ` AND ${expression}` : ''}`;
      }

      return await cloudinary.search
        .expression(searchExpression)
        .max_results(maxResults)
        .execute();
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Obtenir les métadonnées d'un fichier
   * @param {String} publicId - ID public
   * @param {String} resourceType - Type de ressource
   * @returns {Promise<Object>} Métadonnées
   */
  async getFileMetadata(publicId, resourceType = 'image') {
    try {
      return await cloudinary.api.resource(publicId, {
        resource_type: resourceType
      });
    } catch (error) {
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }
}

module.exports = new CloudinaryService();