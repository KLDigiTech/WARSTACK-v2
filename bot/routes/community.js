// bot/routes/community.js
const express          = require('express');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { auth, rl }     = require('../middleware/auth');
const { resolveGuild } = require('../middleware/resolveGuild');
const supabase         = require('../services/supabase');

const router = express.Router();

// TEST BIENVENUE
router.post('/welcome/test', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id, message, dm_message } = req.body;
    const guild = resolveGuild(req);
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
    if (dm_message) await member.send(fill(dm_message)).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEST AUTOROLE
router.post('/autorole/test', auth, rl.strict, async (req, res) => {
  try {
    const { role_ids, dm_enabled, dm_message } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    for (const roleId of role_ids || []) {
      const role = guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role).catch(() => {});
    }

    if (dm_enabled && dm_message) {
      const roleNames = (role_ids || []).map(id => guild.roles.cache.get(id)?.name).filter(Boolean).join(', ');
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

// TEST ANNIVERSAIRE
router.post('/birthday/test', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id, message } = req.body;
    const guild = resolveGuild(req);
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
router.post('/suggestion/status', auth, rl.standard, async (req, res) => {
  try {
    const { suggestion_id, status } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: suggestion } = await supabase.from('suggestions').select('*').eq('id', suggestion_id).single();
    if (!suggestion) return res.status(404).json({ error: 'Suggestion introuvable' });

    const statusMap = {
      pending    : { emoji: '🟡', label: 'En attente' },
      reviewing  : { emoji: '🔵', label: 'En analyse' },
      accepted   : { emoji: '🟢', label: 'Acceptée' },
      refused    : { emoji: '🔴', label: 'Refusée' },
      implemented: { emoji: '⚫', label: 'Implémentée' },
    };
    const s = statusMap[status] || { emoji: '❓', label: status };

    if (suggestion.message_id) {
      const channels = guild.channels.cache.filter(c => c.type === 0);
      for (const [, channel] of channels) {
        try {
          const msg = await channel.messages.fetch(suggestion.message_id);
          if (msg) { await msg.edit(msg.content + `\n\n${s.emoji} **Statut : ${s.label}**`).catch(() => {}); break; }
        } catch {}
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUGGESTION — TEST
router.post('/suggestion/test', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const embed = new EmbedBuilder()
      .setTitle('💡 Nouvelle suggestion')
      .setDescription('Ceci est une suggestion de test envoyée depuis le dashboard WARSTACK.')
      .setColor(0x5865F2)
      .addFields({ name: 'Auteur', value: 'Kevin (test)', inline: true }, { name: 'Statut', value: '🟡 En attente', inline: true })
      .setFooter({ text: 'WARSTACK Suggestions • TEST' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sug_test_up').setLabel('👍 0').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('sug_test_down').setLabel('👎 0').setStyle(ButtonStyle.Secondary).setDisabled(true),
    );

    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUGGESTION — POSTER DEPUIS DASHBOARD MEMBRE
router.post('/suggestion/post', auth, rl.strict, async (req, res) => {
  try {
    const { username, content, suggestion_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: configs }  = await supabase.from('config').select('*').eq('guild_id', guild.id);
    const getConf = (key) => configs?.find(c => c.key === key)?.value;

    if (getConf('suggestions_enabled') !== 'true') return res.status(403).json({ error: 'Suggestions désactivées' });

    const channelId = getConf('suggestions_channel');
    if (!channelId) return res.status(400).json({ error: 'Salon suggestions non configuré' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const anonymous = getConf('suggestions_anonymous') === 'true';
    const authorLine = anonymous ? '👤 Anonyme' : `👤 ${username}`;
    const msg = await channel.send(`💡 **Suggestion**\n\n${content}\n\n${authorLine}\n🟡 **En attente**`);

    if (getConf('suggestions_reactions') !== 'false') { await msg.react('👍'); await msg.react('👎'); }
    if (getConf('suggestions_threads') === 'true') {
      await msg.startThread({ name: `💬 Discussion — ${content.slice(0, 50)}`, autoArchiveDuration: 1440 }).catch(() => {});
    }
    if (suggestion_id) await supabase.from('suggestions').update({ message_id: msg.id }).eq('id', suggestion_id);

    const logsId = getConf('suggestions_logs');
    if (logsId) {
      const logsCh = guild.channels.cache.get(logsId);
      if (logsCh) await logsCh.send(`📋 Nouvelle suggestion de **${username}** :\n> ${content}`);
    }

    res.json({ success: true, message_id: msg.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÉVÉNEMENT — ANNONCER
router.post('/event/announce', auth, rl.strict, async (req, res) => {
  try {
    const { event_id, channel_id, title, description, date, time, max } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const dateFormatted = new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const msg = await channel.send(
      `🎯 **${title}**\n\n` +
      (description ? `${description}\n\n` : '') +
      `📅 ${dateFormatted} à ${time}\n` +
      (max ? `👥 ${max} places disponibles\n` : '') +
      `\nInscris-toi avec \`/event join\` !`
    );

    await msg.react('✅'); await msg.react('❔'); await msg.react('❌');
    await supabase.from('events').update({ message_id: msg.id }).eq('id', event_id);

    res.json({ success: true, message_id: msg.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÉVÉNEMENT — ANNULER
router.post('/event/cancel', auth, rl.strict, async (req, res) => {
  try {
    const { event_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { data: event } = await supabase.from('events').select('*').eq('id', event_id).single();
    const { data: participants } = await supabase.from('event_participants').select('discord_id')
      .eq('event_id', event_id).eq('status', 'present');

    for (const p of participants || []) {
      const member = await guild.members.fetch(p.discord_id).catch(() => null);
      if (member) await member.send(`❌ L'événement **${event?.title}** a été annulé.`).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÉVÉNEMENT — CONTACTER PARTICIPANTS
router.post('/event/contact', auth, rl.strict, async (req, res) => {
  try {
    const { discord_ids, message, event_title } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    let sent = 0;
    for (const id of discord_ids || []) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) { await member.send(`📢 **${event_title}**\n\n${message}`).catch(() => {}); sent++; }
    }

    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÉVÉNEMENT — TEST
router.post('/event/test', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    const now  = new Date();
    const date = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const embed = new EmbedBuilder()
      .setTitle('🎯 Événement TEST — BF6 Tournament')
      .setDescription('Ceci est un événement de test envoyé depuis le dashboard WARSTACK.')
      .setColor(0xFF6B35)
      .addFields(
        { name: '📅 Date',   value: date,       inline: true },
        { name: '⏰ Heure',  value: time,        inline: true },
        { name: '👥 Places', value: '64 places', inline: true },
      )
      .setFooter({ text: 'WARSTACK Events • TEST' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ev_test_present').setLabel('✅ Présent')   .setStyle(ButtonStyle.Success)  .setDisabled(true),
      new ButtonBuilder().setCustomId('ev_test_maybe')  .setLabel('❔ Peut-être') .setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('ev_test_absent') .setLabel('❌ Absent')    .setStyle(ButtonStyle.Danger)   .setDisabled(true),
    );

    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MESSAGE RÉCURRENT — ENVOYER MAINTENANT
router.post('/message/send-now', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id, content } = req.body;
    if (!channel_id || !content) return res.status(400).json({ error: 'channel_id et content requis' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    await channel.send(content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REACTION ROLES — ENVOYER PANEL
router.post('/reaction-roles/send', auth, rl.strict, async (req, res) => {
  try {
    const { menu_id, channel_id, message, type, component, roles } = req.body;
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    let components = [];

    if (component === 'buttons') {
      const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
      const chunks = [];
      for (let i = 0; i < roles.length; i += 5) chunks.push(roles.slice(i, i + 5));
      for (const chunk of chunks) {
        components.push(new ActionRowBuilder().addComponents(
          chunk.map((r, idx) =>
            new ButtonBuilder().setCustomId(`rxrole_${r.roleId}`).setLabel(r.roleName).setEmoji(r.emoji).setStyle(styles[idx % styles.length])
          )
        ));
        if (components.length >= 4) break;
      }
    } else if (component === 'select') {
      components.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rxmenu_${menu_id}`)
          .setPlaceholder('Choisis un rôle...')
          .setMinValues(1)
          .setMaxValues(type === 'multi' ? Math.min(roles.length, 25) : 1)
          .addOptions(roles.map(r => ({ label: r.roleName, value: r.roleId, emoji: r.emoji })))
      ));
    }

    const msg = await channel.send({ content: message, components });

    if (component === 'reactions') {
      for (const r of roles) await msg.react(r.emoji).catch(() => {});
    }

    await supabase.from('reaction_menus').update({ message_id: msg.id }).eq('id', menu_id);
    res.json({ success: true, message_id: msg.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;