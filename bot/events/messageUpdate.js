const supabase = require('../services/supabase');

module.exports = {
  name: 'messageUpdate',
  once: false,

  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    try {
      await supabase.from('audit_logs').insert({
        guild_id    : newMessage.guild.id,
        type        : 'message',
        action      : 'message_edit',
        author_id   : newMessage.author?.id       || null,
        author_name : newMessage.author?.username  || 'Inconnu',
        channel_id  : newMessage.channel?.id       || null,
        channel_name: newMessage.channel?.name     || null,
        content     : oldMessage.content?.slice(0, 500) || '[vide]',
        extra       : { new_content: newMessage.content?.slice(0, 500) },
      });
    } catch (err) {
      console.error('❌ audit messageUpdate:', err.message);
    }
  }
};