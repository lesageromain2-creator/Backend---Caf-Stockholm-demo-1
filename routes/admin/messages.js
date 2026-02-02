// backend/routes/admin/messages.js
// Routes pour gérer les conversations de messages (alias pour contact_messages)
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');
const { sendContactReplyEmail } = require('../../utils/emailHelpers');

// Middleware admin pour toutes les routes
router.use(requireAuth, requireAdmin);

// ============================================
// GET /admin/messages - Liste des conversations
// ============================================
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { status, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        cm.*,
        (SELECT COUNT(*) FROM contact_message_replies WHERE message_id = cm.id) as replies_count,
        u.firstname as replied_by_firstname,
        u.lastname as replied_by_lastname
      FROM contact_messages cm
      LEFT JOIN users u ON cm.replied_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND cm.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (cm.name ILIKE $${paramCount} OR cm.email ILIKE $${paramCount} OR cm.subject ILIKE $${paramCount} OR cm.message ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY 
      CASE cm.status 
        WHEN 'new' THEN 1 
        WHEN 'read' THEN 2 
        WHEN 'replied' THEN 3 
        WHEN 'archived' THEN 4 
      END,
      cm.created_at DESC 
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Compter le total
    let countQuery = `SELECT COUNT(*) FROM contact_messages WHERE 1=1`;
    const countParams = [];
    if (status) {
      countQuery += ` AND status = $1`;
      countParams.push(status);
    }
    if (search) {
      countQuery += ` AND (name ILIKE $${countParams.length + 1} OR email ILIKE $${countParams.length + 1} OR subject ILIKE $${countParams.length + 1})`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      conversations: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ Erreur récupération conversations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/messages/user/:userId - Messages d'un utilisateur
// ============================================
router.get('/user/:userId', async (req, res) => {
  try {
    const pool = getPool();
    const { userId } = req.params;

    console.log('📧 Récupération messages de l\'utilisateur:', userId);

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé:', userId);
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé',
        message: 'Cet utilisateur n\'existe pas'
      });
    }

    const user = userCheck.rows[0];

    // Récupérer tous les messages de cet utilisateur
    // On cherche par email car contact_messages n'a pas de user_id direct
    const messagesResult = await pool.query(`
      SELECT 
        cm.*,
        (SELECT COUNT(*) FROM contact_message_replies WHERE message_id = cm.id) as replies_count
      FROM contact_messages cm
      WHERE cm.email = $1
      ORDER BY cm.created_at DESC
    `, [user.email]);

    console.log(`✅ ${messagesResult.rows.length} message(s) trouvé(s) pour ${user.email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname
      },
      messages: messagesResult.rows,
      total: messagesResult.rows.length
    });

  } catch (error) {
    console.error('❌ Erreur récupération messages utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/messages/conversations/:id - Détails conversation
// ============================================
router.get('/conversations/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    console.log('📧 Récupération conversation:', id);

    // Récupérer le message principal
    const messageResult = await pool.query(`
      SELECT 
        cm.*,
        u.firstname as assigned_firstname,
        u.lastname as assigned_lastname,
        u.email as assigned_email
      FROM contact_messages cm
      LEFT JOIN users u ON cm.assigned_to = u.id
      WHERE cm.id = $1
    `, [id]);

    if (messageResult.rows.length === 0) {
      console.log('❌ Message non trouvé:', id);
      return res.status(404).json({ 
        error: 'Conversation non trouvée',
        message: 'Ce message n\'existe pas ou a été supprimé',
        suggestion: 'Retournez à la liste des messages et sélectionnez un message existant'
      });
    }

    const message = messageResult.rows[0];

    // Récupérer toutes les réponses
    const repliesResult = await pool.query(`
      SELECT 
        cmr.*,
        u.firstname,
        u.lastname,
        u.email,
        u.avatar_url
      FROM contact_message_replies cmr
      JOIN users u ON cmr.admin_id = u.id
      WHERE cmr.message_id = $1
      ORDER BY cmr.created_at ASC
    `, [id]);

    // Marquer comme lu si ce n'est pas déjà fait
    if (!message.is_read) {
      await pool.query(`
        UPDATE contact_messages 
        SET is_read = true, status = 'read'
        WHERE id = $1
      `, [id]);
    }

    console.log('✅ Conversation récupérée:', id, 'avec', repliesResult.rows.length, 'réponses');

    res.json({
      conversation: {
        ...message,
        is_read: true,
        status: message.status === 'new' ? 'read' : message.status
      },
      replies: repliesResult.rows
    });

  } catch (error) {
    console.error('❌ Erreur récupération conversation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/messages/conversations/:id/reply - Répondre
// ============================================
router.post('/conversations/:id/reply', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { reply_text } = req.body;
    const adminId = req.userId;

    console.log('📧 Réponse à la conversation:', id);

    // Validation
    if (!reply_text || reply_text.trim() === '') {
      return res.status(400).json({ 
        error: 'Le texte de la réponse est requis' 
      });
    }

    // Vérifier que le message existe
    const messageResult = await pool.query(
      'SELECT * FROM contact_messages WHERE id = $1',
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Conversation non trouvée' 
      });
    }

    const message = messageResult.rows[0];

    // Créer la réponse
    const replyResult = await pool.query(`
      INSERT INTO contact_message_replies (message_id, admin_id, reply_text)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, adminId, reply_text]);

    const reply = replyResult.rows[0];

    // Mettre à jour le message
    await pool.query(`
      UPDATE contact_messages 
      SET replied_at = CURRENT_TIMESTAMP,
          replied_by = $1,
          status = 'replied'
      WHERE id = $2
    `, [adminId, id]);

    // Récupérer les infos admin
    const adminResult = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [adminId]
    );
    const admin = adminResult.rows[0];

    // Log activité
    try {
      await pool.query(`
        INSERT INTO admin_activity_logs (admin_user_id, action, resource_type, resource_id, details)
        VALUES ($1, 'reply_message', 'contact_message', $2, $3)
      `, [
        adminId,
        id,
        JSON.stringify({ message_subject: message.subject })
      ]);
    } catch (logError) {
      console.warn('⚠️ Impossible de logger:', logError.message);
    }

    // Envoyer l'email au client (async, ne pas attendre)
    sendContactReplyEmail(message, reply, admin)
      .then(() => console.log('✅ Email de réponse envoyé'))
      .catch(err => console.error('❌ Erreur envoi email:', err));

    console.log('✅ Réponse enregistrée avec succès');

    res.json({
      success: true,
      reply: {
        ...reply,
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email
      },
      message: 'Réponse envoyée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur envoi réponse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/messages/conversations/:id - Mettre à jour
// ============================================
router.put('/conversations/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { status, priority, assigned_to } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (priority) {
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      params.push(assigned_to || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(id);
    const query = `
      UPDATE contact_messages
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    res.json({
      success: true,
      conversation: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour conversation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /admin/messages/conversations/:id - Supprimer
// ============================================
router.delete('/conversations/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (permanent === 'true') {
      // Supprimer les réponses d'abord
      await pool.query(
        'DELETE FROM contact_message_replies WHERE message_id = $1',
        [id]
      );
      
      // Supprimer le message
      const result = await pool.query(
        'DELETE FROM contact_messages WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      console.log('✅ Conversation supprimée définitivement:', id);
    } else {
      // Archiver seulement
      const result = await pool.query(
        `UPDATE contact_messages SET status = 'archived' WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      console.log('✅ Conversation archivée:', id);
    }

    res.json({
      success: true,
      message: permanent === 'true' ? 'Conversation supprimée' : 'Conversation archivée'
    });

  } catch (error) {
    console.error('❌ Erreur suppression conversation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/messages/user/:userId/send - Envoyer un message à un utilisateur
// ============================================
router.post('/user/:userId/send', async (req, res) => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    const { message, title } = req.body;
    const adminId = req.userId;

    console.log('📧 Envoi message à l\'utilisateur:', userId);

    // Validation
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        error: 'Le message est requis' 
      });
    }

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé'
      });
    }

    const user = userCheck.rows[0];

    // Créer une notification pour l'utilisateur
    const notifResult = await pool.query(`
      INSERT INTO user_notifications (
        user_id, 
        title, 
        message, 
        type,
        related_type
      )
      VALUES ($1, $2, $3, 'info', 'admin_message')
      RETURNING *
    `, [
      userId,
      title || 'Message de l\'administrateur',
      message
    ]);

    console.log('✅ Notification créée:', notifResult.rows[0].id);

    // Log activité admin
    try {
      await pool.query(`
        INSERT INTO admin_activity_logs (admin_user_id, action, resource_type, resource_id, details)
        VALUES ($1, 'send_message', 'user', $2, $3)
      `, [
        adminId,
        userId,
        JSON.stringify({ message: message.substring(0, 100) })
      ]);
    } catch (logError) {
      console.warn('⚠️ Impossible de logger:', logError.message);
    }

    res.json({
      success: true,
      notification: notifResult.rows[0],
      message: 'Message envoyé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur envoi message utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/messages/stats - Statistiques
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_messages,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        COUNT(*) FILTER (WHERE status = 'archived') as archived,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as today,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as this_month
      FROM contact_messages
    `);

    res.json(stats.rows[0]);

  } catch (error) {
    console.error('❌ Erreur stats messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

