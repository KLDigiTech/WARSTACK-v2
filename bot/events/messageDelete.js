const supabase = require('../services/supabase');

module.exports = {
  name: 'messageDelete',
  once: false,

  async execute(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    try {
      await supabase.from('audit_logs').insert({
        guild_id    : message.guild.id,
        type        : 'message',
        action      : 'message_delete',
        author_id   : message.author?.id   || null,
        author_name : message.author?.username || 'Inconnu',
        channel_id  : message.channel?.id   || null,
        channel_name: message.channel?.name || null,
        content     : message.content?.slice(0, 1000) || '[vide]',
      });
    } catch (err) {
      console.error('❌ audit messageDelete:', err.message);
    }
  }
};