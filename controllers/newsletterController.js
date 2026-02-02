// backend/controllers/newsletterController.js
const { getPool } = require('../database/db');
const { sendEmail } = require('../services/emailService');

// ============================================
// SUBSCRIBE TO NEWSLETTER (Public)
// ============================================
const subscribe = async (req, res) => {
  const pool = getPool();
  try {
    const { email, firstname, lastname, subscription_source = 'website' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    // Get IP and user agent
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    
    // Check if already subscribed
    const existing = await pool.query(
      'SELECT * FROM newsletter_subscribers WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      const subscriber = existing.rows[0];
      
      if (subscriber.status === 'active') {
        return res.status(400).json({ error: 'Cet email est déjà inscrit à la newsletter' });
      }
      
      // Reactivate if was unsubscribed
      const result = await pool.query(
        `UPDATE newsletter_subscribers 
        SET status = 'active', subscribed_at = CURRENT_TIMESTAMP, unsubscribed_at = NULL
        WHERE email = $1
        RETURNING *`,
        [email]
      );
      
      return res.json({
        message: 'Réinscription réussie à la newsletter',
        subscriber: result.rows[0]
      });
    }
    
    // New subscription
    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (
        email, firstname, lastname, status, subscription_source, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [email, firstname, lastname, 'active', subscription_source, ip_address, user_agent]
    );
    
    // Send welcome email
    try {
      await sendEmail({
        to: email,
        toName: firstname ? `${firstname} ${lastname || ''}`.trim() : email,
        subject: 'Bienvenue à la newsletter LE SAGE DEV',
        html: `
          <h2>Bienvenue !</h2>
          <p>Merci de vous être inscrit à notre newsletter.</p>
          <p>Vous recevrez régulièrement nos dernières actualités, conseils et offres exclusives.</p>
        `,
        emailType: 'newsletter_welcome'
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }
    
    res.status(201).json({
      message: 'Inscription réussie à la newsletter',
      subscriber: result.rows[0]
    });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Cet email est déjà inscrit' });
    }
    res.status(500).json({ error: 'Erreur lors de l\'inscription à la newsletter' });
  }
};

// ============================================
// UNSUBSCRIBE FROM NEWSLETTER (Public)
// ============================================
const unsubscribe = async (req, res) => {
  const pool = getPool();
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    const result = await pool.query(
      `UPDATE newsletter_subscribers 
      SET status = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP
      WHERE email = $1 AND status = 'active'
      RETURNING *`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Abonnement non trouvé' });
    }
    
    res.json({
      message: 'Désinscription réussie de la newsletter',
      subscriber: result.rows[0]
    });
  } catch (error) {
    console.error('Error unsubscribing from newsletter:', error);
    res.status(500).json({ error: 'Erreur lors de la désinscription de la newsletter' });
  }
};

// ============================================
// GET ALL SUBSCRIBERS (Admin only)
// ============================================
const getAllSubscribers = async (req, res) => {
  const pool = getPool();
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM newsletter_subscribers WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY subscribed_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM newsletter_subscribers 
      ${status ? `WHERE status = '${status}'` : ''}
    `;
    const countResult = await pool.query(countQuery);
    
    res.json({
      subscribers: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des abonnés' });
  }
};

// ============================================
// SEND NEWSLETTER (Admin only)
// ============================================
const sendNewsletter = async (req, res) => {
  const pool = getPool();
  try {
    const { subject, html, test_mode = false, test_email } = req.body;
    
    if (!subject || !html) {
      return res.status(400).json({ error: 'Sujet et contenu HTML requis' });
    }
    
    // Test mode: send to test email only
    if (test_mode) {
      if (!test_email) {
        return res.status(400).json({ error: 'Email de test requis en mode test' });
      }
      
      await sendEmail({
        to: test_email,
        subject: `[TEST] ${subject}`,
        html,
        emailType: 'newsletter_test'
      });
      
      return res.json({
        message: 'Newsletter de test envoyée',
        test_email
      });
    }
    
    // Get all active subscribers
    const result = await pool.query(
      'SELECT email, firstname, lastname FROM newsletter_subscribers WHERE status = $1',
      ['active']
    );
    
    const subscribers = result.rows;
    
    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'Aucun abonné actif' });
    }
    
    // Send to all subscribers (in production, use a queue like Bull or AWS SQS)
    const sendPromises = subscribers.map(subscriber =>
      sendEmail({
        to: subscriber.email,
        toName: subscriber.firstname ? `${subscriber.firstname} ${subscriber.lastname || ''}`.trim() : subscriber.email,
        subject,
        html,
        emailType: 'newsletter'
      }).catch(error => {
        console.error(`Error sending to ${subscriber.email}:`, error);
        return { error: true, email: subscriber.email };
      })
    );
    
    const results = await Promise.allSettled(sendPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const failCount = results.length - successCount;
    
    // Update last_email_sent_at for successful sends
    await pool.query(
      'UPDATE newsletter_subscribers SET last_email_sent_at = CURRENT_TIMESTAMP WHERE status = $1',
      ['active']
    );
    
    res.json({
      message: 'Newsletter envoyée',
      total_subscribers: subscribers.length,
      success_count: successCount,
      fail_count: failCount
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la newsletter' });
  }
};

// ============================================
// GET NEWSLETTER STATS (Admin only)
// ============================================
const getStats = async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE subscribed_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as new_last_30_days
      FROM newsletter_subscribers
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  sendNewsletter,
  getStats
};
