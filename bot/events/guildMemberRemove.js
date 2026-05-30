const supabase = require('../services/supabase');

function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value || null;
}

module.exports = {
  name: 'guildMemberRemove',
  once: false,

  async execute(member) {
    try {
      const guild = member.guild;

      const { data: configs } = await supabase
        .from('config')
        .select('*')
        .eq('guild_id', guild.id);

      const channelId = getConfig(configs, 'leave_channel');
      const message   = getConfig(configs, 'leave_message');

      if (!channelId || !message) return;

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return;

      const filled = message
        .replace(/{user}/g,        member.user.username)
        .replace(/{server}/g,      guild.name)
        .replace(/{membercount}/g, guild.memberCount);

      await channel.send(filled);

    } catch (err) {
      console.error('❌ guildMemberRemove error:', err.message);
    }
  }
};