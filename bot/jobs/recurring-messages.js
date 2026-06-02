const supabase = require('../services/supabase');

async function sendRecurringMessages(client) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const { data: messages } = await supabase
      .from('recurring_messages')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('enabled', true);

    if (!messages?.length) return;

    const now = new Date();

    for (const msg of messages) {
      if (!shouldSend(msg, now)) continue;

      const channel = guild.channels.cache.get(msg.channel_id);
      if (!channel) continue;

      const content = msg.message
        .replace(/{server}/g,      guild.name)
        .replace(/{membercount}/g, guild.memberCount)
        .replace(/{date}/g,        now.toLocaleDateString('fr-FR'))
        .replace(/{time}/g,        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

      await channel.send(content);

      await supabase
        .from('recurring_messages')
        .update({
          last_sent : now.toISOString(),
          send_count: (msg.send_count || 0) + 1,
        })
        .eq('id', msg.id);

      console.log(`✅ Message récurrent envoyé : ${msg.name}`);
    }
  } catch (err) {
    console.error('❌ recurring-messages:', err.message);
  }
}

function shouldSend(msg, now) {
  const h = now.getHours();
  const m = now.getMinutes();

  if (h !== msg.send_hour || m !== msg.send_minute) return false;

  if (!msg.last_sent) return true;

  const last    = new Date(msg.last_sent);
  const diffMs  = now - last;
  const diffMin = diffMs / 60000;

  const minGap = {
    hourly  : 55,
    every3h : 170,
    every6h : 350,
    every12h: 700,
    daily   : 1400,
    every2d : 2800,
    every3d : 4200,
    weekly  : 9800,
    every2w : 19600,
    monthly : 42000,
  };

  return diffMin >= (minGap[msg.frequency] || 1400);
}

module.exports = { sendRecurringMessages };