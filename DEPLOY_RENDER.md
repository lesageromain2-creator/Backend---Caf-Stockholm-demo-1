# Déploiement Render – Backend Le Sage Dev

## Ce qui a été corrigé pour éviter le timeout

1. **Health check `/health`**  
   Répond maintenant **en moins de 3 secondes** (timeout sur la requête DB).  
   Render considère le déploiement comme réussi dès que `GET /health` retourne 200.

2. **Écoute réseau**  
   Le serveur écoute déjà sur `0.0.0.0` et `process.env.PORT` (compatible Render).

## Checklist avant déploiement

### 1. Variables d’environnement (obligatoires)

Dans **Render → Service → Environment** :

| Variable        | Description                          | Exemple (à ne pas committer) |
|-----------------|--------------------------------------|------------------------------|
| `NODE_ENV`      | Environnement                        | `production`                 |
| `DATABASE_URL`  | Chaîne de connexion Supabase/Postgres| `postgresql://...`           |
| `JWT_SECRET`    | Secret JWT (long, aléatoire)         | Au moins 32 caractères      |

Optionnel selon les besoins : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, etc.

### 2. Health check dans Render

- **Health Check Path** : `/health`  
- Ou laisser vide pour utiliser la racine `GET /`.

### 3. Build et start

- **Build Command** : `npm install`  
- **Start Command** : `npm start` (ou `node server.js`)

### 4. Après un déploiement qui timeout

1. Vérifier les **logs** du service (onglet Logs) : crash au démarrage, `DATABASE_URL` / `JWT_SECRET` manquants.  
2. Vérifier que **Health Check Path** = `/health`.  
3. Tester en local : `NODE_ENV=production DATABASE_URL=... JWT_SECRET=... npm start` puis `curl http://localhost:5000/health`.

## Fichiers utiles

- `render.yaml` : Exemple de configuration Render (health path, env, etc.).
