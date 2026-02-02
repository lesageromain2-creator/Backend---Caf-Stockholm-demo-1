/**
 * Formater la taille d'un fichier
 * @param {Number} bytes - Taille en bytes
 * @returns {String} Taille formatée
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
  
  /**
   * Obtenir l'extension d'un fichier
   * @param {String} filename - Nom du fichier
   * @returns {String} Extension
   */
  function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }
  
  /**
   * Générer un nom de fichier unique
   * @param {String} originalName - Nom original
   * @returns {String} Nom unique
   */
  function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = getFileExtension(originalName);
    const baseName = originalName.replace(`.${extension}`, '');
    
    return `${baseName}-${timestamp}-${randomString}.${extension}`;
  }
  
  /**
   * Valider l'extension d'un fichier
   * @param {String} filename - Nom du fichier
   * @param {Array} allowedExtensions - Extensions autorisées
   * @returns {Boolean} Valide ou non
   */
  function isValidExtension(filename, allowedExtensions) {
    const extension = getFileExtension(filename).toLowerCase();
    return allowedExtensions.includes(extension);
  }
  
  /**
   * Nettoyer le nom d'un fichier
   * @param {String} filename - Nom du fichier
   * @returns {String} Nom nettoyé
   */
  function sanitizeFilename(filename) {
    // Remplacer les caractères spéciaux
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }
  
  /**
   * Déterminer le type de fichier à partir du MIME type
   * @param {String} mimeType - Type MIME
   * @returns {String} Type de fichier
   */
  function getFileTypeFromMime(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
    if (mimeType === 'text/plain') return 'text';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return 'archive';
    return 'other';
  }
  
  /**
   * Obtenir l'icône appropriée pour un type de fichier
   * @param {String} fileType - Type de fichier
   * @returns {String} Nom de l'icône
   */
  function getFileIcon(fileType) {
    const icons = {
      image: '🖼️',
      video: '🎥',
      audio: '🎵',
      pdf: '📄',
      document: '📝',
      spreadsheet: '📊',
      presentation: '📽️',
      text: '📃',
      archive: '📦',
      other: '📎'
    };
    return icons[fileType] || icons.other;
  }
  
  /**
   * Valider la taille maximale d'un fichier
   * @param {Number} fileSize - Taille du fichier
   * @param {Number} maxSize - Taille maximale autorisée
   * @returns {Boolean} Valide ou non
   */
  function isValidSize(fileSize, maxSize) {
    return fileSize <= maxSize;
  }
  
  /**
   * Créer un objet de métadonnées de fichier
   * @param {Object} file - Objet fichier
   * @param {Object} uploadResult - Résultat de l'upload Cloudinary
   * @returns {Object} Métadonnées
   */
  function createFileMetadata(file, uploadResult = {}) {
    return {
      originalName: file.originalname,
      fileName: file.filename || uploadResult.original_filename,
      mimeType: file.mimetype,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      extension: getFileExtension(file.originalname),
      fileType: getFileTypeFromMime(file.mimetype),
      icon: getFileIcon(getFileTypeFromMime(file.mimetype)),
      cloudinary: {
        publicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        format: uploadResult.format,
        resourceType: uploadResult.resource_type,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes
      },
      uploadedAt: new Date().toISOString()
    };
  }
  
  /**
   * Extraire le public ID d'une URL Cloudinary
   * @param {String} url - URL Cloudinary
   * @returns {String} Public ID
   */
  function extractPublicIdFromUrl(url) {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      
      if (uploadIndex === -1) return null;
      
      // Récupérer tout après 'upload/' et avant l'extension
      const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
      const publicIdWithExt = pathAfterUpload.split('.')[0];
      
      return publicIdWithExt;
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  }
  
  /**
   * Générer un slug de fichier sécurisé
   * @param {String} filename - Nom du fichier
   * @returns {String} Slug
   */
  function generateFileSlug(filename) {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  module.exports = {
    formatFileSize,
    getFileExtension,
    generateUniqueFilename,
    isValidExtension,
    sanitizeFilename,
    getFileTypeFromMime,
    getFileIcon,
    isValidSize,
    createFileMetadata,
    extractPublicIdFromUrl,
    generateFileSlug
  };