// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auths');

/**
 * GET /api/dashboard/stats
 * Récupérer les statistiques du tableau de bord de l'utilisateur
 */
router.get('/stats', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.session.userId;
  
  try {
    // Statistiques utilisateur (à adapter selon vos tables)
    const stats = {
      reservations: 0,
      favorites: 0,
      reviews: 0,
      points: 0,
      upcomingReservations: [],
      recentActivity: []
    };

    // Exemple : Compter les réservations (table à créer)
    // const reservationsResult = await pool.query(
    //   'SELECT COUNT(*) as count FROM reservations WHERE user_id = $1 AND status = $2',
    //   [userId, 'confirmed']
    // );
    // stats.reservations = parseInt(reservationsResult.rows[0].count);

    // Exemple : Compter les favoris (table à créer)
    // const favoritesResult = await pool.query(
    //   'SELECT COUNT(*) as count FROM favorites WHERE user_id = $1',
    //   [userId]
    // );
    // stats.favorites = parseInt(favoritesResult.rows[0].count);

    // Exemple : Compter les avis (table à créer)
    // const reviewsResult = await pool.query(
    //   'SELECT COUNT(*) as count FROM reviews WHERE user_id = $1',
    //   [userId]
    // );
    // stats.reviews = parseInt(reviewsResult.rows[0].count);

    // Exemple : Points de fidélité (table à créer)
    // const pointsResult = await pool.query(
    //   'SELECT points FROM loyalty_points WHERE user_id = $1',
    //   [userId]
    // );
    // stats.points = pointsResult.rows[0]?.points || 0;

    // Pour l'instant, retourner des données simulées
    stats.reservations = 5;
    stats.favorites = 12;
    stats.reviews = 3;
    stats.points = 150;

    stats.upcomingReservations = [
      {
        id: 1,
        date: '2025-01-15',
        time: '19:30',
        guests: 4,
        status: 'confirmed'
      },
      {
        id: 2,
        date: '2025-01-22',
        time: '20:00',
        guests: 2,
        status: 'confirmed'
      }
    ];

    stats.recentActivity = [
      {
        id: 1,
        type: 'reservation',
        description: 'Réservation confirmée',
        details: 'Table pour 4 personnes - 15 janvier 2025 à 19h30',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        icon: 'calendar'
      },
      {
        id: 2,
        type: 'favorite',
        description: 'Nouveau favori ajouté',
        details: 'Filet de bœuf Rossini',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        icon: 'heart'
      },
      {
        id: 3,
        type: 'review',
        description: 'Avis publié',
        details: '5/5 étoiles - "Expérience exceptionnelle !"',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        icon: 'star'
      }
    ];

    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erreur récupération stats dashboard:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques' 
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Récupérer l'activité récente de l'utilisateur
 */
router.get('/activity', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.session.userId;
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    // À implémenter selon votre table d'activité
    const activities = [
      {
        id: 1,
        type: 'reservation',
        description: 'Réservation confirmée',
        details: 'Table pour 4 personnes',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        type: 'favorite',
        description: 'Favori ajouté',
        details: 'Filet de bœuf Rossini',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    res.json(activities.slice(0, limit));
    
  } catch (error) {
    console.error('❌ Erreur récupération activité:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de l\'activité' 
    });
  }
});

/**
 * GET /api/dashboard/overview
 * Récupérer un aperçu complet du dashboard
 */
router.get('/overview', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.session.userId;
  
  try {
    const overview = {
      user: null,
      stats: {},
      upcomingReservations: [],
      recentActivity: [],
      recommendations: []
    };

    // Récupérer les infos utilisateur
    const userResult = await pool.query(
      `SELECT id, firstname, lastname, email, role, avatar_url, 
              email_verified, created_at, last_login 
       FROM users 
       WHERE id = $1`,
      [userId]
    );
    
    overview.user = userResult.rows[0];

    // Stats (données simulées pour l'instant)
    overview.stats = {
      reservations: 5,
      favorites: 12,
      reviews: 3,
      points: 150
    };

    // Réservations à venir (simulées)
    overview.upcomingReservations = [
      {
        id: 1,
        date: '2025-01-15',
        time: '19:30',
        guests: 4,
        status: 'confirmed',
        restaurant: 'Salle principale'
      }
    ];

    // Activité récente (simulée)
    overview.recentActivity = [
      {
        id: 1,
        type: 'reservation',
        description: 'Réservation confirmée',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Recommandations (simulées)
    overview.recommendations = [
      {
        id: 1,
        type: 'dish',
        title: 'Essayez notre nouveau menu',
        description: 'Découvrez nos plats de saison',
        image: '/images/menu-highlight.jpg'
      }
    ];

    res.json(overview);
    
  } catch (error) {
    console.error('❌ Erreur récupération overview:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de l\'aperçu' 
    });
  }
});

/**
 * GET /api/dashboard/admin/stats
 * Statistiques globales (admin uniquement)
 */
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const stats = {};

    // Stats utilisateurs
    const usersResult = await pool.query('SELECT * FROM user_stats');
    stats.users = usersResult.rows[0];

    // Nombre de réservations (à implémenter)
    stats.reservations = {
      total: 0,
      today: 0,
      thisWeek: 0,
      pending: 0
    };

    // Revenus (à implémenter)
    stats.revenue = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0
    };

    // Plats populaires (à implémenter)
    stats.popularDishes = [];

    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erreur récupération stats admin:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques' 
    });
  }
});

/**
 * GET /api/dashboard/notifications
 * Récupérer les notifications de l'utilisateur
 */
router.get('/notifications', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.session.userId;
  
  try {
    // À implémenter selon votre table de notifications
    const notifications = [
      {
        id: 1,
        type: 'reservation',
        title: 'Réservation confirmée',
        message: 'Votre réservation pour le 15 janvier est confirmée',
        read: false,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        type: 'promotion',
        title: 'Offre spéciale',
        message: '20% de réduction sur le menu du jour',
        read: true,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    res.json(notifications);
    
  } catch (error) {
    console.error('❌ Erreur récupération notifications:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des notifications' 
    });
  }
});

/**
 * PUT /api/dashboard/notifications/:id/read
 * Marquer une notification comme lue
 */
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;
  const userId = req.session.userId;
  
  try {
    // À implémenter
    res.json({ 
      message: 'Notification marquée comme lue',
      id
    });
    
  } catch (error) {
    console.error('❌ Erreur màj notification:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la notification' 
    });
  }
});

router.get('/projects', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId;

  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id AND status = 'completed') as completed_milestones,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id) as total_milestones
      FROM client_projects p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/projects/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId;
  const { id } = req.params;

  try {
    // Récupérer le projet
    const projectResult = await pool.query(`
      SELECT p.* 
      FROM client_projects p
      WHERE p.id = $1 AND p.user_id = $2
    `, [id, userId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = projectResult.rows[0];

    // Récupérer les jalons
    const milestonesResult = await pool.query(`
      SELECT * FROM project_milestones
      WHERE project_id = $1
      ORDER BY sequence, due_date
    `, [id]);

    // Récupérer les mises à jour
    const updatesResult = await pool.query(`
      SELECT 
        pu.*,
        u.firstname,
        u.lastname
      FROM project_updates pu
      LEFT JOIN users u ON pu.created_by = u.id
      WHERE pu.project_id = $1
      ORDER BY pu.created_at DESC
    `, [id]);

    // Récupérer les fichiers (exclure les supprimés)
    const filesResult = await pool.query(`
      SELECT 
        pf.*,
        u.firstname as uploaded_by_firstname,
        u.lastname as uploaded_by_lastname
      FROM project_files pf
      LEFT JOIN users u ON pf.user_id = u.id
      WHERE pf.project_id = $1 AND (pf.is_deleted = false OR pf.is_deleted IS NULL)
      ORDER BY pf.created_at DESC
    `, [id]);

    res.json({
      project: {
        ...project,
        milestones: milestonesResult.rows,
        updates: updatesResult.rows,
        files: filesResult.rows
      }
    });

  } catch (error) {
    console.error('Erreur récupération projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;