// backend/routes/messages.js - Chat admin-client
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auths');
const { getPool } = require('../database/db');

// ============================================
// ROUTES UTILISATEUR (CLIENT)
// ============================================

/**
 * GET /messages/conversation
 * Obtenir la conversation du client avec l'admin
 */
router.get('/conversation', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.userId;

    // Récupérer tous les messages de la conversation
    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.sender_id,
        cm.receiver_id,
        cm.message,
        cm.is_read,
        cm.created_at,
        u.firstname as sender_firstname,
        u.lastname as sender_lastname,
        u.role as sender_role
      FROM contact_messages cm
      LEFT JOIN users u ON cm.sender_id = u.id
      WHERE cm.sender_id = $1 OR cm.receiver_id = $1
      ORDER BY cm.created_at ASC
    `, [userId]);

    res.json({
      messages: result.rows
    });

  } catch (error) {
    console.error('Erreur récupération conversation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /messages/send
 * Envoyer un message à l'admin
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.userId;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }

    // Trouver un admin (on prend le premier admin disponible)
    const adminResult = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"
    );

    if (adminResult.rows.length === 0) {
      return res.status(500).json({ error: 'Aucun admin disponible' });
    }

    const adminId = adminResult.rows[0].id;

    // Créer le message
    const result = await pool.query(`
      INSERT INTO contact_messages (
        sender_id, 
        receiver_id, 
        message, 
        status,
        created_at
      )
      VALUES ($1, $2, $3, 'sent', CURRENT_TIMESTAMP)
      RETURNING *
    `, [userId, adminId, message.trim()]);

    // Créer une notification pour l'admin
    await pool.query(`
      INSERT INTO user_notifications (
        user_id, 
        title, 
        message, 
        type, 
        related_type, 
        related_id
      )
      VALUES ($1, 'Nouveau message client', $2, 'message', 'message', $3)
    `, [adminId, `Nouveau message de ${req.userEmail}`, result.rows[0].id]);

    res.json({
      success: true,
      message: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /messages/:conversationId/mark-read
 * Marquer les messages comme lus
 */
router.put('/:conversationId/mark-read', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.userId;
    const { conversationId } = req.params;

    await pool.query(`
      UPDATE contact_messages
      SET is_read = true
      WHERE receiver_id = $1 AND id = $2
    `, [userId, conversationId]);

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur marquage lu:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * GET /admin/messages/conversations
 * Obtenir toutes les conversations (liste des clients ayant envoyé des messages)
 */
router.get('/admin/conversations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();

    // Récupérer tous les clients qui ont des messages
    const result = await pool.query(`
      SELECT DISTINCT ON (u.id)
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.avatar_url,
        u.company_name,
        (SELECT COUNT(*) FROM contact_messages WHERE receiver_id = $1 AND sender_id = u.id AND is_read = false) as unread_count,
        (SELECT message FROM contact_messages WHERE (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM contact_messages WHERE (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM contact_messages cm 
        WHERE cm.sender_id = u.id OR cm.receiver_id = u.id
      )
      AND u.role != 'admin'
      ORDER BY u.id, last_message_at DESC NULLS LAST
    `, [req.userId]);

    res.json({
      conversations: result.rows
    });

  } catch (error) {
    console.error('Erreur récupération conversations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /admin/messages/conversations/:userId
 * Obtenir tous les messages avec un utilisateur spécifique
 */
router.get('/admin/conversations/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const adminId = req.userId;
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.sender_id,
        cm.receiver_id,
        cm.message,
        cm.is_read,
        cm.created_at,
        u.firstname as sender_firstname,
        u.lastname as sender_lastname,
        u.role as sender_role
      FROM contact_messages cm
      LEFT JOIN users u ON cm.sender_id = u.id
      WHERE (cm.sender_id = $1 AND cm.receiver_id = $2)
         OR (cm.sender_id = $2 AND cm.receiver_id = $1)
      ORDER BY cm.created_at ASC
    `, [adminId, userId]);

    // Marquer les messages reçus comme lus
    await pool.query(`
      UPDATE contact_messages
      SET is_read = true
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
    `, [adminId, userId]);

    res.json({
      messages: result.rows
    });

  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /admin/messages/conversations/:userId
 * Envoyer un message à un utilisateur
 */
router.post('/admin/conversations/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const adminId = req.userId;
    const { userId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }

    // Créer le message
    const result = await pool.query(`
      INSERT INTO contact_messages (
        sender_id, 
        receiver_id, 
        message, 
        status,
        created_at
      )
      VALUES ($1, $2, $3, 'sent', CURRENT_TIMESTAMP)
      RETURNING *
    `, [adminId, userId, message.trim()]);

    // Créer une notification pour le client
    await pool.query(`
      INSERT INTO user_notifications (
        user_id, 
        title, 
        message, 
        type, 
        related_type, 
        related_id
      )
      VALUES ($1, 'Nouveau message de l''équipe', $2, 'message', 'message', $3)
    `, [userId, message.substring(0, 100), result.rows[0].id]);

    res.json({
      success: true,
      message: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
