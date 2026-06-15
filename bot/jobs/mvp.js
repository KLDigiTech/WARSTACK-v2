const { EmbedBuilder } = require('discord.js');
const supabase         = require('../services/supabase');

// Poste le MVP de la semaine sur CHAQUE serveur où le bot est installé,
// en se limitant aux joueurs rattachés à ce serveur (warstack_xp).
async function postMVP(client) {
  for (const guild of client.guilds.cache.values()) {
    await postMVPForGuild(guild);
  }
}

async function postMVPForGuild(guild) {
  try {
    const channel = guild.channels.cache.find(c => c.name === 'annonces-mvp');
    if (!channel) { console.log(`❌ Salon #annonces-mvp introuvable sur ${guild.name}`); return; }

    const { data: members } = await supabase
      .from('warstack_xp')
      .select('discord_id')
      .eq('guild_id', guild.id);

    const memberIds = (members || []).map(m => m.discord_id);
    if (!memberIds.length) return;

    const { data: players } = await supabase
      .from('players')
      .select('*')
      .in('discord_id', memberIds)
      .order('kd', { ascending: false })
      .limit(1);

    if (!players || players.length === 0) return;

    const mvp   = players[0];
    const embed = new EmbedBuilder()
      .setTitle('⭐ MVP DE LA SEMAINE')
      .setColor(0xFF6600)
      .setDescription(`**${mvp.pseudo_bf6}** est le MVP de cette semaine ! 🔥`)
      .addFields(
        { name: '📈 K/D',   value: `\`${(mvp.kd || 0).toFixed(2)}\``, inline: true },
        { name: '🎯 Kills', value: `\`${mvp.kills || 0}\``,            inline: true },
        { name: '🏅 Wins',  value: `\`${mvp.wins  || 0}\``,            inline: true },
      )
      .setFooter({ text: 'WARSTACK • MVP Hebdomadaire' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`✅ MVP posté dans #annonces-mvp (${guild.name})`);

  } catch (error) {
    console.error(`❌ Erreur MVP job (${guild.name}):`, error.message);
  }
}

module.exports = { postMVP };