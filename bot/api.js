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
const { postTournamentResults } = require('./jobs/tournament-results');

router.post('/tournament/results', auth, async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id manquant' });
    await postTournamentResults(global.botClient, tournament_id);
    res.json({ success: true, message: 'Résultats postés !' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/channel/create', auth, async (req, res) => {
  try {
    const { name, type = 0, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name manquant' });

    const guild   = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = await guild.channels.create({
      name,
      type,
      ...(category ? { parent: category } : {})
    });

    res.json({ success: true, channel_id: channel.id, channel_name: channel.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/channels', auth, async (req, res) => {
  try {
    const guild    = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channels = guild.channels.cache
      .filter(c => [0, 2, 4].includes(c.type))
      .map(c => ({
        id      : c.id,
        name    : c.name,
        type    : c.type === 2 ? 'voice' : c.type === 4 ? 'category' : 'text',
        category: c.parent?.name || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/channel/delete', auth, async (req, res) => {
  try {
    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id manquant' });
    const guild   = global.botClient.guilds.cache.first();
    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
    await channel.delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;