const express             = require('express');
const { updateLeaderboard } = require('./jobs/leaderboard');
const { postMVP }         = require('./jobs/mvp');

const router  = express.Router();
const API_KEY = process.env.API_KEY || 'warstack-secret-2026';

function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

router.get('/status', (req, res) => {
  res.json({ status: 'online', bot: global.botClient?.user?.tag || 'inconnu', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.post('/leaderboard', auth, async (req, res) => {
  try { await updateLeaderboard(global.botClient); res.json({ success: true, message: 'Leaderboard mis à jour !' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/mvp', auth, async (req, res) => {
  try { await postMVP(global.botClient); res.json({ success: true, message: 'MVP posté !' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/tracker/:pseudo', async (req, res) => {
  try {
    const pseudo   = encodeURIComponent(req.params.pseudo);
    const response = await fetch(`https://tracker.gg/api/v2/battlefield-2042/standard/profile/psn/${pseudo}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
    });
    if (!response.ok) return res.json({ found: false });
    const data       = await response.json();
    const platformId = data?.data?.platformInfo?.platformUserId || null;
    res.json({ found: true, tracker_id: platformId, username: req.params.pseudo });
  } catch (e) { res.json({ found: false }); }
});

router.get('/guild', async (req, res) => {
  const guild = global.botClient.guilds.cache.first();
  if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
  res.json({ name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }) });
});

module.exports = router;