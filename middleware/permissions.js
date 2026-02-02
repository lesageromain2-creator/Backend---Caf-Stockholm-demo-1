const { pool } = require('../database/db');

/**
 * Vérifier permissions projet
 * @param {String} action - Action demandée (view, upload, download, delete)
 */
const checkProjectPermission = (action) => {
  return async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admin/Staff ont tous les droits
      if (userRole === 'admin' || userRole === 'staff') {
        return next();
      }

      // Vérifier accès au projet
      const query = `
        SELECT 
          user_id,
          assigned_to
        FROM client_projects
        WHERE id = $1
      `;

      const result = await pool.query(query, [projectId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      const project = result.rows[0];

      // Vérifier si l'utilisateur est le propriétaire ou assigné
      const hasAccess = 
        project.user_id === userId || 
        project.assigned_to === userId;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this project'
        });
      }

      // Permissions spécifiques par action
      if (action === 'delete' && project.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only project owner or admin can delete files'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Vérifier que l'utilisateur est admin
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Vérifier que l'utilisateur est admin ou staff
 */
const isAdminOrStaff = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Admin or staff access required'
    });
  }
  next();
};

module.exports = {
  checkProjectPermission,
  isAdmin,
  isAdminOrStaff
};