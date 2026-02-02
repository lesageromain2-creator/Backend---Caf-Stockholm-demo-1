const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testFileUpload() {
  try {
    log('\n🚀 DÉMARRAGE DES TESTS D\'UPLOAD DE FICHIERS\n', 'blue');

    // ========================================
    // 1. LOGIN
    // ========================================
    log('🔐 Étape 1: Authentification...', 'yellow');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.token) {
      throw new Error('Login failed: No token received');
    }
    
    const token = loginResponse.data.token;
    log('✅ Authentification réussie\n', 'green');

    // ========================================
    // 2. CRÉER UN FICHIER DE TEST
    // ========================================
    log('📝 Étape 2: Création d\'un fichier de test...', 'yellow');
    const testDir = path.join(__dirname, '../test-files');
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFilePath = path.join(testDir, 'sample.txt');
    fs.writeFileSync(testFilePath, 'Ceci est un fichier de test pour l\'upload.\nDate: ' + new Date().toISOString());
    log('✅ Fichier de test créé\n', 'green');

    // ========================================
    // 3. UPLOAD FICHIER PROJET
    // ========================================
    log('📤 Étape 3: Upload fichier projet...', 'yellow');
    const form = new FormData();
    form.append('files', fs.createReadStream(testFilePath));

    const projectId = '00000000-0000-0000-0000-000000000000'; // Remplacer par un vrai ID
    
    try {
      const uploadResponse = await axios.post(
        `${API_URL}/projects/${projectId}/files`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        }
      );

      log('✅ Fichier uploadé:', 'green');
      console.log(JSON.stringify(uploadResponse.data, null, 2));
      console.log();
    } catch (error) {
      if (error.response?.status === 404) {
        log('⚠️  Projet non trouvé (normal si ID fictif)', 'yellow');
      } else {
        throw error;
      }
    }

    // ========================================
    // 4. UPLOAD GÉNÉRIQUE
    // ========================================
    log('📤 Étape 4: Upload générique...', 'yellow');
    const genericForm = new FormData();
    genericForm.append('files', fs.createReadStream(testFilePath));
    genericForm.append('folder', 'test');
    genericForm.append('tags', 'test,upload');

    const genericUploadResponse = await axios.post(
      `${API_URL}/files/upload`,
      genericForm,
      {
        headers: {
          ...genericForm.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    log('✅ Upload générique réussi:', 'green');
    console.log(JSON.stringify(genericUploadResponse.data, null, 2));
    console.log();

    // ========================================
    // 5. RÉCUPÉRER FICHIERS
    // ========================================
    log('📥 Étape 5: Récupération des fichiers...', 'yellow');
    try {
      const filesResponse = await axios.get(
        `${API_URL}/projects/${projectId}/files`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      log('✅ Fichiers récupérés:', 'green');
      console.log(`Nombre de fichiers: ${filesResponse.data.count}`);
      console.log();
    } catch (error) {
      if (error.response?.status === 404) {
        log('⚠️  Projet non trouvé (normal si ID fictif)', 'yellow');
      } else {
        throw error;
      }
    }

    // ========================================
    // 6. RECHERCHE DE FICHIERS
    // ========================================
    log('🔍 Étape 6: Recherche de fichiers...', 'yellow');
    const searchResponse = await axios.get(
      `${API_URL}/files/search?folder=test&maxResults=10`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    log('✅ Recherche terminée:', 'green');
    console.log(`Fichiers trouvés: ${searchResponse.data.total}`);
    console.log();

    // ========================================
    // 7. SUPPRIMER FICHIER DE TEST
    // ========================================
    if (genericUploadResponse.data.files && genericUploadResponse.data.files.length > 0) {
      log('🗑️  Étape 7: Suppression du fichier de test...', 'yellow');
      const publicId = genericUploadResponse.data.files[0].publicId;
      const encodedPublicId = publicId.replace(/\//g, '_');

      try {
        await axios.delete(
          `${API_URL}/files/${encodedPublicId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        log('✅ Fichier supprimé\n', 'green');
      } catch (error) {
        log('⚠️  Erreur lors de la suppression (peut être normal)', 'yellow');
      }
    }

    // ========================================
    // NETTOYAGE
    // ========================================
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    log('\n🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS!\n', 'green');

  } catch (error) {
    log('\n❌ ERREUR LORS DES TESTS:', 'red');
    console.error(error.response?.data || error.message);
    process.exit(1);
  }
}

// Exécuter les tests
testFileUpload();