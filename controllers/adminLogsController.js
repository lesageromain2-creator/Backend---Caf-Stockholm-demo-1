// backend/controllers/adminLogsController.js
const { getPool } = require('../database/db');

// ============================================
// LOG ADMIN ACTION (Internal use)
// ============================================
const logAdminAction = async ({
  admin_user_id,
  action,
  resource_type,
  resource_id,
  details,
  req
}) => {
  const pool = getPool();
  try {
    const ip_address = req?.ip || req?.connection?.remoteAddress || null;
    const user_agent = req?.headers?.['user-agent'] || null;
    
    await pool.query(
      `INSERT INTO admin_activity_logs (
        admin_user_id, action, resource_type, resource_id, details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        admin_user_id,
        action,
        resource_type,
        resource_id,
        JSON.stringify(details),
        ip_address,
        user_agent
      ]
    );
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

// ============================================
// GET ALL ADMIN LOGS (Admin only)
// ============================================
const getAllLogs = async (req, res) => {
  const pool = getPool();
  try {
    const {
      admin_user_id,
      action,
      resource_type,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.firstname || ' ' || u.lastname as admin_name,
        u.email as admin_email
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (admin_user_id) {
      query += ` AND al.admin_user_id = $${paramIndex}`;
      params.push(admin_user_id);
      paramIndex++;
    }
    
    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    if (resource_type) {
      query += ` AND al.resource_type = $${paramIndex}`;
      params.push(resource_type);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_activity_logs WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;
    
    if (admin_user_id) {
      countQuery += ` AND admin_user_id = $${countParamIndex}`;
      countParams.push(admin_user_id);
      countParamIndex++;
    }
    
    if (action) {
      countQuery += ` AND action = $${countParamIndex}`;
      countParams.push(action);
      countParamIndex++;
    }
    
    if (resource_type) {
      countQuery += ` AND resource_type = $${countParamIndex}`;
      countParams.push(resource_type);
      countParamIndex++;
    }
    
    if (start_date) {
      countQuery += ` AND created_at >= $${countParamIndex}`;
      countParams.push(start_date);
      countParamIndex++;
    }
    
    if (end_date) {
      countQuery += ` AND created_at <= $${countParamIndex}`;
      countParams.push(end_date);
      countParamIndex++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
};

// ============================================
// GET ADMIN LOG BY ID (Admin only)
// ============================================
const getLogById = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        al.*,
        u.firstname || ' ' || u.lastname as admin_name,
        u.email as admin_email,
        u.avatar_url as admin_avatar
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_user_id = u.id
      WHERE al.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du log' });
  }
};

// ============================================
// GET ADMIN ACTIVITY STATS (Admin only)
// ============================================
const getActivityStats = async (req, res) => {
  const pool = getPool();
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date) {
      dateFilter += ' AND created_at >= $1';
      params.push(start_date);
    }
    
    if (end_date) {
      dateFilter += ` AND created_at <= $${params.length + 1}`;
      params.push(end_date);
    }
    
    // Overall stats
    const overallResult = await pool.query(
      `SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT admin_user_id) as unique_admins,
        COUNT(DISTINCT resource_type) as resource_types_affected
      FROM admin_activity_logs
      WHERE 1=1 ${dateFilter}`,
      params
    );
    
    // Actions by type
    const actionsByTypeResult = await pool.query(
      `SELECT 
        action,
        COUNT(*) as count
      FROM admin_activity_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10`,
      params
    );
    
    // Actions by admin
    const actionsByAdminResult = await pool.query(
      `SELECT 
        u.firstname || ' ' || u.lastname as admin_name,
        u.email as admin_email,
        COUNT(*) as action_count
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_user_id = u.id
      WHERE 1=1 ${dateFilter}
      GROUP BY u.id, u.firstname, u.lastname, u.email
      ORDER BY action_count DESC
      LIMIT 10`,
      params
    );
    
    // Actions by resource type
    const actionsByResourceResult = await pool.query(
      `SELECT 
        resource_type,
        COUNT(*) as count
      FROM admin_activity_logs
      WHERE resource_type IS NOT NULL ${dateFilter}
      GROUP BY resource_type
      ORDER BY count DESC`,
      params
    );
    
    res.json({
      overall: overallResult.rows[0],
      by_action: actionsByTypeResult.rows,
      by_admin: actionsByAdminResult.rows,
      by_resource: actionsByResourceResult.rows
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

// ============================================
// CREATE ALERT (Admin only)
// ============================================
const createAlert = async (req, res) => {
  const pool = getPool();
  try {
    const {
      title,
      message,
      severity = 'info',
      alert_type,
      related_resource_type,
      related_resource_id
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO admin_alerts (
        title, message, severity, alert_type, related_resource_type, related_resource_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [title, message, severity, alert_type, related_resource_type, related_resource_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'alerte' });
  }
};

// ============================================
// GET ALL ALERTS (Admin only)
// ============================================
const getAllAlerts = async (req, res) => {
  const pool = getPool();
  try {
    const { severity, is_resolved, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM admin_alerts WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    
    if (is_resolved !== undefined) {
      query += ` AND is_resolved = $${paramIndex}`;
      params.push(is_resolved === 'true');
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_alerts WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;
    
    if (severity) {
      countQuery += ` AND severity = $${countParamIndex}`;
      countParams.push(severity);
      countParamIndex++;
    }
    
    if (is_resolved !== undefined) {
      countQuery += ` AND is_resolved = $${countParamIndex}`;
      countParams.push(is_resolved === 'true');
      countParamIndex++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      alerts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
  }
};

// ============================================
// RESOLVE ALERT (Admin only)
// ============================================
const resolveAlert = async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const resolved_by = req.user.id;
    
    const result = await pool.query(
      `UPDATE admin_alerts 
      SET is_resolved = true, resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
      WHERE id = $2
      RETURNING *`,
      [resolved_by, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Erreur lors de la résolution de l\'alerte' });
  }
};

module.exports = {
  logAdminAction,
  getAllLogs,
  getLogById,
  getActivityStats,
  createAlert,
  getAllAlerts,
  resolveAlert
};
