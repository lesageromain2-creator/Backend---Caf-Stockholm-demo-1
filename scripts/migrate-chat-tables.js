#!/usr/bin/env node
/**
 * Script de migration : création des tables chat_conversations et chat_messages.
 * À lancer depuis la racine du projet : node backend/scripts/migrate-chat-tables.js
 * Prérequis : .env avec DATABASE_URL (même base que le backend), tables users et client_projects existantes.
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Charger .env (backend/ puis racine du projet)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non définie.');
  console.error('   Définissez DATABASE_URL dans backend/.env (même valeur que pour le serveur).');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../../database/migrate-chat-tables.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('❌ Fichier SQL introuvable:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function run() {
  try {
    console.log('📡 Connexion à la base...');
    const client = await pool.connect();
    try {
      console.log('📄 Exécution de la migration (chat_conversations + chat_messages)...');
      await client.query(sql);
      console.log('✅ Tables chat_conversations et chat_messages créées (ou déjà existantes).');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Erreur migration:', err.message);
    if (err.code === '42P01') {
      console.error('   Une table référencée (users ou client_projects) est absente. Exécutez d\'abord le schéma principal (ex: supabase/DATABASE_SCHEMA.sql).');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('   Vérifiez que la base est accessible et que DATABASE_URL est correcte.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
