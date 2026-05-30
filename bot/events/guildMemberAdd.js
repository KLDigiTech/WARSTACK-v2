const supabase = require('../services/supabase');

function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value || null;
}

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member) {
    try {
      const guild = member.guild;

      const { data: configs } = await supabase
        .from('config')
        .select('*')
        .eq('guild_id', guild.id);

      // ── Message bienvenue ──────────────────────────────
      const channelId = getConfig(configs, 'welcome_channel');
      const message   = getConfig(configs, 'welcome_message');

      if (channelId && message) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          const filled = message
            .replace(/{mention}/g,     member.toString())
            .replace(/{user}/g,        member.user.username)
            .replace(/{server}/g,      guild.name)
            .replace(/{membercount}/g, guild.memberCount);
          await channel.send(filled);
        }
      }

      // ── DM ────────────────────────────────────────────
      const dmEnabled = getConfig(configs, 'enable_dm') === 'true';
      const dmMessage = getConfig(configs, 'dm_message');

      if (dmEnabled && dmMessage) {
        const filled = dmMessage
          .replace(/{mention}/g,     member.toString())
          .replace(/{user}/g,        member.user.username)
          .replace(/{server}/g,      guild.name)
          .replace(/{membercount}/g, guild.memberCount);
        await member.send(filled).catch(() => {});
      }

      // ── Rôle auto ─────────────────────────────────────
      const autoroleId = getConfig(configs, 'autorole');
      if (autoroleId) {
        const role = guild.roles.cache.get(autoroleId);
        if (role) await member.roles.add(role).catch(() => {});
      }

    } catch (err) {
      console.error('❌ guildMemberAdd error:', err.message);
    }
  }
};