// bot/routes/onboarding.js
const express                   = require('express');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { auth, rl }              = require('../middleware/auth');
const { resolveGuild }          = require('../middleware/resolveGuild');
const supabase                  = require('../services/supabase');
const { postOnboardingPanel }   = require('../services/onboarding');
const { updateLeaderboard }     = require('../jobs/leaderboard');
const { postMVP }               = require('../jobs/mvp');
const { postTournamentResults } = require('../jobs/tournament-results');

const router = express.Router();

// ONBOARDING — POSTER PANEL
router.post('/onboarding/post', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id, ...payload } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    await postOnboardingPanel(channel, payload);
    res.json({ success: true, message: 'Panel onboarding envoyé !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ONBOARDING — TEST
router.post('/onboarding/test', auth, rl.strict, async (req, res) => {
  try {
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const getConf = k => configs?.find(c => c.key === k)?.value;

    const obChannelId = getConf('ob_channel');
    if (!obChannelId) return res.status(400).json({ error: "Salon d'onboarding non configuré" });

    const obChannel = guild.channels.cache.get(obChannelId);
    if (!obChannel) return res.status(404).json({ error: 'Salon introuvable' });

    const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!owner) return res.status(404).json({ error: 'Impossible de récupérer le fondateur' });

    const welcomeTitle = getConf('ob_welcome_title') || `👋 Bienvenue sur ${guild.name} !`;
    const welcomeDesc  = (getConf('ob_welcome_desc') || 'Tu es sur le point de rejoindre notre communauté.\n\nClique sur le bouton ci-dessous pour commencer ton inscription.')
      .replace(/{user}/g,    owner.user.username)
      .replace(/{server}/g,  guild.name)
      .replace(/{mention}/g, owner.toString());

    const registerUrl = getConf('ob_register_url') || `https://warstack-v2.vercel.app/register-public.html?guild=${guild.id}`;

    const embed = new EmbedBuilder()
      .setTitle(`🧪 [TEST] ${welcomeTitle}`)
      .setDescription(welcomeDesc)
      .setColor(0xFF6B35)
      .setThumbnail(owner.user.displayAvatarURL({ extension: 'png', size: 256 }))
      .addFields(
        { name: '📋 Étapes', value: '1️⃣ Règlement → 2️⃣ Pseudo → 3️⃣ Équipe → 4️⃣ Plateforme → 5️⃣ Jeux → 6️⃣ Tracker', inline: false },
        { name: '⚠️ Test',   value: 'Ceci est un message de test.', inline: false },
      )
      .setFooter({ text: `WARSTACK • Test — ${guild.name}`, iconURL: guild.iconURL({ extension: 'png', size: 256 }) || undefined })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("🚀 Commencer l'inscription").setURL(registerUrl).setStyle(ButtonStyle.Link)
    );

    await obChannel.send({
      content   : `${owner.toString()} *(simulation d'arrivée d'un nouveau membre)*`,
      embeds    : [embed],
      components: [row],
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ONBOARDING — APPROUVER
router.post('/onboarding/approve', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id } = req.body;
    if (!discord_id) return res.status(400).json({ success: false, error: 'discord_id manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ success: false, error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.status(404).json({ success: false, error: 'Membre introuvable' });

    const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const getConf = k => configs?.find(c => c.key === k)?.value;

    const unverifiedRoleId = getConf('ob_role_unverified');
    if (unverifiedRoleId) { const r = guild.roles.cache.get(unverifiedRoleId); if (r) await member.roles.remove(r).catch(() => {}); }

    const memberRoleId = getConf('ob_role_member');
    if (memberRoleId) { const r = guild.roles.cache.get(memberRoleId); if (r) await member.roles.add(r).catch(() => {}); }

    await supabase.from('onboarding_sessions')
      .update({ manual_status: 'approved', reviewed_by: 'dashboard' })
      .eq('guild_id', guild.id).eq('discord_id', discord_id);

    const { data: session } = await supabase.from('onboarding_sessions').select('*')
      .eq('guild_id', guild.id).eq('discord_id', discord_id).single().catch(() => ({ data: null }));

    await supabase.from('onboarding_logs').insert({
      guild_id  : guild.id,
      discord_id,
      username  : member.user.username,
      avatar_url: member.user.displayAvatarURL({ size: 64 }),
      pseudo    : session?.pseudo   || null,
      team      : session?.team     || null,
      platform  : session?.platform || null,
      games     : session?.games    || null,
      age       : session?.age      || null,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    const obChanId = getConf('ob_channel');
    if (obChanId) {
      const obChan = guild.channels.cache.get(obChanId);
      if (obChan) {
        const confirmMsg = (getConf('ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️')
          .replace(/{mention}/g, `<@${discord_id}>`)
          .replace(/{user}/g,    member.user.username)
          .replace(/{server}/g,  guild.name);
        await obChan.send(confirmMsg).catch(() => {});
      }
    }

    const dmEnabled = getConf('ob_dm_enabled') === 'true';
    const dmMsg     = getConf('ob_dm_msg') || '';
    if (dmEnabled && dmMsg) {
      const filled = dmMsg
        .replace(/{user}/g,     member.user.username)
        .replace(/{server}/g,   guild.name)
        .replace(/{pseudo}/g,   session?.pseudo   || member.user.username)
        .replace(/{team}/g,     session?.team     || '—')
        .replace(/{platform}/g, session?.platform || '—')
        .replace(/{games}/g,    session?.games    || '—');
      await member.send(filled).catch(() => {});
    }

    await supabase.from('audit_logs').insert({
      guild_id   : guild.id,
      type       : 'member',
      action     : 'onboarding_approved',
      author_id  : 'dashboard',
      author_name: 'Dashboard',
      extra      : { discord_id, pseudo: session?.pseudo, team: session?.team },
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ONBOARDING — REJETER
router.post('/onboarding/reject', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id, reason } = req.body;
    if (!discord_id) return res.status(400).json({ success: false, error: 'discord_id manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ success: false, error: 'Guild introuvable' });

    await supabase.from('onboarding_sessions')
      .update({ manual_status: 'rejected', reviewed_by: 'dashboard' })
      .eq('guild_id', guild.id).eq('discord_id', discord_id);

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (member && reason) {
      await member.send(`❌ Ta demande d'inscription sur **${guild.name}** a été refusée.\nRaison : ${reason}`).catch(() => {});
    }

    await supabase.from('audit_logs').insert({
      guild_id   : guild.id,
      type       : 'member',
      action     : 'onboarding_rejected',
      author_id  : 'dashboard',
      author_name: 'Dashboard',
      extra      : { discord_id, reason: reason || null },
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SETUP — SCAN GUILD
router.get('/setup/scan/:guild_id', auth, rl.standard, async (req, res) => {
  try {
    const guild = global.botClient.guilds.cache.get(req.params.guild_id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    if (guild.members.cache.size < 2) await guild.members.fetch({ limit: 100 }).catch(() => {});

    const everyonePerms = guild.roles.everyone.permissions.bitfield;
    const privileged = [];
    guild.members.cache.forEach(member => {
      if (member.user.bot) return;
      const memberPerms = member.permissions.bitfield;
      if (memberPerms > everyonePerms) {
        privileged.push({
          discord_id: member.user.id,
          username  : member.user.username,
          display   : member.displayName,
          avatar    : member.user.displayAvatarURL({ size: 64, extension: 'png' }),
          perm_score: Number(memberPerms),
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

    await supabase.from('guild_channels').delete().eq('guild_id', req.params.guild_id);
    if (channels.length) await supabase.from('guild_channels').insert(channels.map(c => ({ guild_id: req.params.guild_id, channel_id: c.id, name: c.name, category: c.category })));

    await supabase.from('guild_roles').delete().eq('guild_id', req.params.guild_id);
    if (roles.length) await supabase.from('guild_roles').insert(roles.map(r => ({ guild_id: req.params.guild_id, role_id: r.id, name: r.name, color: r.color })));

    res.json({ success: true, privileged, channels, roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SETUP — INSTALL
router.post('/setup/install', auth, rl.strict, async (req, res) => {
  try {
    const { guild_id, team, modules } = req.body;
    const guild = global.botClient.guilds.cache.get(guild_id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const created = { channels: [] };

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
          name : ch.name,
          type : ChannelType.GuildText,
          permissionOverwrites: ch.locked ? [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }] : [],
          reason: `WARSTACK — Module ${mod}`,
        });
        created.channels.push(newCh.name);
        await supabase.from('config').upsert({ guild_id, key: `${mod}_channel`, value: newCh.id }, { onConflict: 'guild_id,key' });
      }
    }

    await supabase.from('guilds').update({ setup_complete: true, modules, updated_at: new Date().toISOString() }).eq('guild_id', guild_id);

    const dashChannel = guild.channels.cache.find(c => c.name === 'warstack-dashboard');
    if (dashChannel) {
      const messages = await dashChannel.messages.fetch({ limit: 10 });
      await Promise.all(messages.filter(m => m.author.id === global.botClient.user.id).map(m => m.delete().catch(() => {})));

      const embed = new EmbedBuilder()
        .setTitle('✅ WARSTACK est installé !')
        .setDescription('**Votre serveur est configuré et prêt.**\n\n> Accédez au dashboard pour gérer votre communauté.')
        .setColor(0x00FF66)
        .setFooter({ text: 'WARSTACK • Battlefield 6' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('📊 Accéder au Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(process.env.DASHBOARD_URL || 'https://warstack-v2.vercel.app')
      );

      await dashChannel.send({ embeds: [embed], components: [row] });
    }

    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TOURNOI — RÉSULTATS
router.post('/tournament/results', auth, rl.strict, async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id manquant' });
    await postTournamentResults(global.botClient, tournament_id);
    res.json({ success: true, message: 'Résultats postés !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LEADERBOARD GLOBAL
router.post('/leaderboard', auth, rl.strict, async (req, res) => {
  try {
    await updateLeaderboard(global.botClient);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LEADERBOARD TOURNOI
router.post('/leaderboard/tournament', auth, rl.strict, async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id manquant' });
    // Fonction inline (était dans api.js)
    const { data: tournoi } = await supabase.from('tournaments').select('*').eq('id', tournament_id).single();
    if (!tournoi) return res.status(404).json({ error: 'Tournoi introuvable' });

    const guild = tournoi.guild_id ? global.botClient.guilds.cache.get(tournoi.guild_id) : null;
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const channel = guild.channels.cache.find(c => c.name === 'tournoi-live');
    if (!channel) return res.status(404).json({ error: 'Salon #tournoi-live introuvable' });

    const { data: scores } = await supabase.from('tournament_scores').select('*')
      .eq('tournament_id', tournament_id).order('total_score', { ascending: false });

    if (!scores?.length) return res.json({ success: true, message: 'Aucun score' });

    const rows = await Promise.all(scores.map(async (s, i) => {
      const { data: player } = await supabase.from('players').select('username, pseudo_bf6').eq('discord_id', s.discord_id).single();
      const name   = player?.pseudo_bf6 || player?.username || s.discord_id;
      const podium = ['🥇', '🥈', '🥉'];
      const rank   = podium[i] || `\`#${i + 1}\``;
      return `${rank} **${name}**\n┗ 🏆 Score: \`${s.total_score}\` • 🎯 Kills: \`${s.total_kills ?? 0}\` • 🎮 Parties: \`${s.games_played ?? 0}\``;
    }));

    const sep = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''} — CLASSEMENT LIVE`)
      .setColor(0xFF6600)
      .setDescription(`${sep}\n` + rows.join(`\n${sep}\n`) + `\n${sep}`)
      .setFooter({ text: '⚔️ WARSTACK • Mis à jour après chaque validation' })
      .setTimestamp();

    const messages    = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(m => m.author.bot && m.embeds?.[0]?.title?.includes('CLASSEMENT LIVE'));
    await Promise.all(botMessages.map(m => m.delete()));
    await channel.send({ embeds: [embed] });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MVP
router.post('/mvp', auth, rl.strict, async (req, res) => {
  try {
    await postMVP(global.botClient);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;