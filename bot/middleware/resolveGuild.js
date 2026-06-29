// bot/middleware/resolveGuild.js
// Résout le serveur Discord ciblé par la requête (multi-guild)
// Ordre de priorité : params > query > body > premier serveur du cache

function resolveGuild(req) {
  const guildId = req.params?.guild_id
                || req.query?.guild_id
                || req.body?.guild_id;

  if (guildId) {
    const guild = global.botClient?.guilds.cache.get(guildId);
    if (guild) return guild;
  }

  return global.botClient?.guilds.cache.first() || null;
}

module.exports = { resolveGuild };