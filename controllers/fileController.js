const { pool } = require('../database/db');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

/**
 * Upload fichiers projet
 */
const uploadProjectFiles = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    await client.query('BEGIN');

    const uploadedFiles = [];

    for (const file of files) {
      // Upload vers Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `projects/${projectId}`,
            resource_type: 'auto',
            public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        const readableStream = Readable.from(file.buffer);
        readableStream.pipe(uploadStream);
      });

      // Sauvegarder en BDD
      const insertQuery = `
        INSERT INTO project_files (
          project_id,
          file_name,
          file_type,
          file_size,
          cloudinary_public_id,
          cloudinary_url,
          cloudinary_secure_url,
          uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        projectId,
        file.originalname,
        file.mimetype,
        file.size,
        uploadResult.public_id,
        uploadResult.url,
        uploadResult.secure_url,
        userId
      ]);

      uploadedFiles.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Obtenir fichiers d'un projet
 */
const getProjectFiles = async (req, res) => {
  try {
    const { projectId } = req.params;

    const query = `
      SELECT 
        pf.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM project_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.project_id = $1
      ORDER BY pf.created_at DESC
    `;

    const result = await pool.query(query, [projectId]);

    res.json({
      success: true,
      files: result.rows
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files',
      error: error.message
    });
  }
};

/**
 * Télécharger un fichier
 */
const downloadFile = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const query = `
      SELECT * FROM project_files
      WHERE id = $1 AND project_id = $2
    `;

    const result = await pool.query(query, [fileId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = result.rows[0];

    // Rediriger vers l'URL Cloudinary sécurisée
    res.json({
      success: true,
      downloadUrl: file.cloudinary_secure_url,
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: error.message
    });
  }
};

/**
 * Supprimer un fichier
 */
const deleteFile = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { projectId, fileId } = req.params;

    await client.query('BEGIN');

    // Récupérer infos fichier
    const selectQuery = `
      SELECT * FROM project_files
      WHERE id = $1 AND project_id = $2
    `;

    const result = await client.query(selectQuery, [fileId, projectId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = result.rows[0];

    // Supprimer de Cloudinary
    try {
      await cloudinary.uploader.destroy(file.cloudinary_public_id);
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continuer même si la suppression Cloudinary échoue
    }

    // Supprimer de la BDD
    const deleteQuery = `
      DELETE FROM project_files
      WHERE id = $1
    `;

    await client.query(deleteQuery, [fileId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'File deletion failed',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Obtenir métadonnées d'un fichier
 */
const getFileMetadata = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const query = `
      SELECT 
        pf.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name,
        u.email as uploaded_by_email
      FROM project_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.id = $1 AND pf.project_id = $2
    `;

    const result = await pool.query(query, [fileId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      metadata: result.rows[0]
    });

  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metadata',
      error: error.message
    });
  }
};

module.exports = {
  uploadProjectFiles,
  getProjectFiles,
  downloadFile,
  deleteFile,
  getFileMetadata
};