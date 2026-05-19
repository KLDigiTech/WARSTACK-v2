const express                   = require('express');
const { ChannelType }           = require('discord.js');
const { EmbedBuilder }          = require('discord.js');
const { updateLeaderboard }     = require('./jobs/leaderboard');
const { postMVP }               = require('./jobs/mvp');
const { postTournamentResults } = require('./jobs/tournament-results');
const supabase                  = require('./services/supabase');

const router  = express.Router();
const API_KEY = process.env.API_KEY || 'warstack-secret-2026';

function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

// STATUS
router.get('/status', (req, res) => {
  res.json({ status: 'online', bot: global.botClient?.user?.tag || 'inconnu', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// LEADERBOARD GLOBAL
router.post('/leaderboard', auth, async (req, res) => {
  try { await updateLeaderboard(global.botClient); res.json({ success: true, message: 'Leaderboard mis à jour !' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// LEADERBOARD TOURNOI — appelé après chaque approbation de soumission
router.post('/leaderboard/tournament', auth, async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id manquant' });

    await postTournamentLeaderboard(global.botClient, tournament_id);
    res.json({ success: true, message: 'Leaderboard tournoi mis à jour !' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MVP
router.post('/mvp', auth, async (req, res) => {
  try { await postMVP(global.botClient); res.json({ success: true, message: 'MVP posté !' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// TRACKER
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

// GUILD
router.get('/guild', async (req, res) => {
  const guild = global.botClient.guilds.cache.first();
  if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
  res.json({ name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }) });
});

// RÉSULTATS TOURNOI
router.post('/tournament/results', auth, async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id manquant' });
    await postTournamentResults(global.botClient, tournament_id);
    res.json({ success: true, message: 'Résultats postés !' });
  } catch (error) {
    res.status(500).json({ error: error.message }); }
});

// SALONS — LISTE
router.get('/channels', auth, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channels = guild.channels.cache
      .filter(c => [
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildCategory
      ].includes(c.type))
      .map(c => ({
        id      : c.id,
        name    : c.name,
        type    : c.type === ChannelType.GuildVoice    ? 'voice'
                : c.type === ChannelType.GuildCategory ? 'category'
                : 'text',
        category: c.parent?.name || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SALONS — CRÉER
router.post('/channel/create', auth, async (req, res) => {
  try {
    const { name, type = 0, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name manquant' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const typeMap = {
      0: ChannelType.GuildText,
      2: ChannelType.GuildVoice,
      4: ChannelType.GuildCategory,
    };

    const channel = await guild.channels.create({
      name,
      type    : typeMap[parseInt(type)] ?? ChannelType.GuildText,
      ...(category ? { parent: category } : {})
    });

    res.json({ success: true, channel_id: channel.id, channel_name: channel.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SALONS — SUPPRIMER
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

// =====================================================
// FONCTION INTERNE — Leaderboard live tournoi
// =====================================================

async function postTournamentLeaderboard(client, tournamentId) {
  const channel = client.channels.cache.find(c => c.name === 'tournoi-live');
  if (!channel) {
    console.log('❌ Salon #tournoi-live introuvable');
    return;
  }

  // Infos tournoi
  const { data: tournoi } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournoi) return;

  // Scores
  const { data: scores } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_score', { ascending: false });

  if (!scores?.length) return;

  // Récupère les usernames depuis players
  const rows = await Promise.all(scores.map(async (s, i) => {
    const { data: player } = await supabase
      .from('players')
      .select('username, pseudo_bf6')
      .eq('discord_id', s.discord_id)
      .single();

    const name   = player?.pseudo_bf6 || player?.username || s.discord_id;
    const podium = ['🥇', '🥈', '🥉'];
    const rank   = podium[i] || `\`#${i + 1}\``;

    return `${rank} **${name}**\n┗ 🏆 Score: \`${s.total_score}\` • 🎯 Kills: \`${s.total_kills ?? 0}\` • 🎮 Parties: \`${s.games_played ?? 0}\``;
  }));

  const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''} — CLASSEMENT LIVE`)
    .setColor(0xFF6600)
    .setDescription(`${separator}\n` + rows.join(`\n${separator}\n`) + `\n${separator}`)
    .setFooter({ text: `⚔️ WARSTACK • Mis à jour après chaque validation` })
    .setTimestamp();

  // Supprime l'ancien message du bot dans #tournoi-live (le dernier embed leaderboard)
  try {
    const messages    = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(m => m.author.bot && m.embeds?.[0]?.title?.includes('CLASSEMENT LIVE'));
    await Promise.all(botMessages.map(m => m.delete()));
  } catch (e) {
    console.log('⚠️ Impossible de supprimer ancien leaderboard:', e.message);
  }

  await channel.send({ embeds: [embed] });
  console.log(`✅ Leaderboard tournoi ${tournoi.name} mis à jour dans #tournoi-live`);
}

module.exports = router;