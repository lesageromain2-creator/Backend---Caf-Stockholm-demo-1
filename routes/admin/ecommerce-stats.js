/**
 * Routes API - Stats Admin E-commerce
 * GET /admin/ecommerce/stats - Stats dashboard
 * GET /admin/ecommerce/dashboard - Stats + commandes récentes (1 seul appel)
 */

const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { verifyToken, isAdmin } = require('../../middleware/auths');

const defaultStats = () => ({
  totalOrders: 0,
  totalRevenue: 0,
  pendingOrders: 0,
  completedOrders: 0,
  totalProducts: 0,
  activeProducts: 0,
  lowStockProducts: 0,
  totalCustomers: 0,
  revenueGrowth: 0,
  ordersGrowth: 0,
  currentMonthRevenue: 0,
  lastMonthRevenue: 0,
  currentMonthOrders: 0,
  lastMonthOrders: 0,
});

// Exécuter toutes les requêtes stats en parallèle (résilient aux tables manquantes)
async function getStats() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  try {
    const [
      totalOrdersResult,
      totalRevenueResult,
      pendingOrdersResult,
      completedOrdersResult,
      totalProductsResult,
      activeProductsResult,
      lowStockResult,
      distinctUsersResult,
      distinctGuestsResult,
      currentMonthRevenueResult,
      lastMonthRevenueResult,
      currentMonthOrdersResult,
      lastMonthOrdersResult,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM orders'),
      db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = $1', ['paid']),
      db.query('SELECT COUNT(*) as count FROM orders WHERE status IN ($1, $2)', ['pending', 'processing']),
      db.query("SELECT COUNT(*) as count FROM orders WHERE status IN ('delivered', 'completed')"),
      db.query('SELECT COUNT(*) as count FROM products'),
      db.query("SELECT COUNT(*) as count FROM products WHERE status = 'active'"),
      db.query(
        `SELECT COUNT(*) as count FROM products 
         WHERE track_inventory = true AND low_stock_threshold IS NOT NULL 
         AND stock_quantity <= low_stock_threshold AND stock_quantity > 0`
      ).catch(() => ({ rows: [{ count: '0' }] })),
      db.query('SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE user_id IS NOT NULL'),
      db.query(
        'SELECT COUNT(DISTINCT guest_email) as count FROM orders WHERE user_id IS NULL AND guest_email IS NOT NULL AND guest_email != \'\''
      ),
      db.query(
        'SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = $1 AND created_at >= $2',
        ['paid', currentMonthStart]
      ),
      db.query(
        'SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = $1 AND created_at >= $2 AND created_at <= $3',
        ['paid', lastMonthStart, lastMonthEnd]
      ),
      db.query('SELECT COUNT(*) as count FROM orders WHERE created_at >= $1', [currentMonthStart]),
      db.query(
        'SELECT COUNT(*) as count FROM orders WHERE created_at >= $1 AND created_at <= $2',
        [lastMonthStart, lastMonthEnd]
      ),
    ]);

    const totalOrders = parseInt(totalOrdersResult.rows[0]?.count || 0, 10);
    const totalRevenue = parseFloat(totalRevenueResult.rows[0]?.total || 0);
    const pendingOrders = parseInt(pendingOrdersResult.rows[0]?.count || 0, 10);
    const completedOrders = parseInt(completedOrdersResult.rows[0]?.count || 0, 10);
    const totalProducts = parseInt(totalProductsResult.rows[0]?.count || 0, 10);
    const activeProducts = parseInt(activeProductsResult.rows[0]?.count || 0, 10);
    const lowStockProducts = parseInt(lowStockResult.rows[0]?.count || 0, 10);
    const distinctUsers = parseInt(distinctUsersResult.rows[0]?.count || 0, 10);
    const distinctGuests = parseInt(distinctGuestsResult.rows[0]?.count || 0, 10);
    const totalCustomers = distinctUsers + distinctGuests;
    const currentMonthRevenue = parseFloat(currentMonthRevenueResult.rows[0]?.total || 0);
    const lastMonthRevenue = parseFloat(lastMonthRevenueResult.rows[0]?.total || 0);
    const currentMonthOrders = parseInt(currentMonthOrdersResult.rows[0]?.count || 0, 10);
    const lastMonthOrders = parseInt(lastMonthOrdersResult.rows[0]?.count || 0, 10);

    const revenueGrowth = lastMonthRevenue > 0
      ? parseFloat((((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
      : 0;
    const ordersGrowth = lastMonthOrders > 0
      ? parseFloat((((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100).toFixed(1))
      : 0;

    return {
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalCustomers,
      revenueGrowth,
      ordersGrowth,
      currentMonthRevenue,
      lastMonthRevenue,
      currentMonthOrders,
      lastMonthOrders,
    };
  } catch (err) {
    console.error('getStats error:', err.message || err);
    return defaultStats();
  }
}

// ============================================
// GET /admin/ecommerce/stats
// ============================================
router.get('/stats', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /admin/ecommerce/dashboard - Stats + commandes récentes (1 appel)
// ============================================
router.get('/dashboard', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const stats = await getStats();
    let recentOrders = [];
    try {
      const ordersResult = await db.query(
        `SELECT o.id, o.order_number, o.total_amount, o.status, o.payment_status, o.created_at,
                o.guest_email, u.email as user_email
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC
         LIMIT 10`
      );
      recentOrders = ordersResult.rows || [];
    } catch (ordersErr) {
      console.error('Dashboard recentOrders query error:', ordersErr.message || ordersErr);
    }
    res.json({
      success: true,
      stats,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
