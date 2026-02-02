# 🚀 Backend API - LE SAGE DEV

Backend Express.js avec authentification JWT, paiements Stripe, et validations Zod.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Déploiement](#déploiement)

---

## 🔧 Prérequis

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 14 (via Supabase)
- **npm** ou **yarn**
- **Stripe CLI**: Pour tester les webhooks localement

```bash
node --version  # v18+
npm --version   # v9+
```

---

## 📦 Installation

```bash
# Cloner le repo
git clone <repo-url>

# Aller dans le dossier backend
cd backend

# Installer les dépendances
npm install
```

### Dépendances principales

- **express** - Framework web
- **pg** - Client PostgreSQL
- **jsonwebtoken** - Authentification JWT
- **bcrypt** - Hash des mots de passe
- **zod** - Validation des schémas
- **stripe** - SDK Stripe
- **helmet** - Sécurité headers
- **cors** - CORS
- **nodemailer** - Envoi d'emails
- **cloudinary** - Upload de fichiers

---

## ⚙️ Configuration

### 1. Créer le fichier .env

```bash
cp .env.example .env
```

### 2. Configurer les variables critiques

```env
# Base de données Supabase
DATABASE_URL=postgresql://user:pass@host:5432/database

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRES_IN=7d

# Stripe (CRITIQUE – à récupérer dans le Dashboard Stripe)
STRIPE_SECRET_KEY=<votre_clé_secrète_stripe>
STRIPE_WEBHOOK_SECRET=<votre_webhook_secret>
STRIPE_PUBLISHABLE_KEY=<votre_clé_publique_stripe>

# Email (choisir un provider)
EMAIL_PROVIDER=smtp  # ou resend, sendgrid, mailgun
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Environnement
NODE_ENV=development
PORT=5000
```

### 3. Configuration Stripe

#### Obtenir les clés API

1. Créer un compte sur [stripe.com](https://stripe.com)
2. Aller dans **Developers > API Keys**
3. Copier:
   - **Secret key** (commence par `sk_test_`)
   - **Publishable key** (commence par `pk_test_`)

#### Configurer les webhooks

**Option 1: Stripe CLI (développement local)**

```bash
# Installer Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe
# Linux: voir https://stripe.com/docs/stripe-cli

# Se connecter
stripe login

# Écouter les webhooks localement
stripe listen --forward-to localhost:5000/webhooks/stripe

# Copier le webhook secret affiché dans .env
STRIPE_WEBHOOK_SECRET=<valeur_affichée_par_stripe_listen>
```

**Option 2: Webhooks Stripe (production)**

1. Aller dans **Developers > Webhooks**
2. Cliquer sur **Add endpoint**
3. URL: `https://api.lesagedev.com/webhooks/stripe`
4. Sélectionner les événements:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
5. Copier le **Signing secret** dans `.env`

### 4. Base de données

```bash
# Exécuter le schéma principal
psql $DATABASE_URL < ../supabase/DATABASE_SCHEMA.sql

# Exécuter les tables de paiement
psql $DATABASE_URL < ../database/payment-tables.sql

# Ou via Supabase Dashboard > SQL Editor
# Copier/coller le contenu des fichiers SQL
```

---

## 🚀 Démarrage

### Mode développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

### Mode production

```bash
npm start
```

### Vérifier le statut

```bash
# Health check
curl http://localhost:5000/health

# Test connexion BDD
curl http://localhost:5000/test-db

# Test JWT
curl -H "Authorization: Bearer <token>" http://localhost:5000/test-jwt
```

---

## 🏗️ Architecture

```
backend/
├── routes/                 # Routes Express
│   ├── auth.js            # Authentification
│   ├── payments.js        # Paiements Stripe (NOUVEAU)
│   ├── webhooks.js        # Webhooks Stripe (NOUVEAU)
│   ├── contact.js
│   ├── reservations.js
│   └── admin/
├── controllers/           # Logique métier
│   ├── blogController.js
│   ├── offersController.js
│   └── ...
├── services/              # Services externes
│   ├── stripeService.js   # Service Stripe (MIS À JOUR)
│   ├── emailService.js
│   └── cloudinaryService.js
├── middleware/            # Middlewares
│   ├── auths.js          # Auth JWT
│   ├── zodValidation.js  # Validation Zod (NOUVEAU)
│   ├── security.js
│   ├── rateLimiter.js
│   └── errorHandler.js
├── schemas/               # Schémas Zod (NOUVEAU)
│   ├── authSchemas.js
│   ├── projectSchemas.js
│   ├── stripeSchemas.js
│   ├── reservationSchemas.js
│   └── contactSchemas.js
├── templates/             # Templates emails
│   └── emails/
├── scripts/               # Scripts utilitaires
│   ├── testEmail.js
│   └── testStripe.js     # (NOUVEAU)
└── server.js             # Point d'entrée

```

### Flux de validation Zod

```
Requête HTTP
    ↓
Middleware zodValidation.js
    ↓
Schéma Zod (ex: stripeSchemas.js)
    ↓
✅ Validation OK → req.body nettoyé
❌ Validation KO → 400 + erreurs détaillées
    ↓
Controller/Route
    ↓
Service (Stripe, Email, etc.)
    ↓
Base de données
    ↓
Réponse JSON
```

---

## 🔒 Sécurité

### Validations Zod

Tous les endpoints utilisent des schémas Zod pour valider:

```javascript
// Exemple: Créer un Payment Intent
const createPaymentIntentSchema = z.object({
  amount: z.number().int().positive().max(99999999),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']).default('EUR'),
  paymentType: z.enum(['deposit', 'final', 'subscription', 'invoice', 'custom']),
  // JAMAIS accepter customer ou payment_method du client !
});
```

### Principes de sécurité

✅ **À FAIRE**:
- Toujours valider les inputs avec Zod
- Utiliser `requireAuth` sur les routes protégées
- Vérifier les signatures des webhooks Stripe
- Logger toutes les actions importantes
- Utiliser RLS sur Supabase
- Rate limiting sur les routes sensibles

❌ **NE JAMAIS**:
- Exposer `STRIPE_SECRET_KEY` au client
- Accepter `customer` ou `payment_method` du client
- Faire confiance aux webhooks sans vérifier la signature
- Retourner les erreurs complètes en production
- Commiter les fichiers `.env`

### Headers de sécurité (Helmet)

```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### Rate Limiting

```javascript
// Global: 100 requêtes / 15 min
// Auth: 10 requêtes / 15 min
// Webhooks: Pas de limite (important!)
```

---

## 🧪 Tests

### Tests manuels

#### 1. Tester les paiements

```bash
# Créer un Payment Intent
curl -X POST http://localhost:5000/payments/intent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "EUR",
    "paymentType": "deposit",
    "description": "Test paiement"
  }'
```

#### 2. Tester les webhooks

```bash
# Avec Stripe CLI
stripe trigger payment_intent.succeeded

# Vérifier les logs
tail -f logs/app.log
```

#### 3. Cartes de test Stripe

```
Succès: 4242 4242 4242 4242
Échec: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
Visa débit: 4000 0566 5566 5556
```

Date d'expiration: N'importe quelle date future  
CVC: N'importe quel 3 chiffres  
Code postal: N'importe quel code

### Scripts de test

```bash
# Tester l'envoi d'emails
npm run test-email

# Tester Stripe (à créer)
node scripts/testStripe.js

# Tester la base de données
npm run test-db
```

---

## 📊 Monitoring

### Logs en développement

```bash
# Suivre les logs en temps réel
tail -f logs/app.log

# Filtrer les erreurs
tail -f logs/app.log | grep "ERROR"

# Filtrer les paiements
tail -f logs/app.log | grep "Payment"
```

### Tables de monitoring

```sql
-- Vérifier les paiements récents
SELECT * FROM payment_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Vérifier les événements Stripe
SELECT * FROM stripe_events 
WHERE error IS NOT NULL
ORDER BY created_at DESC;

-- Statistiques des paiements
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) / 100.0 as total_eur
FROM payment_logs
GROUP BY status;
```

### Alertes à surveiller

- Paiements échoués (status = 'failed')
- Webhooks avec erreurs (stripe_events.error IS NOT NULL)
- Tentatives de connexion échouées (login_attempts.success = false)
- Rate limit atteint

---

## 🚢 Déploiement

### Prérequis production

1. ✅ Variables d'environnement configurées
2. ✅ Base de données migrée
3. ✅ Webhooks Stripe configurés
4. ✅ DNS pointant vers le serveur
5. ✅ SSL/TLS activé (HTTPS obligatoire pour Stripe)

### Render.com (recommandé)

```bash
# 1. Créer un nouveau Web Service
# 2. Connecter le repo GitHub
# 3. Configuration:
#    - Build Command: npm install
#    - Start Command: npm start
#    - Environment: Node 18+
# 4. Ajouter les variables d'environnement
# 5. Déployer
```

### Variables d'environnement production

```env
NODE_ENV=production
DATABASE_URL=<supabase-production-url>
JWT_SECRET=<secret-minimum-32-chars>
STRIPE_SECRET_KEY=<clé_live_stripe_dashboard>
STRIPE_WEBHOOK_SECRET=<webhook_secret_production>
EMAIL_PROVIDER=resend  # Render bloque SMTP
RESEND_API_KEY=<votre_resend_api_key>
FRONTEND_URL=https://lesagedev.com
```

### Checklist post-déploiement

- [ ] Vérifier `/health` retourne 200
- [ ] Tester connexion BDD
- [ ] Tester authentification JWT
- [ ] Configurer webhooks Stripe en production
- [ ] Tester un paiement avec carte réelle
- [ ] Vérifier les logs
- [ ] Activer monitoring (Sentry, etc.)

---

## 📚 Documentation

- **API Contracts**: `../docs/API_CONTRACTS.md`
- **Architecture**: `../ARCHITECTURE_COMPLETE.md`
- **Base de données**: `../supabase/DATABASE_SCHEMA.sql`
- **Schéma paiements**: `../database/payment-tables.sql`

### Documentation Stripe

- [Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Checkout](https://stripe.com/docs/payments/checkout)
- [Webhooks](https://stripe.com/docs/webhooks)
- [Testing](https://stripe.com/docs/testing)

---

## 🤝 Collaboration avec autres agents

### Pour Frontend Developer

**Variables nécessaires** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<clé_publique_stripe>
```

**Endpoints principaux**:
- `POST /auth/login` - Connexion
- `POST /payments/intent` - Créer Payment Intent
- `POST /payments/checkout-session` - Créer Checkout Session
- `GET /payments` - Historique paiements

**Stripe côté client**:
```javascript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Confirmer un paiement
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'John Doe' }
  }
});
```

### Pour DevOps

**URLs à exposer**:
- `POST /webhooks/stripe` - Webhook Stripe (CRITICAL)
- Autres routes via HTTPS uniquement

**Variables critiques**:
- `STRIPE_SECRET_KEY` - JAMAIS dans le code
- `STRIPE_WEBHOOK_SECRET` - JAMAIS dans le code
- `JWT_SECRET` - Minimum 32 caractères
- `DATABASE_URL` - Connection pooling activé

**Monitoring**:
- Tables: `payment_logs`, `stripe_events`
- Logs: Filtrer "ERROR", "Payment failed"
- Alertes: Status 5xx, webhooks en erreur

---

## 🐛 Dépannage

### Webhook Stripe ne fonctionne pas

```bash
# Vérifier que le body est en raw
# Dans server.js, AVANT express.json():
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

# Vérifier le secret
echo $STRIPE_WEBHOOK_SECRET

# Tester avec Stripe CLI
stripe listen --forward-to localhost:5000/webhooks/stripe
stripe trigger payment_intent.succeeded
```

### Erreur de validation Zod

```
❌ Validation error: [
  { field: "amount", message: "Expected number, received string" }
]
```

**Solution**: Vérifier le type des données envoyées. Zod est strict!

### Connexion BDD timeout

```bash
# Vérifier l'IP autorisée dans Supabase
# Dashboard > Settings > Database > Network restrictions

# Tester la connexion
psql $DATABASE_URL -c "SELECT 1"
```

---

## 📞 Support

- **Documentation**: Voir `docs/`
- **Issues**: Créer une issue sur GitHub
- **Email**: support@lesagedev.com

---

**Version**: 2.0.0  
**Dernière mise à jour**: Janvier 2026  
**Auteur**: Backend Developer Agent
