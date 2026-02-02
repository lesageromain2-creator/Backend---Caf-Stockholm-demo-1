const { pool } = require('../database/db');
const cloudinaryService = require('./cloudinaryService');
const emailService = require('./emailService');
const { FOLDERS } = require('../config/cloudinary');

class FileService {

  /**
   * Créer un enregistrement de fichier dans la DB
   * @param {Object} fileData - Données du fichier
   * @returns {Promise<Object>} Fichier créé
   */
  async createFileRecord(fileData) {
    const {
      projectId,
      userId,
      fileName,
      fileUrl,
      fileType,
      fileSize,
      mimeType,
      cloudinaryPublicId,
      thumbnailUrl,
      metadata = {}
    } = fileData;

    const query = `
      INSERT INTO project_files 
      (project_id, user_id, file_name, file_url, file_type, file_size, mime_type, cloudinary_public_id, thumbnail_url, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      projectId, userId, fileName, fileUrl, fileType, 
      fileSize, mimeType, cloudinaryPublicId, thumbnailUrl, 
      JSON.stringify(metadata)
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Upload fichier projet
   * @param {Object} file - Fichier uploadé
   * @param {String} projectId - ID du projet
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Fichier uploadé
   */
  async uploadProjectFile(file, projectId, userId) {
    try {
      // Upload vers Cloudinary
      const uploadResult = await cloudinaryService.uploadFile(file.buffer, {
        folder: `${FOLDERS.PROJECTS}/${projectId}`,
        tags: ['project', projectId, userId]
      });

      // Générer thumbnail pour images
      let thumbnailUrl = null;
      if (file.mimetype.startsWith('image/')) {
        thumbnailUrl = cloudinaryService.getTransformedUrl(
          uploadResult.public_id,
          'THUMBNAIL'
        );
      }

      // Créer enregistrement DB
      const fileRecord = await this.createFileRecord({
        projectId,
        userId,
        fileName: file.originalname,
        fileUrl: uploadResult.secure_url,
        fileType: this.getFileType(file.mimetype),
        fileSize: file.size,
        mimeType: file.mimetype,
        cloudinaryPublicId: uploadResult.public_id,
        thumbnailUrl,
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format
        }
      });

      // Envoyer email notification
      await this.notifyFileUpload(projectId, userId, fileRecord);

      return fileRecord;
    } catch (error) {
      throw new Error(`Failed to upload project file: ${error.message}`);
    }
  }

  /**
   * Upload multiple fichiers projet
   * @param {Array} files - Fichiers uploadés
   * @param {String} projectId - ID du projet
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Fichiers uploadés
   */
  async uploadMultipleProjectFiles(files, projectId, userId) {
    const uploadPromises = files.map(file => 
      this.uploadProjectFile(file, projectId, userId)
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Obtenir fichiers d'un projet
   * @param {String} projectId - ID du projet
   * @param {String} userId - ID de l'utilisateur (pour permissions)
   * @returns {Promise<Array>} Liste des fichiers
   */
  async getProjectFiles(projectId, userId) {
    // Vérifier permissions
    const hasAccess = await this.checkProjectAccess(projectId, userId);
    if (!hasAccess) {
      throw new Error('Access denied to project files');
    }

    const query = `
      SELECT 
        pf.*,
        u.firstname || ' ' || u.lastname as uploaded_by_name,
        u.email as uploaded_by_email
      FROM project_files pf
      LEFT JOIN users u ON pf.user_id = u.id
      WHERE pf.project_id = $1 AND pf.is_deleted = false
      ORDER BY pf.created_at DESC
    `;

    const result = await pool.query(query, [projectId]);
    return result.rows;
  }

  /**
   * Supprimer un fichier (soft delete)
   * @param {String} fileId - ID du fichier
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Boolean>} Succès
   */
  async deleteFile(fileId, userId) {
    try {
      // Récupérer infos fichier
      const fileQuery = 'SELECT * FROM project_files WHERE id = $1 AND is_deleted = false';
      const fileResult = await pool.query(fileQuery, [fileId]);
      
      if (fileResult.rows.length === 0) {
        throw new Error('File not found');
      }

      const file = fileResult.rows[0];

      // Vérifier permissions
      const hasAccess = await this.checkProjectAccess(file.project_id, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Supprimer de Cloudinary
      if (file.cloudinary_public_id) {
        await cloudinaryService.deleteFile(file.cloudinary_public_id);
      }

      // Soft delete dans la DB
      await pool.query(
        'UPDATE project_files SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
        [fileId]
      );

      return true;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Upload image portfolio
   * @param {Object} file - Fichier image
   * @param {String} portfolioId - ID du projet portfolio
   * @returns {Promise<Object>} Image uploadée
   */
  async uploadPortfolioImage(file, portfolioId) {
    try {
      const uploadResult = await cloudinaryService.uploadFile(file.buffer, {
        folder: `${FOLDERS.PORTFOLIO}/${portfolioId}`,
        transformation: 'PORTFOLIO',
        tags: ['portfolio', portfolioId]
      });

      // Générer URLs transformées
      const thumbnailUrl = cloudinaryService.getTransformedUrl(
        uploadResult.public_id,
        'THUMBNAIL'
      );

      const mediumUrl = cloudinaryService.getTransformedUrl(
        uploadResult.public_id,
        'MEDIUM'
      );

      return {
        url: uploadResult.secure_url,
        thumbnailUrl,
        mediumUrl,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height
      };
    } catch (error) {
      throw new Error(`Failed to upload portfolio image: ${error.message}`);
    }
  }

  /**
   * Vérifier l'accès à un projet
   * @param {String} projectId - ID du projet
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Boolean>} A accès
   */
  async checkProjectAccess(projectId, userId) {
    const query = `
      SELECT 
        CASE 
          WHEN cp.user_id = $2 THEN TRUE
          WHEN cp.assigned_to = $2 THEN TRUE
          WHEN u.role IN ('admin', 'staff') THEN TRUE
          ELSE FALSE
        END as has_access
      FROM client_projects cp
      LEFT JOIN users u ON u.id = $2
      WHERE cp.id = $1
    `;

    const result = await pool.query(query, [projectId, userId]);
    return result.rows[0]?.has_access || false;
  }

  /**
   * Déterminer le type de fichier
   * @param {String} mimeType - Type MIME
   * @returns {String} Type de fichier
   */
  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
    return 'other';
  }

  /**
   * Notifier l'upload d'un fichier
   * @param {String} projectId - ID du projet
   * @param {String} userId - ID de l'utilisateur
   * @param {Object} fileRecord - Enregistrement du fichier
   */
  async notifyFileUpload(projectId, userId, fileRecord) {
    try {
      // Récupérer infos projet et utilisateur
      const query = `
        SELECT 
          cp.title as project_title,
          cp.user_id as client_id,
          u.email as uploader_email,
          u.firstname || ' ' || u.lastname as uploader_name,
          c.email as client_email,
          c.firstname || ' ' || c.lastname as client_name
        FROM client_projects cp
        LEFT JOIN users u ON u.id = $2
        LEFT JOIN users c ON c.id = cp.user_id
        WHERE cp.id = $1
      `;

      const result = await pool.query(query, [projectId, userId]);
      const projectData = result.rows[0];

      // Envoyer email au client si fichier uploadé par admin/staff
      if (userId !== projectData.client_id) {
        await emailService.sendFileUploaded({
          recipientEmail: projectData.client_email,
          recipientName: projectData.client_name,
          projectTitle: projectData.project_title,
          fileName: fileRecord.file_name,
          uploadedBy: projectData.uploader_name,
          fileUrl: fileRecord.file_url,
          projectId
        });
      }
    } catch (error) {
      console.error('Failed to send file upload notification:', error);
    }
  }

  /**
   * Générer URL de téléchargement sécurisée
   * @param {String} fileId - ID du fichier
   * @param {String} userId - ID de l'utilisateur
   * @param {Number} expiresIn - Expiration en secondes
   * @returns {Promise<String>} URL sécurisée
   */
  async getSecureDownloadUrl(fileId, userId, expiresIn = 3600) {
    const fileQuery = 'SELECT * FROM project_files WHERE id = $1 AND is_deleted = false';
    const fileResult = await pool.query(fileQuery, [fileId]);
    
    if (fileResult.rows.length === 0) {
      throw new Error('File not found');
    }

    const file = fileResult.rows[0];

    // Vérifier permissions
    const hasAccess = await this.checkProjectAccess(file.project_id, userId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // Générer URL signée
    return cloudinaryService.getSignedUrl(file.cloudinary_public_id, expiresIn);
  }
}

module.exports = new FileService();