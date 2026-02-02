const crypto = require('crypto');

/**
 * Générer un token de téléchargement sécurisé
 * @param {String} fileId - ID du fichier
 * @param {String} userId - ID de l'utilisateur
 * @param {Number} expiresIn - Expiration en secondes
 * @returns {Object} Token et expiration
 */
function generateDownloadToken(fileId, userId, expiresIn = 3600) {
  const expiresAt = Date.now() + (expiresIn * 1000);
  const data = `${fileId}:${userId}:${expiresAt}`;
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  const token = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  return {
    token,
    expiresAt,
    expiresIn
  };
}

/**
 * Vérifier un token de téléchargement
 * @param {String} token - Token à vérifier
 * @param {String} fileId - ID du fichier
 * @param {String} userId - ID de l'utilisateur
 * @returns {Boolean} Valide ou non
 */
function verifyDownloadToken(token, fileId, userId) {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    
    // Extraire l'expiration du token (format: fileId:userId:expiresAt)
    const parts = Buffer.from(token, 'hex').toString('utf8').split(':');
    const expiresAt = parseInt(parts[2]);
    
    // Vérifier l'expiration
    if (Date.now() > expiresAt) {
      return false;
    }
    
    // Régénérer le token pour comparaison
    const data = `${fileId}:${userId}:${expiresAt}`;
    const expectedToken = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    
    return token === expectedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * Créer une URL de téléchargement sécurisée
 * @param {String} fileId - ID du fichier
 * @param {String} userId - ID de l'utilisateur
 * @param {String} baseUrl - URL de base
 * @param {Number} expiresIn - Expiration en secondes
 * @returns {String} URL sécurisée
 */
function createSecureDownloadUrl(fileId, userId, baseUrl, expiresIn = 3600) {
  const { token, expiresAt } = generateDownloadToken(fileId, userId, expiresIn);
  
  const params = new URLSearchParams({
    token,
    fileId,
    userId,
    expires: expiresAt
  });
  
  return `${baseUrl}/download?${params.toString()}`;
}

/**
 * Valider une requête de téléchargement
 * @param {Object} req - Requête Express
 * @returns {Object} Résultat de validation
 */
function validateDownloadRequest(req) {
  const { token, fileId, userId, expires } = req.query;
  
  // Vérifier que tous les paramètres sont présents
  if (!token || !fileId || !userId || !expires) {
    return {
      valid: false,
      error: 'Missing required parameters'
    };
  }
  
  // Vérifier l'expiration
  const expiresAt = parseInt(expires);
  if (Date.now() > expiresAt) {
    return {
      valid: false,
      error: 'Download link has expired'
    };
  }
  
  // Vérifier le token
  if (!verifyDownloadToken(token, fileId, userId)) {
    return {
      valid: false,
      error: 'Invalid download token'
    };
  }
  
  // Vérifier que l'utilisateur correspond
  if (req.user && req.user.id !== userId) {
    return {
      valid: false,
      error: 'User mismatch'
    };
  }
  
  return {
    valid: true,
    fileId,
    userId
  };
}

/**
 * Middleware Express pour sécuriser les téléchargements
 */
const secureDownloadMiddleware = async (req, res, next) => {
  try {
    const validation = validateDownloadRequest(req);
    
    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        message: validation.error
      });
    }
    
    req.secureDownload = {
      fileId: validation.fileId,
      userId: validation.userId
    };
    
    next();
  } catch (error) {
    console.error('Secure download middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate download request'
    });
  }
};

/**
 * Générer des en-têtes de téléchargement sécurisés
 * @param {String} filename - Nom du fichier
 * @param {String} mimeType - Type MIME
 * @returns {Object} En-têtes
 */
function getSecureDownloadHeaders(filename, mimeType) {
  return {
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Type': mimeType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

/**
 * Logger les téléchargements
 * @param {String} fileId - ID du fichier
 * @param {String} userId - ID de l'utilisateur
 * @param {String} ipAddress - Adresse IP
 */
async function logDownload(fileId, userId, ipAddress) {
  try {
    const { pool } = require('../database/db');
    
    const query = `
      INSERT INTO download_logs (file_id, user_id, ip_address, downloaded_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    await pool.query(query, [fileId, userId, ipAddress]);
  } catch (error) {
    console.error('Download logging error:', error);
    // Ne pas bloquer le téléchargement en cas d'erreur de log
  }
}

module.exports = {
  generateDownloadToken,
  verifyDownloadToken,
  createSecureDownloadUrl,
  validateDownloadRequest,
  secureDownloadMiddleware,
  getSecureDownloadHeaders,
  logDownload
};