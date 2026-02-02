// Script pour vérifier les messages dans la base de données
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvé dans .env');
  console.log('💡 Vérifiez que le fichier backend/.env existe et contient DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function checkMessages() {
  try {
    console.log('🔍 Vérification des messages dans la base de données...\n');

    // Compter les messages
    const countResult = await pool.query('SELECT COUNT(*) FROM contact_messages');
    const total = parseInt(countResult.rows[0].count);
    
    console.log(`📊 Total de messages: ${total}\n`);

    if (total === 0) {
      console.log('⚠️ Aucun message trouvé dans la base de données');
      console.log('💡 Pour tester, créez un message via:');
      console.log('   POST http://localhost:5000/contact');
      console.log('   Body: { "name": "Test User", "email": "test@example.com", "subject": "Test", "message": "Hello" }\n');
      return;
    }

    // Récupérer les derniers messages
    const messagesResult = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        subject, 
        status,
        created_at
      FROM contact_messages 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('📧 Derniers messages:\n');
    messagesResult.rows.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.name} <${msg.email}>`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Sujet: ${msg.subject}`);
      console.log(`   Statut: ${msg.status}`);
      console.log(`   Date: ${new Date(msg.created_at).toLocaleString('fr-FR')}`);
      console.log('');
    });

    // Vérifier l'ID spécifique qui pose problème
    const problematicId = 'ac84053e-45cd-4dbb-a1ab-93a14e9c99cc';
    const checkResult = await pool.query(
      'SELECT * FROM contact_messages WHERE id = $1',
      [problematicId]
    );

    console.log(`\n🔍 Vérification de l'ID problématique: ${problematicId}`);
    if (checkResult.rows.length > 0) {
      console.log('✅ Message trouvé !');
      console.log(checkResult.rows[0]);
    } else {
      console.log('❌ Message non trouvé - Cet ID n\'existe pas dans la base');
      console.log('💡 Le frontend essaie d\'accéder à un message qui n\'existe pas');
      console.log('💡 Utilisez un des IDs listés ci-dessus pour tester');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkMessages();
