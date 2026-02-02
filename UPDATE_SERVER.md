# 🔄 MISE À JOUR DU SERVER.JS

Ce fichier contient toutes les modifications à apporter au fichier `server.js` pour intégrer les nouvelles routes et middlewares.

## 📦 1. Ajouter les imports des nouvelles routes

Ajouter après les imports existants (ligne ~28):

```javascript
// Nouvelles routes
const blogRoutes = require('./routes/blog');
const offersRoutes = require('./routes/offers');
const testimonialsRoutes = require('./routes/testimonials');
const newsletterRoutes = require('./routes/newsletter');
const paymentsRoutes = require('./routes/payments');
const adminLogsRoutes = require('./routes/admin/logs');
const adminBlogRoutes = require('./routes/admin/blog');
const adminOffersRoutes = require('./routes/admin/offers');
const adminTestimonialsRoutes = require('./routes/admin/testimonials');
const adminNewsletterRoutes = require('./routes/admin/newsletter');
```

## 🛡️ 2. Ajouter les imports des nouveaux middlewares

Ajouter après les imports de services (ligne ~10):

```javascript
// Nouveaux middlewares
const { logger } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { validateRegistration, validateLogin } = require('./middleware/validation');
const { trackIP } = require('./middleware/security');
```

## 🔧 3. Utiliser les nouveaux middlewares

Ajouter après `app.use(express.urlencoded(...))` (ligne ~255):

```javascript
// Logger middleware
app.use(logger);

// Track IP middleware
app.use(trackIP);
```

## 🛣️ 4. Ajouter les nouvelles routes

Remplacer la section routes (ligne ~384-398) par:

```javascript
// ============================================
// ROUTES PUBLIQUES
// ============================================

// Auth routes avec validation
app.use('/auth', authLimiter, authRoutes);

// Main routes
app.use('/settings', settingsRoutes);
app.use('/users', userRoutes);
app.use('/reservations', reservationRoutes);
app.use('/menus', menusRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/categories', categoriesRoutes);
app.use('/dishes', dishesRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/contact', contactRoutes);
app.use('/projects', projectFilesRouter);

// ============================================
// ROUTES NOUVELLES (Blog, Offres, Témoignages, Newsletter)
// ============================================
app.use('/api/blog', blogRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/payments', paymentsRoutes);

// ============================================
// ROUTES ADMIN
// ============================================
app.use('/admin/contact', adminContactRoutes);
app.use('/admin/projects', adminProjectsRoutes);
app.use('/admin/reservations', adminReservationsRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);
app.use('/admin/logs', adminLogsRoutes);
app.use('/admin/blog', adminBlogRoutes);
app.use('/admin/offers', adminOffersRoutes);
app.use('/admin/testimonials', adminTestimonialsRoutes);
app.use('/admin/newsletter', adminNewsletterRoutes);
```

## 🔴 5. Remplacer la gestion d'erreurs 404 et globale

Remplacer les sections 404 et erreurs (lignes ~400-454) par:

```javascript
// ============================================
// GESTION ERREURS 404
// ============================================
app.use(notFoundHandler);

// ============================================
// GESTION ERREURS GLOBALE
// ============================================
app.use(errorHandler);
```

## 📝 6. Mettre à jour les logs de démarrage

Remplacer les logs de routes disponibles (lignes ~469-476) par:

```javascript
console.log('📍 Routes disponibles:');
console.log('  GET  / - Status API');
console.log('  GET  /health - Health check détaillé');
console.log('  GET  /test-db - Test connexion BDD');
console.log('  POST /auth/login - Connexion');
console.log('  POST /auth/register - Inscription');
console.log('  GET  /settings - Paramètres');
console.log('');
console.log('📰 Nouvelles routes:');
console.log('  GET  /api/blog - Articles de blog');
console.log('  GET  /api/offers - Offres de services');
console.log('  GET  /api/testimonials - Témoignages');
console.log('  POST /api/newsletter/subscribe - Inscription newsletter');
console.log('  POST /api/payments/create-payment-intent - Créer un paiement');
console.log('');
console.log('👨‍💼 Routes admin:');
console.log('  GET  /admin/logs/activity - Logs d\'activité');
console.log('  GET  /admin/logs/alerts - Alertes admin');
console.log('  GET  /admin/blog - Gestion blog');
console.log('  GET  /admin/offers - Gestion offres');
console.log('  GET  /admin/testimonials - Gestion témoignages');
console.log('  GET  /admin/newsletter/subscribers - Abonnés newsletter');
console.log('');
```

## ✅ 7. Vérification finale

Après ces modifications, vérifiez que:

1. ✅ Tous les imports sont présents
2. ✅ Toutes les routes sont montées
3. ✅ Les middlewares sont dans le bon ordre
4. ✅ La gestion d'erreurs est en dernière position
5. ✅ Le serveur démarre sans erreur

## 🚀 8. Commandes pour tester

```bash
# Installer les dépendances manquantes
npm install stripe

# Démarrer le serveur
npm run dev

# Tester les nouvelles routes
curl http://localhost:5000/api/blog
curl http://localhost:5000/api/offers
curl http://localhost:5000/api/testimonials
```

## 📊 9. Initialiser la base de données

Avant de démarrer, exécutez le script SQL:

```bash
# Dans Supabase SQL Editor
psql $DATABASE_URL < supabase/schema.sql

# Ou via Prisma
npx prisma db push
npx prisma generate
```
