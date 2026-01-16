// backend/routes/users.js - VERSION JWT
const express = require('express');
const bcrypt = require('bcrypt'); // ✅ UTILISER bcrypt (pas bcryptjs)
const { query, queryOne } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auths'); // ✅ Import JWT middleware

const router = express.Router();

// ============================================
// RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
// ============================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, email, firstname, lastname, phone, role, 
              email_verified, avatar_url, created_at, last_login
       FROM users WHERE id = $1`,
      [req.userId] // ✅ JWT: req.userId au lieu de req.session.userId
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Erreur get user:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Alias pour compatibilité
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, email, firstname, lastname, phone, role, 
              email_verified, avatar_url, created_at, last_login
       FROM users WHERE id = $1`,
      [req.userId] // ✅ JWT
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erreur get profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// METTRE À JOUR LE PROFIL
// ============================================
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { firstname, lastname, phone } = req.body;

    // Validation
    if (!firstname || !lastname) {
      return res.status(400).json({ 
        error: 'Prénom et nom sont requis' 
      });
    }

    await query(
      `UPDATE users 
       SET firstname = $1, lastname = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [firstname, lastname, phone || null, req.userId] // ✅ JWT
    );

    const updatedUser = await queryOne(
      'SELECT id, email, firstname, lastname, phone, role FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    res.json({
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('Erreur update profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Alias pour compatibilité
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { firstname, lastname, phone } = req.body;

    if (!firstname || !lastname) {
      return res.status(400).json({ 
        error: 'Prénom et nom sont requis' 
      });
    }

    await query(
      `UPDATE users 
       SET firstname = $1, lastname = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [firstname, lastname, phone || null, req.userId] // ✅ JWT
    );

    const updatedUser = await queryOne(
      'SELECT id, email, firstname, lastname, phone, role FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    res.json({
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('Erreur update profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// CHANGER LE MOT DE PASSE
// ============================================
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' 
      });
    }

    // Récupérer l'utilisateur
    const user = await queryOne(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.userId] // ✅ JWT
    );

    res.json({ message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error('Erreur change password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Alias pour compatibilité
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' 
      });
    }

    const user = await queryOne(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.userId] // ✅ JWT
    );

    res.json({ message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error('Erreur change password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// SUPPRIMER SON COMPTE
// ============================================
router.delete('/me/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: 'Mot de passe requis pour supprimer le compte' 
      });
    }

    // Vérifier le mot de passe
    const user = await queryOne(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Désactiver le compte plutôt que de le supprimer
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    res.json({ message: 'Compte désactivé avec succès' });
  } catch (error) {
    console.error('Erreur delete account:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Alias pour compatibilité
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: 'Mot de passe requis pour supprimer le compte' 
      });
    }

    const user = await queryOne(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.userId] // ✅ JWT
    );

    res.json({ message: 'Compte désactivé avec succès' });
  } catch (error) {
    console.error('Erreur delete account:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// STATISTIQUES UTILISATEUR
// ============================================
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await queryOne(
      `SELECT 
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_reservations,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations
       FROM reservations
       WHERE user_id = $1`,
      [req.userId] // ✅ JWT
    );

    res.json(stats);
  } catch (error) {
    console.error('Erreur get stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: RÉCUPÉRER TOUS LES UTILISATEURS
// ============================================
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await query(
      `SELECT id, email, firstname, lastname, phone, role, 
              is_active, email_verified, created_at, last_login
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ users });
  } catch (error) {
    console.error('Erreur get all users:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: RÉCUPÉRER UN UTILISATEUR PAR ID
// ============================================
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, email, firstname, lastname, phone, role, 
              is_active, email_verified, created_at, last_login
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erreur get user by id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: SUPPRIMER UN UTILISATEUR
// ============================================
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Vérifier que l'admin ne se supprime pas lui-même
    if (req.params.id === req.userId) { // ✅ JWT
      return res.status(400).json({ 
        error: 'Vous ne pouvez pas supprimer votre propre compte' 
      });
    }

    // Désactiver le compte
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'Utilisateur désactivé avec succès' });
  } catch (error) {
    console.error('Erreur delete user:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: MODIFIER LE RÔLE D'UN UTILISATEUR
// ============================================
router.put('/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'admin', 'staff'].includes(role)) {
      return res.status(400).json({ 
        error: 'Rôle invalide (user, admin ou staff)' 
      });
    }

    await query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [role, req.params.id]
    );

    res.json({ message: 'Rôle mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur update role:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;