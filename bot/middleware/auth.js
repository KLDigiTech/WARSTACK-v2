// bot/middleware/auth.js
// Middleware centralisé : auth API key + rate limiting simple en mémoire

const API_KEY = process.env.API_KEY;
if (!API_KEY) console.warn('⚠️  API_KEY non définie dans les variables d\'environnement');

// Rate limiting en mémoire (par IP)
const rateLimitStore = new Map();

/**
 * Crée un middleware de rate limiting
 * @param {number} maxRequests - requêtes max par fenêtre
 * @param {number} windowMs    - durée de la fenêtre en ms
 */
function rateLimit(maxRequests = 60, windowMs = 60_000) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count   = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    res.setHeader('X-RateLimit-Limit',     maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset',     Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans un instant.' });
    }

    next();
  };
}

// Nettoyage du store toutes les 5 minutes pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt + 60_000) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

/**
 * Middleware d'authentification par API key
 */
function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// Rate limits prédéfinis
const rl = {
  standard : rateLimit(60,  60_000),   // 60 req/min (routes normales)
  strict   : rateLimit(10,  60_000),   // 10 req/min (routes sensibles)
  public   : rateLimit(20,  60_000),   // 20 req/min (routes publiques sans auth)
};

module.exports = { auth, rateLimit, rl };