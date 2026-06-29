// bot/routes/moderation.js
const express          = require('express');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { auth, rl }     = require('../middleware/auth');
const { resolveGuild } = require('../middleware/resolveGuild');
const supabase         = require('../services/supabase');

const router = express.Router();

// APPLIQUER SANCTION
router.post('/moderation/sanction', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id, username, type, reason, duration } = req.body;
    if (!discord_id || !type || !reason) return res.status(400).json({ error: 'Paramètres manquants' });

    const guild = resolveGuild(req);
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
        await supabase.from('sanctions').update({ active: false })
          .eq('guild_id', guild.id).eq('discord_id', discord_id).eq('type', 'ban');
        break;
    }

    const { data: configs } = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const logChannelId = configs?.find(c => c.key === 'mod_logs_channel')?.value;
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
router.post('/moderation/lift', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (member) await member.timeout(null).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TICKET — CRÉER (public)
router.post('/ticket/create-public', rl.strict, async (req, res) => {
  try {
    const { guild_id, discord_id, username, avatar_url, subject, description, category_id } = req.body;
    if (!guild_id || !discord_id || !subject || !description) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    const guild = global.botClient.guilds.cache.get(guild_id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.status(403).json({ error: 'Tu dois être membre du serveur Discord pour ouvrir un ticket.' });

    const { data: existing } = await supabase
      .from('tickets').select('id')
      .eq('guild_id', guild_id).eq('discord_id', discord_id)
      .in('status', ['open', 'in_progress']).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Tu as déjà un ticket ouvert.' });

    const { data: configs }  = await supabase.from('config').select('*').eq('guild_id', guild_id);
    const getConf = (key) => configs?.find(c => c.key === key)?.value;

    const categoryWaitingId = getConf('ticket_category_waiting');
    const staffRoleId       = getConf('ticket_staff_role');
    const leaderRoleId      = getConf('ticket_leader_role');
    const logChId           = getConf('ticket_logs_channel');

    let ticketType = { id: 'public', label: 'Support public', emoji: '🌐' };
    if (category_id) {
      const { data: catData } = await supabase.from('ticket_categories').select('*').eq('id', category_id).single();
      if (catData) ticketType = { id: catData.id, label: catData.label, emoji: catData.emoji };
    }

    const channelName = `ticket-${username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)}-${Date.now().toString().slice(-4)}`;

    const permissionOverwrites = [
      { id: guild.roles.everyone, deny: ['ViewChannel'] },
      { id: member, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ];
    if (staffRoleId) {
      const staffRole = guild.roles.cache.get(staffRoleId);
      if (staffRole) permissionOverwrites.push({ id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] });
    }
    if (leaderRoleId && leaderRoleId !== staffRoleId) {
      const leaderRole = guild.roles.cache.get(leaderRoleId);
      if (leaderRole) permissionOverwrites.push({ id: leaderRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] });
    }

    const ticketChannel = await guild.channels.create({
      name  : channelName,
      type  : 0,
      parent: categoryWaitingId || null,
      permissionOverwrites,
    });

    const { data: ticketData } = await supabase.from('tickets').insert({
      guild_id        : guild_id,
      discord_id,
      username,
      type            : ticketType.id,
      subject,
      channel_id      : ticketChannel.id,
      status          : 'open',
      last_activity_at: new Date().toISOString(),
    }).select().single();

    const embed = new EmbedBuilder()
      .setTitle(`${ticketType.emoji} Ticket — ${subject}`)
      .setColor(0x00ff66)
      .setDescription(description)
      .addFields(
        { name: '👤 Membre',    value: `${username} (<@${discord_id}>)`, inline: true },
        { name: '📂 Catégorie', value: ticketType.label,                  inline: true },
        { name: '🌐 Origine',   value: 'Portail public',                  inline: true },
      )
      .setThumbnail(avatar_url || null)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_take_staff') .setLabel('Prendre en charge').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_take_leader').setLabel('Leader')            .setEmoji('👑').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_close')      .setLabel('Fermer')            .setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ embeds: [embed], components: [row] });

    if (logChId) {
      const logCh = guild.channels.cache.get(logChId);
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setTitle('🎫 Nouveau ticket public').setColor(0x00ff66)
            .addFields(
              { name: 'Membre', value: username,                 inline: true },
              { name: 'Sujet',  value: subject,                  inline: true },
              { name: 'Salon',  value: `<#${ticketChannel.id}>`, inline: true },
            ).setTimestamp()],
        }).catch(() => {});
      }
    }

    res.json({ success: true, channel_id: ticketChannel.id, ticket_id: ticketData?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TICKET — PANEL
router.post('/ticket/panel', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const { data: categories } = await supabase
      .from('ticket_categories').select('*')
      .eq('guild_id', guild.id).eq('active', true)
      .order('position', { ascending: true });

    const cats = categories?.length > 0 ? categories : [
      { id: 'fallback_support', emoji: '🔧', label: 'Support', color: '#5865f2' },
      { id: 'fallback_other',   emoji: '❓', label: 'Autre',   color: '#7fa38a' },
    ];

    const embed = new EmbedBuilder()
      .setTitle('🎫 Support WARSTACK')
      .setDescription('Clique sur le bouton correspondant à ta demande pour ouvrir un ticket.\n\n*Le bouton "Convoquer un membre" est réservé au staff.*')
      .setColor(0x00ff66)
      .addFields(cats.map(c => ({ name: `${c.emoji} ${c.label}`, value: '\u200b', inline: true })));

    const rows  = [];
    const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger, ButtonStyle.Secondary];
    for (let i = 0; i < cats.length; i += 5) {
      const chunk = cats.slice(i, i + 5);
      rows.push(new ActionRowBuilder().addComponents(
        chunk.map((c, idx) =>
          new ButtonBuilder()
            .setCustomId(`ticket_cat_${c.id}`)
            .setLabel(c.label)
            .setEmoji(c.emoji)
            .setStyle(styles[idx % styles.length])
        )
      ));
      if (rows.length >= 3) break;
    }

    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_staff_summon')
        .setLabel('Convoquer un membre (staff)')
        .setEmoji('🗣️')
        .setStyle(ButtonStyle.Secondary)
    ));

    await channel.send({ embeds: [embed], components: rows });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TICKET — FERMER
router.post('/ticket/close', auth, rl.strict, async (req, res) => {
  try {
    const { ticket_id, channel_id, transcript } = req.body;
    const guild = resolveGuild(req);
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
          const att = new AttachmentBuilder(Buffer.from(lines, 'utf-8'), { name: `ticket-${ticket_id}.txt` });
          await logCh.send({ content: '📄 Transcription ticket fermé', files: [att] });
        }
      }
    }

    try {
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

// TICKET — TRANSCRIPTION MANUELLE
router.post('/ticket/transcript', auth, rl.strict, async (req, res) => {
  try {
    const { ticket_id, channel_id } = req.body;
    const guild = resolveGuild(req);
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
        const att = new AttachmentBuilder(Buffer.from(lines, 'utf-8'), { name: `ticket-${ticket_id}.txt` });
        await logCh.send({ content: `📄 Transcription ticket #${ticket_id}`, files: [att] });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;