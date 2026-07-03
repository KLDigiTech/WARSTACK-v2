// bot/routes/guild.js
const express             = require('express');
const { ChannelType }     = require('discord.js');
const { auth, rl }        = require('../middleware/auth');
const { resolveGuild }    = require('../middleware/resolveGuild');

const router = express.Router();

// STATUS BOT
router.get('/status', rl.public, (req, res) => {
  res.json({
    status   : 'online',
    bot      : global.botClient?.user?.tag || 'inconnu',
    uptime   : process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// INFO SERVEUR
router.get('/guild', rl.public, (req, res) => {
  const guild = resolveGuild(req);
  if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
  res.json({
    name        : guild.name,
    icon        : guild.iconURL({ dynamic: true, size: 256 }),
    member_count: guild.memberCount,
    created_at  : guild.createdAt,
  });
});

// VÉRIF MEMBRE DU SERVEUR — publique intentionnellement (auth côté Discord OAuth)
router.get('/member/:discordId', rl.public, async (req, res) => {
  try {
    const guild  = resolveGuild(req);
    if (!guild) return res.status(404).json({ isMember: false });
    const member = await guild.members.fetch(req.params.discordId).catch(() => null);
    res.json({ isMember: !!member, username: member?.user?.username || null });
  } catch {
    res.json({ isMember: false });
  }
});

// TRACKER (proxy — pas de clé Warstack requise mais rate limitée)
router.get('/tracker/:pseudo', rl.public, async (req, res) => {
  try {
    const pseudo   = encodeURIComponent(req.params.pseudo);
    const response = await fetch(
      `https://tracker.gg/api/v2/battlefield-2042/standard/profile/psn/${pseudo}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' } }
    );
    if (!response.ok) return res.json({ found: false });
    const data       = await response.json();
    const platformId = data?.data?.platformInfo?.platformUserId || null;
    res.json({ found: true, tracker_id: platformId, username: req.params.pseudo });
  } catch {
    res.json({ found: false });
  }
});

// USER DISCORD INFO
router.get('/user/:id', auth, rl.standard, async (req, res) => {
  try {
    const user = await global.botClient.users.fetch(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({
      id      : user.id,
      username: user.username,
      avatar  : user.displayAvatarURL({ size: 128, extension: 'png' }),
      tag     : user.tag || user.username,
    });
  } catch (e) {
    res.status(404).json({ error: 'Utilisateur introuvable : ' + e.message });
  }
});

// RECHERCHE MEMBRE
router.get('/member/search', auth, rl.standard, async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    if (!query || query.length < 2) return res.json({ members: [] });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    await guild.members.fetch();
    const members = guild.members.cache
      .filter(m =>
        !m.user.bot &&
        (m.user.username.toLowerCase().includes(query) || m.displayName.toLowerCase().includes(query))
      )
      .map(m => ({
        discord_id: m.user.id,
        username  : m.user.username,
        display   : m.displayName,
        avatar    : m.user.displayAvatarURL({ size: 64, extension: 'png' }),
      }))
      .slice(0, 20);

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LISTE SALONS
router.get('/channels', auth, rl.standard, async (req, res) => {
  try {
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const channels = guild.channels.cache
      .filter(c => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].includes(c.type))
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRÉER SALON
router.post('/channel/create', auth, rl.strict, async (req, res) => {
  try {
    const { name, type = 0, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const typeMap = {
      0: ChannelType.GuildText,
      2: ChannelType.GuildVoice,
      4: ChannelType.GuildCategory,
    };

    const channel = await guild.channels.create({
      name,
      type    : typeMap[parseInt(type)] ?? ChannelType.GuildText,
      ...(category ? { parent: category } : {}),
    });

    res.json({ success: true, channel_id: channel.id, channel_name: channel.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUPPRIMER SALON
router.post('/channel/delete', auth, rl.strict, async (req, res) => {
  try {
    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id manquant' });

    const guild   = resolveGuild(req);
    const channel = guild?.channels.cache.get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    await channel.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRÉER RÔLE
router.post('/role/create', auth, rl.strict, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const role = await guild.roles.create({
      name  : name.trim().slice(0, 100),
      color : color || undefined,
      reason: 'WARSTACK Dashboard — création de rôle',
    });

    res.json({ success: true, id: role.id, name: role.name, color: role.hexColor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LISTE RÔLES
router.get('/roles', auth, rl.standard, async (req, res) => {
  try {
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });
    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone' && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ASSIGNER RÔLE
router.post('/role/assign', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id, role_name } = req.body;
    if (!discord_id || !role_name) return res.status(400).json({ error: 'Paramètres manquants' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (!discordRole) return res.status(404).json({ error: `Rôle "${role_name}" introuvable sur Discord` });

    const wrstackRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed && r.name !== 'Admin');
    if (wrstackRoles.size) await member.roles.remove(wrstackRoles);
    await member.roles.add(discordRole);

    res.json({ success: true, member: member.user.username, role: role_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RETIRER RÔLE
router.post('/role/remove', auth, rl.strict, async (req, res) => {
  try {
    const { discord_id, role_name } = req.body;
    if (!discord_id || !role_name) return res.status(400).json({ error: 'Paramètres manquants' });

    const guild = resolveGuild(req);
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

// APPLIQUER PERMISSIONS SALONS POUR UN RÔLE
router.post('/role/apply-channels', auth, rl.strict, async (req, res) => {
  try {
    const { role_name, color, channel_ids_allow = [], channel_ids_deny = [] } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name manquant' });

    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    let discordRole = guild.roles.cache.find(r => r.name === role_name);
    if (!discordRole) {
      discordRole = await guild.roles.create({
        name  : role_name,
        color : color ? parseInt(color.replace('#', ''), 16) : 0x95A5A6,
        reason: 'WARSTACK Dashboard — création rôle accès salons',
      });
    }

    for (const channelId of channel_ids_allow) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) await channel.permissionOverwrites.edit(discordRole, { ViewChannel: true });
    }
    for (const channelId of channel_ids_deny) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) await channel.permissionOverwrites.edit(discordRole, { ViewChannel: false });
    }

    res.json({ success: true, role_id: discordRole.id, role_name: discordRole.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EMOJIS CUSTOM
router.get('/emojis', auth, rl.standard, async (req, res) => {
  try {
    const guild = resolveGuild(req);
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

// SERVEURS OÙ UN MEMBRE EST ADMIN
router.get('/guilds/:discord_id', auth, rl.standard, async (req, res) => {
  try {
    const discordId = req.params.discord_id;
    const guilds    = [];

    for (const [, guild] of global.botClient.guilds.cache) {
      try {
        await guild.members.fetch();
        const member = guild.members.cache.get(discordId);
        if (!member) continue;
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

// COMPTEUR MEMBRES
router.post('/counter/update', auth, rl.strict, async (req, res) => {
  try {
    const guild = resolveGuild(req);
    if (!guild) return res.status(404).json({ error: 'Guild introuvable' });

    const { channel_id, format } = req.body;
    const fmt  = format || '👥 Membres : {count}';
    const name = fmt.replace(/{count}/g, guild.memberCount);

    let channel = channel_id ? guild.channels.cache.get(channel_id) : null;
    if (!channel) {
      channel = await guild.channels.create({
        name,
        type : 2,
        permissionOverwrites: [{ id: guild.roles.everyone, deny: ['Connect'] }],
      });
    } else {
      await channel.setName(name);
    }

    res.json({ success: true, channel_id: channel.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;