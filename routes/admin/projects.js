// backend/routes/admin/projects.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');
const { 
  sendProjectCreatedEmail,
  sendProjectUpdateEmail 
} = require('../../utils/emailHelpers');
const { uploadMiddleware, validateFile } = require('../../middleware/fileUpload');
const cloudinaryService = require('../../services/cloudinaryService');
const { FOLDERS } = require('../../config/cloudinary');



router.use(requireAuth, requireAdmin);

// ============================================
// POST /admin/projects - Créer un nouveau projet
// ============================================
router.post('/', async (req, res) => {
  const pool = getPool();
  const {
    title,
    description,
    project_type,
    status = 'discovery',
    user_id,
    start_date,
    estimated_delivery,
    total_price,
    deposit_paid = false,
    final_paid = false,
    images = [],
    send_email = true,
    email_message = ''
  } = req.body;

  try {
    // Validation
    if (!title || !project_type || !user_id) {
      return res.status(400).json({ 
        error: 'Le titre, le type de projet et le client sont requis' 
      });
    }

    // Vérifier que le client existe
    const userResult = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    const client = userResult.rows[0];

    // Créer le projet
    const projectResult = await pool.query(`
      INSERT INTO client_projects (
        user_id, title, description, project_type, status,
        start_date, estimated_delivery, total_price,
        deposit_paid, final_paid, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      user_id, title, description, project_type, status,
      start_date || null, estimated_delivery || null, total_price || null,
      deposit_paid, final_paid
    ]);

    const project = projectResult.rows[0];

    // Ajouter les fichiers/images si fournis
    if (images && images.length > 0) {
      for (const image of images) {
        await pool.query(`
          INSERT INTO project_files (
            project_id, user_id, file_name, file_url, file_type, file_size, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
          project.id,
          req.userId,
          image.publicId || 'unknown',
          image.url || image.secure_url,
          image.format || 'image',
          image.size || 0
        ]);
      }
    }

    // Créer une notification pour le client
    await pool.query(`
      INSERT INTO user_notifications (
        user_id, title, message, type, related_type, related_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [
      user_id,
      'Nouveau projet créé',
      `Votre projet "${title}" a été créé et est maintenant en cours de préparation.`,
      'project_created',
      'project',
      project.id
    ]);

    // Envoyer un email au client si demandé
    if (send_email) {
      try {
        await sendProjectCreatedEmail(project, client);
        
        // Si un message personnalisé est fourni, l'ajouter comme update
        if (email_message && email_message.trim()) {
          await pool.query(`
            INSERT INTO project_updates (
              project_id, created_by, title, message, update_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          `, [
            project.id,
            req.userId,
            'Message de bienvenue',
            email_message,
            'welcome'
          ]);
        }
        
        console.log(`✅ Email de création de projet envoyé à ${client.email}`);
      } catch (emailError) {
        console.error('❌ Erreur envoi email création projet:', emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    }

    console.log(`✅ Projet créé: ${title} (ID: ${project.id}) pour ${client.email}`);

    res.status(201).json({
      success: true,
      message: 'Projet créé avec succès',
      project: {
        ...project,
        client: {
          id: client.id,
          email: client.email,
          firstname: client.firstname,
          lastname: client.lastname
        },
        images_count: images.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur création projet:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création du projet' 
    });
  }
});

// ============================================
// GET /admin/projects - Liste tous les projets
// ============================================
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { status, user_id, assigned_to, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        p.*,
        u.firstname as client_firstname,
        u.lastname as client_lastname,
        u.email as client_email,
        u.company_name as client_company,
        a.firstname as assigned_firstname,
        a.lastname as assigned_lastname,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as tasks_total,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'completed') as tasks_completed,
        (SELECT COUNT(*) FROM project_updates WHERE project_id = p.id) as updates_count,
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
      FROM client_projects p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users a ON p.assigned_to = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (user_id) {
      query += ` AND p.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (assigned_to) {
      query += ` AND p.assigned_to = $${paramCount}`;
      params.push(assigned_to);
      paramCount++;
    }

    if (search) {
      query += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR u.firstname ILIKE $${paramCount} OR u.lastname ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY 
      CASE p.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      p.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Count total
    const countQuery = `SELECT COUNT(*) FROM client_projects WHERE 1=1`;
    const countResult = await pool.query(countQuery);

    res.json({
      projects: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/projects/:id - Détails complets d'un projet
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    // Récupérer le projet
    const projectResult = await pool.query(`
      SELECT 
        p.*,
        u.firstname as client_firstname,
        u.lastname as client_lastname,
        u.email as client_email,
        u.phone as client_phone,
        u.company_name as client_company,
        a.firstname as assigned_firstname,
        a.lastname as assigned_lastname,
        a.email as assigned_email
      FROM client_projects p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users a ON p.assigned_to = a.id
      WHERE p.id = $1
    `, [id]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Récupérer les tâches
    const tasksResult = await pool.query(`
      SELECT 
        t.*,
        u.firstname as assigned_firstname,
        u.lastname as assigned_lastname
      FROM project_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC
    `, [id]);

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

    // Récupérer les fichiers
    const filesResult = await pool.query(`
      SELECT 
        pf.*,
        u.firstname as uploaded_by_firstname,
        u.lastname as uploaded_by_lastname
      FROM project_files pf
      JOIN users u ON pf.user_id = u.id
      WHERE pf.project_id = $1
      ORDER BY pf.created_at DESC
    `, [id]);

    // Récupérer les commentaires
    const commentsResult = await pool.query(`
      SELECT 
        pc.*,
        u.firstname,
        u.lastname,
        u.role
      FROM project_comments pc
      JOIN users u ON pc.author_id = u.id
      WHERE pc.project_id = $1
      ORDER BY pc.created_at DESC
    `, [id]);

    res.json({
      project: projectResult.rows[0],
      tasks: tasksResult.rows,
      milestones: milestonesResult.rows,
      updates: updatesResult.rows,
      files: filesResult.rows,
      comments: commentsResult.rows
    });

  } catch (error) {
    console.error('Erreur récupération projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/:id - Mettre à jour un projet
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { 
      title, 
      description, 
      status, 
      progress, 
      priority,
      assigned_to,
      start_date,
      estimated_delivery,
      notes,
      total_price,
      deposit_paid,
      deposit_amount,
      final_paid,
      staging_url,
      production_url
    } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
      
      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (progress !== undefined) {
      updates.push(`progress = $${paramCount}`);
      params.push(progress);
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

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount}`);
      params.push(start_date);
      paramCount++;
    }

    if (estimated_delivery !== undefined) {
      updates.push(`estimated_delivery = $${paramCount}`);
      params.push(estimated_delivery);
      paramCount++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      params.push(notes);
      paramCount++;
    }

    if (total_price !== undefined) {
      updates.push(`total_price = $${paramCount}`);
      params.push(total_price);
      paramCount++;
    }

    if (deposit_paid !== undefined) {
      updates.push(`deposit_paid = $${paramCount}`);
      params.push(deposit_paid);
      paramCount++;
    }

    if (deposit_amount !== undefined) {
      updates.push(`deposit_amount = $${paramCount}`);
      params.push(deposit_amount);
      paramCount++;
    }

    if (final_paid !== undefined) {
      updates.push(`final_paid = $${paramCount}`);
      params.push(final_paid);
      paramCount++;
    }

    if (staging_url !== undefined) {
      updates.push(`staging_url = $${paramCount}`);
      params.push(staging_url);
      paramCount++;
    }

    if (production_url !== undefined) {
      updates.push(`production_url = $${paramCount}`);
      params.push(production_url);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE client_projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Créer une notification pour le client
    const projectData = result.rows[0];
    await pool.query(`
      INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
      VALUES ($1, $2, $3, 'project_update', 'project', $4)
    `, [
      projectData.user_id,
      'Mise à jour de votre projet',
      `Votre projet "${projectData.title}" a été mis à jour.`,
      id
    ]);

    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description, metadata)
      VALUES ($1, 'update', 'project', $2, 'Mise à jour du projet', $3)
    `, [req.userId, id, JSON.stringify({ status, progress })]);

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /admin/projects/:id - Supprimer un projet
// ============================================
router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  
  try {
    // Vérifier que le projet existe
    const projectResult = await pool.query(
      'SELECT * FROM client_projects WHERE id = $1',
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = projectResult.rows[0];
    
    // Supprimer dans l'ordre pour respecter les contraintes FK
    // 1. Supprimer les fichiers
    await pool.query('DELETE FROM project_files WHERE project_id = $1', [id]);
    
    // 2. Supprimer les commentaires
    await pool.query('DELETE FROM project_comments WHERE project_id = $1', [id]);
    
    // 3. Supprimer les tâches
    await pool.query('DELETE FROM project_tasks WHERE project_id = $1', [id]);
    
    // 4. Supprimer les jalons
    await pool.query('DELETE FROM project_milestones WHERE project_id = $1', [id]);
    
    // 5. Supprimer les mises à jour
    await pool.query('DELETE FROM project_updates WHERE project_id = $1', [id]);
    
    // 6. Supprimer les notifications liées
    await pool.query(
      "DELETE FROM user_notifications WHERE related_type = 'project' AND related_id = $1",
      [id]
    );
    
    // 7. Supprimer le projet
    await pool.query('DELETE FROM client_projects WHERE id = $1', [id]);
    
    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description, metadata)
      VALUES ($1, 'delete', 'project', $2, 'Suppression du projet', $3)
    `, [req.userId, id, JSON.stringify({ title: project.title, user_id: project.user_id })]);
    
    console.log(`🗑️ Projet supprimé: ${project.title} (ID: ${id})`);
    
    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression projet:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du projet' });
  }
});

// ============================================
// POST /admin/projects/:id/tasks - Créer une tâche
// ============================================
router.post('/:id/tasks', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, description, status, priority, assigned_to, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const result = await pool.query(`
      INSERT INTO project_tasks (project_id, title, description, status, priority, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, title, description || null, status || 'todo', priority || 'normal', assigned_to || null, due_date || null]);

    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'create', 'project_task', $2, $3)
    `, [req.userId, result.rows[0].id, `Tâche créée: ${title}`]);

    res.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/tasks/:taskId - Mettre à jour une tâche
// ============================================
router.put('/tasks/:taskId', async (req, res) => {
  try {
    const pool = getPool();
    const { taskId } = req.params;
    const { title, description, status, priority, assigned_to, due_date } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
      
      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
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

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount}`);
      params.push(due_date);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(taskId);
    const query = `
      UPDATE project_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    res.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /admin/projects/tasks/:taskId - Supprimer une tâche
// ============================================
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const pool = getPool();
    const { taskId } = req.params;

    await pool.query('DELETE FROM project_tasks WHERE id = $1', [taskId]);

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur suppression tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/milestones - Créer un jalon
// ============================================
router.post('/:id/milestones', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    // Support des deux noms pour la compatibilité
    const { title, description, target_date, due_date, display_order, sequence } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const result = await pool.query(`
      INSERT INTO project_milestones (project_id, title, description, due_date, sequence)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, title, description || null, due_date || target_date || null, sequence ?? display_order ?? 0]);

    res.json({
      success: true,
      milestone: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création jalon:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/milestones/:milestoneId - Mettre à jour un jalon
// ============================================
router.put('/milestones/:milestoneId', async (req, res) => {
  try {
    const pool = getPool();
    const { milestoneId } = req.params;
    // Support des deux noms pour la compatibilité
    const { title, description, target_date, due_date, is_completed, display_order, sequence, status, progress } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    // Support due_date et target_date
    const dateValue = due_date ?? target_date;
    if (dateValue !== undefined) {
      updates.push(`due_date = $${paramCount}`);
      params.push(dateValue);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (progress !== undefined) {
      updates.push(`progress = $${paramCount}`);
      params.push(progress);
      paramCount++;
    }

    if (is_completed !== undefined) {
      // Utiliser le champ status au lieu de is_completed
      updates.push(`status = $${paramCount}`);
      params.push(is_completed ? 'completed' : 'pending');
      paramCount++;
      
      if (is_completed) {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    // Support sequence et display_order
    const seqValue = sequence ?? display_order;
    if (seqValue !== undefined) {
      updates.push(`sequence = $${paramCount}`);
      params.push(seqValue);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(milestoneId);
    const query = `
      UPDATE project_milestones 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jalon non trouvé' });
    }

    res.json({
      success: true,
      milestone: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour jalon:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/comments - Ajouter un commentaire
// ============================================
router.post('/:id/comments', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { comment, is_internal } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    const result = await pool.query(`
      INSERT INTO project_comments (project_id, author_id, comment, is_internal)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.userId, comment, is_internal || false]);

    // Si commentaire public, notifier le client
    if (!is_internal) {
      const projectResult = await pool.query('SELECT user_id, title FROM client_projects WHERE id = $1', [id]);
      if (projectResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
          VALUES ($1, $2, $3, 'project_update', 'project', $4)
        `, [
          projectResult.rows[0].user_id,
          'Nouveau commentaire sur votre projet',
          `Un commentaire a été ajouté sur "${projectResult.rows[0].title}"`,
          id
        ]);
      }
    }

    res.json({
      success: true,
      comment: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/projects/stats/overview - Statistiques projets
// ============================================
router.get('/stats/overview', async (req, res) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'discovery') as discovery,
        COUNT(*) FILTER (WHERE status = 'design') as design,
        COUNT(*) FILTER (WHERE status = 'development') as development,
        COUNT(*) FILTER (WHERE status = 'testing') as testing,
        COUNT(*) FILTER (WHERE status = 'launched') as launched,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as new_this_month,
        AVG(progress) as avg_progress
      FROM client_projects
      WHERE status NOT IN ('cancelled', 'completed')
    `);

    res.json(stats.rows[0]);

  } catch (error) {
    console.error('Erreur stats projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/files - Upload fichier (multipart)
// ============================================
router.post('/:id/files', uploadMiddleware.array('files', 10), async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { description } = req.body;

    // Vérifier que le projet existe
    const projectCheck = await pool.query(
      'SELECT id, user_id, title FROM client_projects WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = projectCheck.rows[0];

    // Si pas de fichiers dans la requête multipart, vérifier si c'est du JSON
    if (!req.files || req.files.length === 0) {
      // Fallback pour JSON (URL directe)
      const { file_name, file_url, file_type, file_size, mime_type } = req.body;
      
      if (!file_name || !file_url) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const result = await pool.query(`
        INSERT INTO project_files (
          project_id, user_id, file_name, file_url, file_type, file_size, mime_type, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [id, req.userId, file_name, file_url, file_type || 'other', file_size || null, mime_type || 'application/octet-stream', description || null]);

      return res.json({ success: true, file: result.rows[0] });
    }

    // Vérifier si Cloudinary est configuré
    const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                   process.env.CLOUDINARY_API_KEY && 
                                   process.env.CLOUDINARY_API_SECRET &&
                                   process.env.CLOUDINARY_CLOUD_NAME !== 'votre_cloud_name';

    if (!isCloudinaryConfigured) {
      console.error('❌ Cloudinary non configuré - Configurez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET dans .env');
      return res.status(503).json({ 
        error: 'Service de stockage non configuré',
        message: 'Veuillez configurer Cloudinary dans le fichier .env du backend (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
        help: 'Créez un compte gratuit sur https://cloudinary.com'
      });
    }

    // Upload vers Cloudinary et enregistrement en BDD
    const uploadedFiles = [];
    
    for (const file of req.files) {
      try {
        // Déterminer le type de fichier
        const isImage = file.mimetype.startsWith('image/');
        const isDocument = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'].some(t => file.mimetype.includes(t));
        
        // Upload vers Cloudinary
        const cloudinaryResult = await cloudinaryService.uploadFile(file.buffer, {
          folder: `${FOLDERS.PROJECTS}/${id}`,
          resourceType: isImage ? 'image' : 'raw',
          tags: ['project', id, file.originalname]
        });

        // Déterminer le type de fichier pour la BDD
        let fileType = 'other';
        if (isImage) fileType = 'image';
        else if (file.mimetype === 'application/pdf') fileType = 'pdf';
        else if (isDocument) fileType = 'document';

        // Enregistrer en BDD
        const result = await pool.query(`
          INSERT INTO project_files (
            project_id, user_id, file_name, file_url, file_type, file_size, mime_type, description, cloudinary_public_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          id,
          req.userId,
          file.originalname,
          cloudinaryResult.secure_url,
          fileType,
          file.size,
          file.mimetype,
          description || null,
          cloudinaryResult.public_id
        ]);

        uploadedFiles.push(result.rows[0]);

        console.log(`✅ Fichier uploadé: ${file.originalname} -> ${cloudinaryResult.secure_url}`);
      } catch (uploadError) {
        console.error(`❌ Erreur upload ${file.originalname}:`, uploadError);
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({ error: 'Aucun fichier n\'a pu être uploadé. Vérifiez la configuration Cloudinary.' });
    }

    // Notifier le client
    await pool.query(`
      INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
      VALUES ($1, $2, $3, 'project_update', 'project', $4)
    `, [
      project.user_id,
      uploadedFiles.length > 1 ? 'Nouveaux fichiers ajoutés' : 'Nouveau fichier ajouté',
      uploadedFiles.length > 1 
        ? `${uploadedFiles.length} fichiers ont été ajoutés à votre projet "${project.title}"`
        : `Un fichier "${uploadedFiles[0].file_name}" a été ajouté à votre projet "${project.title}"`,
      id
    ]);

    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'create', 'project_file', $2, $3)
    `, [req.userId, id, `${uploadedFiles.length} fichier(s) ajouté(s)`]);

    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    console.error('Erreur upload fichier:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
  
  // ============================================
  // DELETE /admin/projects/files/:fileId - Supprimer fichier
  // ============================================
  router.delete('/files/:fileId', async (req, res) => {
    try {
      const pool = getPool();
      const { fileId } = req.params;
  
      const result = await pool.query(
        'DELETE FROM project_files WHERE id = $1 RETURNING *',
        [fileId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
  
      res.json({ success: true });
  
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  


  
  // ============================================
  // POST /admin/projects/:id/update-message - Envoyer update client
  // ============================================
  router.post('/:id/update-message', async (req, res) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { title, message, update_type } = req.body;
  
      if (!title || !message) {
        return res.status(400).json({ error: 'Titre et message requis' });
      }
  
      const projectCheck = await pool.query(
        'SELECT id, user_id, title FROM client_projects WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Projet non trouvé' });
      }
  
      const project = projectCheck.rows[0];
  
      // Créer l'update
      const updateResult = await pool.query(`
        INSERT INTO project_updates (
          project_id, 
          created_by, 
          title, 
          message, 
          update_type
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [id, req.userId, title, message, update_type || 'info']);
  
      // Notifier le client
      await pool.query(`
        INSERT INTO user_notifications (
          user_id, 
          title, 
          message, 
          type, 
          related_type, 
          related_id
        )
        VALUES ($1, $2, $3, 'project_update', 'project', $4)
      `, [
        project.user_id,
        title,
        message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        id
      ]);
  
      res.json({
        success: true,
        update: updateResult.rows[0]
      });
  
    } catch (error) {
      console.error('Erreur envoi update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  // ============================================
  // DELETE /admin/projects/milestones/:milestoneId - Supprimer jalon
  // ============================================
  router.delete('/milestones/:milestoneId', async (req, res) => {
    try {
      const pool = getPool();
      const { milestoneId } = req.params;
  
      await pool.query('DELETE FROM project_milestones WHERE id = $1', [milestoneId]);
  
      res.json({ success: true });
  
    } catch (error) {
      console.error('Erreur suppression jalon:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ============================================
// EXEMPLE 4 : backend/routes/admin/projects.js
// Mise à jour projet avec email
// ============================================




router.use(requireAuth, requireAdmin);

/**
 * POST /admin/projects/:id/update-message
 * Envoyer une mise à jour au client
 */
router.post('/:id/update-message', async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  const { title, message, update_type } = req.body;

  try {
    // Récupérer le projet
    const projectResult = await pool.query(
      'SELECT * FROM client_projects WHERE id = $1',
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = projectResult.rows[0];

    // Créer l'update en BDD
    const updateResult = await pool.query(`
      INSERT INTO project_updates (project_id, created_by, title, message, update_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, req.userId, title, message, update_type || 'info']);

    const update = updateResult.rows[0];

    // Récupérer infos client
    const userResult = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [project.user_id]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // 🔥 ENVOYER EMAIL DE MISE À JOUR
      sendProjectUpdateEmail(project, user, update).catch(err => {
        console.error('Erreur envoi email update projet:', err);
      });

      // Créer notification
      await pool.query(`
        INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        user.id,
        title,
        message,
        'info',
        'project',
        project.id
      ]);
    }

    res.json({
      message: 'Mise à jour envoyée',
      update
    });

  } catch (error) {
    console.error('Erreur envoi update projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;