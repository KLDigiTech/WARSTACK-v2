const express                   = require('express');
const { ChannelType }           = require('discord.js');
const { EmbedBuilder }          = require('discord.js');
const { updateLeaderboard }     = require('./jobs/leaderboard');
const { postMVP }               = require('./jobs/mvp');
const { postTournamentResults } = require('./jobs/tournament-results');
const supabase                  = require('./services/supabase');
const { postOnboardingPanel }   = require('./services/onboarding');

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

// LEADERBOARD TOURNOI
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
  res.json({
    name        : guild.name,
    icon        : guild.iconURL({ dynamic: true, size: 256 }),
    member_count: guild.memberCount,
    created_at  : guild.createdAt,
  });
});

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

  const { data: tournoi } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournoi) return;

  const { data: scores } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_score', { ascending: false });

  if (!scores?.length) return;

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

// RECHERCHE MEMBRE par username
router.get('/member/search', auth, async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    if (!query || query.length < 2) return res.json({ members: [] });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    await guild.members.fetch();
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
router.post('/role/apply-channels', auth, async (req, res) => {
  try {
    const { role_name, color, channel_ids_allow = [], channel_ids_deny = [] } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name manquant' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { PermissionFlagsBits } = require('discord.js');

    let discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (!discordRole) {
      discordRole = await guild.roles.create({
        name  : role_name,
        color : color ? parseInt(color.replace('#', ''), 16) : 0x95A5A6,
        reason: 'WARSTACK Dashboard — création rôle accès salons'
      });
    }

    for (const channelId of channel_ids_allow) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel.permissionOverwrites.edit(discordRole, { ViewChannel: true });
    }

    for (const channelId of channel_ids_deny) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel.permissionOverwrites.edit(discordRole, { ViewChannel: false });
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

    const wrstackRoles = member.roles.cache.filter(r =>
      r.name !== '@everyone' &&
      !r.managed &&
      r.name !== 'Admin'
    );
    if (wrstackRoles.size) await member.roles.remove(wrstackRoles);
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

// COMPTEUR MEMBRES
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
        type: 2,
        permissionOverwrites: [{ id: guild.roles.everyone, deny: ['Connect'] }]
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

// SUGGESTION — CHANGER STATUT
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
      const channels = guild.channels.cache.filter(c => c.type === 0);
      for (const [, channel] of channels) {
        try {
          const msg = await channel.messages.fetch(suggestions.message_id);
          if (msg) {
            await msg.edit(msg.content + `\n\n${s.emoji} **Statut : ${s.label}**`).catch(() => {});
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
// ── TEST suggestion ───────────────────────────────────────────────────────────
router.post('/suggestion/test', auth, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setTitle('💡 Nouvelle suggestion')
      .setDescription('Ceci est une suggestion de test envoyée depuis le dashboard WARSTACK.')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Auteur',  value: 'Kevin (test)',   inline: true },
        { name: 'Statut',  value: '🟡 En attente',  inline: true },
      )
      .setFooter({ text: 'WARSTACK Suggestions • TEST' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sug_test_up')
        .setLabel('👍 0')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('sug_test_down')
        .setLabel('👎 0')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    await channel.send({ embeds: [embed], components: [row] });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ suggestion/test error:', err.message);
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

    for (const p of participants || []) {
      const member = await guild.members.fetch(p.discord_id).catch(() => null);
      if (member) {
        await member.send(`❌ L'événement **${event?.title}** a été annulé.`).catch(() => {});
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
        await member.send(`📢 **${event_title}**\n\n${message}`).catch(() => {});
        sent++;
      }
    }

    res.json({ success: true, sent });
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

    switch (type) {
      case 'warn':
        await member?.send(`⚠️ Tu as reçu un avertissement sur **${guild.name}**\nRaison : ${reason}`).catch(() => {});
        break;
      case 'mute':
      case 'timeout':
        if (member && duration) await member.timeout(duration * 60 * 1000, reason);
        break;
      case 'kick':
        await member?.kick(reason);
        break;
      case 'ban':
        await guild.members.ban(discord_id, { reason });
        break;
      case 'unban':
        await guild.members.unban(discord_id, reason).catch(() => {});
        await supabase.from('sanctions').update({ active: false }).eq('discord_id', discord_id).eq('type', 'ban');
        break;
    }

    const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const getConfig = (key) => configs?.find(c => c.key === key)?.value;
    const logChannelId = getConfig('mod_logs_channel');

    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      const icons = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨', timeout: '⏰', unban: '✅' };
      if (logChannel) {
        await logChannel.send(
          `${icons[type] || '❓'} **${type.toUpperCase()}** — ${username}\nRaison : ${reason}\nPar : Dashboard`
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

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (member) await member.timeout(null).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ENVOYER PANEL TICKETS
router.post('/ticket/panel', auth, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

    const { data: categories } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('active', true)
      .order('position', { ascending: true });

    const cats = categories && categories.length > 0 ? categories : [
      { id: 'fallback_support', emoji: '🔧', label: 'Support', color: '#5865f2' },
      { id: 'fallback_other',   emoji: '❓', label: 'Autre',   color: '#7fa38a' },
    ];

    const embed = new EmbedBuilder()
      .setTitle('🎫 Support WARSTACK')
      .setDescription('Clique sur le bouton correspondant à ta demande pour ouvrir un ticket.')
      .setColor(0x00ff66)
      .addFields(cats.map(c => ({ name: `${c.emoji} ${c.label}`, value: '\u200b', inline: true })));

    const rows = [];
    const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger, ButtonStyle.Secondary];
    for (let i = 0; i < cats.length; i += 5) {
      const chunk = cats.slice(i, i + 5);
      const row = new ActionRowBuilder().addComponents(
        chunk.map((c, idx) =>
          new ButtonBuilder()
            .setCustomId(`ticket_cat_${c.id}`)
            .setLabel(c.label)
            .setEmoji(c.emoji)
            .setStyle(styles[idx % styles.length])
        )
      );
      rows.push(row);
      if (rows.length >= 4) break;
    }

    await channel.send({ embeds: [embed], components: rows });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FERMER TICKET
router.post('/ticket/close', auth, async (req, res) => {
  try {
    const { ticket_id, channel_id, transcript } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.json({ success: true });

    if (transcript) {
      const messages = await channel.messages.fetch({ limit: 100 });
      const lines = [...messages.values()]
        .reverse()
        .map(m => `[${new Date(m.createdTimestamp).toLocaleString('fr-FR')}] ${m.author.username}: ${m.content}`)
        .join('\n');

      const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
      const logChId = configs?.find(c => c.key === 'ticket_logs_channel')?.value;
      if (logChId) {
        const logCh = guild.channels.cache.get(logChId);
        if (logCh) {
          const { AttachmentBuilder } = require('discord.js');
          const buf = Buffer.from(lines, 'utf-8');
          const att = new AttachmentBuilder(buf, { name: `ticket-${ticket_id}.txt` });
          await logCh.send({ content: `📄 Transcription ticket fermé`, files: [att] });
        }
      }
    }

    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const allMessages = await channel.messages.fetch({ limit: 20 });
      const botMsg = allMessages.find(m => m.author.bot && m.components?.length > 0);
      if (botMsg) {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_take_staff') .setLabel('Pris en charge').setEmoji('✅').setStyle(ButtonStyle.Success)  .setDisabled(true),
          new ButtonBuilder().setCustomId('ticket_take_leader').setLabel('Leader')        .setEmoji('👑').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('ticket_close')      .setLabel('Fermé')         .setEmoji('🔒').setStyle(ButtonStyle.Danger)   .setDisabled(true),
        );
        await botMsg.edit({ components: [disabledRow] });
      }
    } catch {}

    await channel.send('✅ Ce ticket a été fermé par le dashboard. Le salon sera supprimé dans 5 secondes.');
    setTimeout(() => channel.delete().catch(() => {}), 5000);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TRANSCRIPTION MANUELLE
router.post('/ticket/transcript', auth, async (req, res) => {
  try {
    const { ticket_id, channel_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const messages = await channel.messages.fetch({ limit: 100 });
    const lines = [...messages.values()]
      .reverse()
      .map(m => `[${new Date(m.createdTimestamp).toLocaleString('fr-FR')}] ${m.author.username}: ${m.content}`)
      .join('\n');

    const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const logChId = configs?.find(c => c.key === 'ticket_logs_channel')?.value;
    if (logChId) {
      const logCh = guild.channels.cache.get(logChId);
      if (logCh) {
        const { AttachmentBuilder } = require('discord.js');
        const buf = Buffer.from(lines, 'utf-8');
        const att = new AttachmentBuilder(buf, { name: `ticket-${ticket_id}.txt` });
        await logCh.send({ content: `📄 Transcription ticket #${ticket_id}`, files: [att] });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// EMOJIS CUSTOM DU SERVEUR
router.get('/emojis', auth, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const emojis = guild.emojis.cache.map(e => ({
      id    : e.id,
      name  : e.name,
      url   : e.imageURL({ size: 32 }),
      string: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
    }));

    res.json({ emojis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REACTION ROLES — ENVOYER PANEL
router.post('/reaction-roles/send', auth, async (req, res) => {
  try {
    const { menu_id, channel_id, message, type, component, roles } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

    let components = [];

    if (component === 'buttons') {
      const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
      const chunks = [];
      for (let i = 0; i < roles.length; i += 5) chunks.push(roles.slice(i, i + 5));
      for (const chunk of chunks) {
        const row = new ActionRowBuilder().addComponents(
          chunk.map((r, idx) =>
            new ButtonBuilder()
              .setCustomId(`rxrole_${r.roleId}`)
              .setLabel(r.roleName)
              .setEmoji(r.emoji)
              .setStyle(styles[idx % styles.length])
          )
        );
        components.push(row);
        if (components.length >= 4) break;
      }
    } else if (component === 'select') {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rxmenu_${menu_id}`)
          .setPlaceholder('Choisis un rôle...')
          .setMinValues(1)
          .setMaxValues(type === 'multi' ? Math.min(roles.length, 25) : 1)
          .addOptions(roles.map(r => ({
            label : r.roleName,
            value : r.roleId,
            emoji : r.emoji,
          })))
      );
      components.push(row);
    }

    const msg = await channel.send({ content: message, components });

    // Réactions classiques
    if (component === 'reactions') {
      for (const r of roles) {
        await msg.react(r.emoji).catch(() => {});
      }
    }

    // Sauvegarder le message_id
    await supabase
      .from('reaction_menus')
      .update({ message_id: msg.id })
      .eq('id', menu_id);

    res.json({ success: true, message_id: msg.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── ONBOARDING — Poster le panel ──────────────────────
router.post('/onboarding/post', auth, async (req, res) => {
  try {
    const { channel_id, ...payload } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id manquant' });

    const guild   = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    await postOnboardingPanel(channel, payload);
    res.json({ success: true, message: 'Panel onboarding envoyé !' });
  } catch (err) {
    console.error('❌ onboarding/post error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ── TEST ÉVÉNEMENT ────────────────────────────────────────────────────────────
router.post('/event/test', auth, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const now  = new Date();
    const date = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const embed = new EmbedBuilder()
      .setTitle('🎯 Événement TEST — BF6 Tournament')
      .setDescription('Ceci est un événement de test envoyé depuis le dashboard WARSTACK.')
      .setColor(0xFF6B35)
      .addFields(
        { name: '📅 Date',   value: date,        inline: true },
        { name: '⏰ Heure',  value: time,         inline: true },
        { name: '👥 Places', value: '64 places', inline: true },
      )
      .setFooter({ text: 'WARSTACK Events • TEST' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ev_test_present').setLabel('✅ Présent').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('ev_test_maybe').setLabel('❔ Peut-être').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('ev_test_absent').setLabel('❌ Absent').setStyle(ButtonStyle.Danger).setDisabled(true),
    );

    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ event/test error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── MESSAGES RÉCURRENTS — ENVOYER MAINTENANT ──────────────────────────────────
router.post('/message/send-now', auth, async (req, res) => {
  try {
    const { channel_id, content } = req.body;
    if (!channel_id || !content) return res.status(400).json({ error: 'channel_id et content requis' });

    const guild = global.botClient.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    await channel.send(content);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ message/send-now error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
router.get('/setup/scan/:guild_id', auth, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.get(req.params.guild_id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    if (guild.members.cache.size < 2) {
      await guild.members.fetch({ limit: 100 }).catch(() => {});
    }

    const everyonePerms = guild.roles.everyone.permissions.bitfield;
    const privileged = [];

    guild.members.cache.forEach(member => {
      if (member.user.bot) return;
      const memberPerms = member.permissions.bitfield;
      if (memberPerms > everyonePerms) {
        privileged.push({
          discord_id : member.user.id,
          username   : member.user.username,
          display    : member.displayName,
          avatar     : member.user.displayAvatarURL({ size: 64, extension: 'png' }),
          perm_score : Number(memberPerms),
        });
      }
    });

    privileged.sort((a, b) => b.perm_score - a.perm_score);

    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({ id: c.id, name: c.name, category: c.parent?.name || null }));

    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone' && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

    // ── Sauvegarder salons en Supabase ────────────────────────
    await supabase.from('guild_channels').delete().eq('guild_id', req.params.guild_id);
    if (channels.length) {
      await supabase.from('guild_channels').insert(
        channels.map(c => ({
          guild_id  : req.params.guild_id,
          channel_id: c.id,
          name      : c.name,
          category  : c.category,
        }))
      );
    }

    // ── Sauvegarder rôles en Supabase ─────────────────────────
    await supabase.from('guild_roles').delete().eq('guild_id', req.params.guild_id);
    if (roles.length) {
      await supabase.from('guild_roles').insert(
        roles.map(r => ({
          guild_id: req.params.guild_id,
          role_id : r.id,
          name    : r.name,
          color   : r.color,
        }))
      );
    }

    res.json({ success: true, privileged, channels, roles });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SETUP — INSTALL ───────────────────────────────────────────────────────────
router.post('/setup/install', auth, async (req, res) => {
  try {
    const { guild_id, team, modules } = req.body;

    const guild = global.botClient.guilds.cache.get(guild_id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const created = { channels: [] };

    // ── 1. Enregistrer l'équipe en Supabase ──────────────────────
    for (const member of team || []) {
      await supabase.from('team_members').upsert({
        guild_id  : guild_id,
        discord_id: member.discord_id,
        username  : member.username,
        avatar    : member.avatar,
        role      : member.role,
        created_at: new Date().toISOString(),
      }, { onConflict: 'guild_id,discord_id' });
    }

    // ── 2. Créer les salons selon modules activés ────────────────
    const moduleChannels = {
      welcome    : [{ name: 'bienvenue',    locked: true  }],
      tickets    : [{ name: 'tickets',      locked: false }, { name: 'logs-tickets', locked: true }],
      events     : [{ name: 'événements',   locked: true  }, { name: 'inscriptions', locked: false }],
      suggestions: [{ name: 'suggestions',  locked: false }],
      logs       : [{ name: 'logs',         locked: true  }],
      automod    : [{ name: 'logs-automod', locked: true  }],
    };

    for (const mod of modules || []) {
      const chans = moduleChannels[mod] || [];
      for (const ch of chans) {
        const exists = guild.channels.cache.find(c => c.name === ch.name);
        if (exists) continue;
        const newCh = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          permissionOverwrites: ch.locked
            ? [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }]
            : [],
          reason: `WARSTACK — Module ${mod}`
        });
        created.channels.push(newCh.name);

        await supabase.from('config').upsert({
          guild_id: guild_id,
          key     : `${mod}_channel`,
          value   : newCh.id,
        }, { onConflict: 'guild_id,key' });
      }
    }

    // ── 3. Marquer setup terminé ─────────────────────────────────
    await supabase.from('guilds').update({
      setup_complete: true,
      modules       : modules,
      updated_at    : new Date().toISOString(),
    }).eq('guild_id', guild_id);

    // ── 4. Mettre à jour #warstack-dashboard ─────────────────────
    const dashChannel = guild.channels.cache.find(c => c.name === 'warstack-dashboard');
    if (dashChannel) {
      const messages = await dashChannel.messages.fetch({ limit: 10 });
      const botMsgs  = messages.filter(m => m.author.id === global.botClient.user.id);
      await Promise.all(botMsgs.map(m => m.delete().catch(() => {})));

      const embed = new EmbedBuilder()
        .setTitle('✅ WARSTACK est installé !')
        .setDescription(
          '**Votre serveur est configuré et prêt.**\n\n' +
          '> Accédez au dashboard pour gérer votre communauté.'
        )
        .setColor(0x00FF66)
        .setFooter({ text: 'WARSTACK • Battlefield 6' })
        .setTimestamp();

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('📊 Accéder au Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.DASHBOARD_URL || 'https://warstack-v2.vercel.app'}`)
      );

      await dashChannel.send({ embeds: [embed], components: [row] });
    }

    res.json({ success: true, created });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SERVEURS OÙ UN MEMBRE EST ADMIN
router.get('/guilds/:discord_id', auth, async (req, res) => {
  try {
    const discordId = req.params.discord_id;
    const guilds    = [];

    for (const [, guild] of global.botClient.guilds.cache) {
      try {
        await guild.members.fetch();
        const member = guild.members.cache.get(discordId);
        if (!member) continue;

        // Admin si plus de permissions que @everyone
        const everyonePerms = guild.roles.everyone.permissions.bitfield;
        const memberPerms   = member.permissions.bitfield;
        if (memberPerms > everyonePerms) {
          guilds.push({
            guild_id    : guild.id,
            name        : guild.name,
            icon        : guild.iconURL({ size: 128 }),
            member_count: guild.memberCount,
          });
        }
      } catch { continue; }
    }

    res.json({ guilds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;