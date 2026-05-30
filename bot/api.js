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

// À ajouter dans bot/api.js après la route /guild

// VÉRIF MEMBRE DU SERVEUR
router.get('/member/:discordId', async (req, res) => {
  try {
    const guild  = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ isMember: false });
    const member = await guild.members.fetch(req.params.discordId).catch(() => null);
    res.json({ isMember: !!member, username: member?.user?.username || null });
  } catch (err) {
    res.json({ isMember: false });
  }
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


// DISCORD USER INFO
router.get("/user/:id", auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const user   = await global.botClient.users.fetch(userId);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({
      id       : user.id,
      username : user.username,
      avatar   : user.displayAvatarURL({ size: 128, extension: "png" }),
      tag      : user.tag || user.username,
    });
  } catch (e) {
    res.status(404).json({ error: "Utilisateur introuvable : " + e.message });
  }
});
// ============================================================
// À AJOUTER dans bot/api.js (coller avant module.exports)
// Routes : recherche membre + appliquer permissions salons
// ============================================================

// RECHERCHE MEMBRE par username
router.get('/member/search', auth, async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    if (!query || query.length < 2) return res.json({ members: [] });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    await guild.members.fetch(); // fetch tous les membres
    const members = guild.members.cache
      .filter(m =>
        !m.user.bot &&
        (m.user.username.toLowerCase().includes(query) ||
         m.displayName.toLowerCase().includes(query))
      )
      .map(m => ({
        discord_id : m.user.id,
        username   : m.user.username,
        display    : m.displayName,
        avatar     : m.user.displayAvatarURL({ size: 64, extension: 'png' })
      }))
      .slice(0, 20);

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APPLIQUER PERMISSIONS SALONS pour un rôle Discord
// Reçoit : { discord_role_name, channel_ids_allow, channel_ids_deny }
// Crée le rôle Discord si inexistant, puis applique les overwrites
router.post('/role/apply-channels', auth, async (req, res) => {
  try {
    const { role_name, color, channel_ids_allow = [], channel_ids_deny = [] } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name manquant' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { PermissionFlagsBits } = require('discord.js');

    // Trouve ou crée le rôle Discord
    let discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (!discordRole) {
      discordRole = await guild.roles.create({
        name  : role_name,
        color : color ? parseInt(color.replace('#', ''), 16) : 0x95A5A6,
        reason: 'WARSTACK Dashboard — création rôle accès salons'
      });
    }

    // Applique ViewChannel = allow sur les salons autorisés
    for (const channelId of channel_ids_allow) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel.permissionOverwrites.edit(discordRole, {
        ViewChannel: true
      });
    }

    // Applique ViewChannel = deny sur les salons refusés
    for (const channelId of channel_ids_deny) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel.permissionOverwrites.edit(discordRole, {
        ViewChannel: false
      });
    }

    res.json({ success: true, role_id: discordRole.id, role_name: discordRole.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ASSIGNER RÔLE DISCORD à un membre
router.post('/role/assign', auth, async (req, res) => {
  try {
    const { discord_id, role_name } = req.body;
    if (!discord_id || !role_name) return res.status(400).json({ error: 'Paramètres manquants' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (!discordRole) return res.status(404).json({ error: `Rôle "${role_name}" introuvable sur Discord` });

    // Retire tous les rôles WARSTACK custom (sauf @everyone et rôles système Discord)
    const wrstackRoles = member.roles.cache.filter(r =>
      r.name !== '@everyone' &&
      !r.managed &&
      r.name !== 'Admin' // garde Admin Discord natif si présent
    );
    if (wrstackRoles.size) await member.roles.remove(wrstackRoles);

    // Assigne le nouveau rôle
    await member.roles.add(discordRole);

    res.json({ success: true, member: member.user.username, role: role_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RETIRER RÔLE DISCORD d'un membre
router.post('/role/remove', auth, async (req, res) => {
  try {
    const { discord_id, role_name } = req.body;
    if (!discord_id || !role_name) return res.status(400).json({ error: 'Paramètres manquants' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (discordRole) await member.roles.remove(discordRole);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// LISTE DES RÔLES
router.get('/roles', auth, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });
    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEST MESSAGE BIENVENUE
router.post('/welcome/test', auth, async (req, res) => {
  try {
    const { channel_id, message, dm_message } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const fill = (str) => (str || '')
      .replace(/{mention}/g,     member.toString())
      .replace(/{user}/g,        member.user.username)
      .replace(/{server}/g,      guild.name)
      .replace(/{membercount}/g, guild.memberCount);

    if (channel_id) {
      const channel = guild.channels.cache.get(channel_id);
      if (channel) await channel.send(fill(message) || `Bienvenue ${member} !`);
    }

    if (dm_message) {
      await member.send(fill(dm_message)).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// TEST AUTOROLE
router.post('/autorole/test', auth, async (req, res) => {
  try {
    const { role_ids, dm_enabled, dm_message } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    for (const roleId of role_ids || []) {
      const role = guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role).catch(() => {});
    }

    if (dm_enabled && dm_message) {
      const roleNames = (role_ids || [])
        .map(id => guild.roles.cache.get(id)?.name)
        .filter(Boolean)
        .join(', ');
      const filled = dm_message
        .replace(/{server}/g, guild.name)
        .replace(/{role}/g,   roleNames)
        .replace(/{user}/g,   member.user.username);
      await member.send(filled).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// COMPTEUR MEMBRES — mise à jour du salon vocal
router.post('/counter/update', auth, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { channel_id, format } = req.body;
    const fmt  = format || '👥 Membres : {count}';
    const name = fmt.replace(/{count}/g, guild.memberCount);

    let channel = channel_id ? guild.channels.cache.get(channel_id) : null;

    if (!channel) {
      channel = await guild.channels.create({
        name,
        type: 2, // vocal
        permissionOverwrites: [{
          id  : guild.roles.everyone,
          deny: ['Connect']
        }]
      });
    } else {
      await channel.setName(name);
    }

    res.json({ success: true, channel_id: channel.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// TEST ANNIVERSAIRE
router.post('/birthday/test', auth, async (req, res) => {
  try {
    const { channel_id, message } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const filled = (message || '🎂 Joyeux anniversaire {mention} !')
      .replace(/{mention}/g, member.toString())
      .replace(/{user}/g,    member.user.username)
      .replace(/{age}/g,     '??')
      .replace(/{server}/g,  guild.name);

    const channel = guild.channels.cache.get(channel_id);
    if (channel) await channel.send(filled);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// SUGGESTION — CHANGER STATUT + ÉDITER MESSAGE DISCORD
router.post('/suggestion/status', auth, async (req, res) => {
  try {
    const { suggestion_id, status } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: suggestions } = await supabase
      .from('suggestions')
      .select('*')
      .eq('id', suggestion_id)
      .single();

    if (!suggestions) return res.status(404).json({ error: 'Suggestion introuvable' });

    const statusMap = {
      pending    : { emoji: '🟡', label: 'En attente' },
      reviewing  : { emoji: '🔵', label: 'En analyse' },
      accepted   : { emoji: '🟢', label: 'Acceptée' },
      refused    : { emoji: '🔴', label: 'Refusée' },
      implemented: { emoji: '⚫', label: 'Implémentée' },
    };

    const s = statusMap[status] || { emoji: '❓', label: status };

    if (suggestions.message_id) {
      // Trouver le message dans tous les salons texte
      const channels = guild.channels.cache.filter(c => c.type === 0);
      for (const [, channel] of channels) {
        try {
          const msg = await channel.messages.fetch(suggestions.message_id);
          if (msg) {
            const newContent = msg.content + `\n\n${s.emoji} **Statut : ${s.label}**`;
            await msg.edit(newContent).catch(() => {});
            break;
          }
        } catch {}
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ANNONCER ÉVÉNEMENT
router.post('/event/announce', auth, async (req, res) => {
  try {
    const { event_id, channel_id, title, description, date, time, max } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const msg = await channel.send(
      `🎯 **${title}**\n\n` +
      (description ? `${description}\n\n` : '') +
      `📅 ${dateFormatted} à ${time}\n` +
      (max ? `👥 ${max} places disponibles\n` : '') +
      `\nInscris-toi avec \`/event join\` !`
    );

    await msg.react('✅');
    await msg.react('❔');
    await msg.react('❌');

    await supabase
      .from('events')
      .update({ message_id: msg.id })
      .eq('id', event_id);

    res.json({ success: true, message_id: msg.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ANNULER ÉVÉNEMENT
router.post('/event/cancel', auth, async (req, res) => {
  try {
    const { event_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    const { data: participants } = await supabase
      .from('event_participants')
      .select('discord_id')
      .eq('event_id', event_id)
      .eq('status', 'present');

    // DM tous les participants
    for (const p of participants || []) {
      const member = await guild.members.fetch(p.discord_id).catch(() => null);
      if (member) {
        await member.send(
          `❌ L'événement **${event?.title}** a été annulé.`
        ).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONTACTER PARTICIPANTS
router.post('/event/contact', auth, async (req, res) => {
  try {
    const { discord_ids, message, event_title } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    let sent = 0;
    for (const id of discord_ids || []) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        await member.send(
          `📢 **${event_title}**\n\n${message}`
        ).catch(() => {});
        sent++;
      }
    }

    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RECHERCHE MEMBRE
router.get('/member/search', auth, async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase();
    if (!query) return res.json({ members: [] });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    await guild.members.fetch();

    const members = guild.members.cache
      .filter(m => m.user.username.toLowerCase().includes(query) ||
                   m.displayName.toLowerCase().includes(query))
      .map(m => ({
        id      : m.user.id,
        username: m.user.username,
        avatar  : m.user.displayAvatarURL({ size: 64 }),
      }))
      .slice(0, 10);

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APPLIQUER SANCTION
router.post('/moderation/sanction', auth, async (req, res) => {
  try {
    const { discord_id, username, type, reason, duration } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member && !['ban', 'unban'].includes(type)) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    // Enregistrer en BDD
    const { data: sanction } = await supabase
      .from('sanctions')
      .insert({
        guild_id      : guild.id,
        discord_id,
        username,
        type,
        reason,
        duration      : duration || null,
        moderator_id  : 'dashboard',
        moderator_name: 'Dashboard',
        active        : true,
      })
      .select()
      .single();

    // Appliquer sur Discord
    switch (type) {
      case 'warn':
        await member?.send(`⚠️ Tu as reçu un avertissement sur **${guild.name}**\nRaison : ${reason}`).catch(() => {});
        break;

      case 'mute':
        if (member && duration) {
          await member.timeout(duration * 60 * 1000, reason);
        }
        break;

      case 'timeout':
        if (member && duration) {
          await member.timeout(duration * 60 * 1000, reason);
        }
        break;

      case 'kick':
        await member?.kick(reason);
        break;

      case 'ban':
        await guild.members.ban(discord_id, { reason });
        break;

      case 'unban':
        await guild.members.unban(discord_id, reason).catch(() => {});
        await supabase
          .from('sanctions')
          .update({ active: false })
          .eq('discord_id', discord_id)
          .eq('type', 'ban');
        break;
    }

    // Log dans salon modération
    const { data: configs } = await supabase
      .from('config')
      .select('*')
      .eq('guild_id', guild.id);

    const getConfig = (key) => configs?.find(c => c.key === key)?.value;
    const logChannelId = getConfig('mod_logs_channel');

    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      const icons = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨', timeout: '⏰', unban: '✅' };
      if (logChannel) {
        await logChannel.send(
          `${icons[type] || '❓'} **${type.toUpperCase()}** — ${username}\n` +
          `Raison : ${reason}\n` +
          `Par : Dashboard`
        );
      }
    }

    res.json({ success: true, sanction_id: sanction?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LEVER SANCTION
router.post('/moderation/lift', auth, async (req, res) => {
  try {
    const { discord_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    // Essayer de lever le timeout
    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (member) await member.timeout(null).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;