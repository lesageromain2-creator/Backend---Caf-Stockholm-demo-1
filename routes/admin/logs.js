// backend/routes/admin/logs.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auths');
const {
  getAllLogs,
  getLogById,
  getActivityStats,
  createAlert,
  getAllAlerts,
  resolveAlert
} = require('../../controllers/adminLogsController');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// ACTIVITY LOGS ROUTES
// ============================================
router.get('/activity', getAllLogs);
router.get('/activity/stats', getActivityStats);
router.get('/activity/:id', getLogById);

// ============================================
// ALERTS ROUTES
// ============================================
router.get('/alerts', getAllAlerts);
router.post('/alerts', createAlert);
router.post('/alerts/:id/resolve', resolveAlert);

module.exports = router;
