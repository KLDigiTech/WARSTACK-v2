const { EmbedBuilder } = require('discord.js');

const DIVISIONS = ['Recruit', 'Grunt', 'Veteran', 'Elite', 'Phantom', 'WARSTACK'];

function getDivisionIndex(name) {
  return DIVISIONS.indexOf(name);
}

function checkRankUp(oldDiv, newDiv) {
  const oldIndex = getDivisionIndex(oldDiv.name);
  const newIndex = getDivisionIndex(newDiv.name);
  if (newIndex > oldIndex) return { rankUp: true, from: oldDiv, to: newDiv };
  return { rankUp: false };
}

async function notifyRankUp(client, discordId, from, to) {
  try {
    const user = await client.users.fetch(discordId);
    if (user) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${to.emoji} RANK UP — Tu es maintenant ${to.name} !`)
        .setDescription(`Tu viens de passer de **${from.emoji} ${from.name}** à **${to.emoji} ${to.name}**.\n\nContinue comme ça soldat. 🔥`)
        .setColor(0xFF6600)
        .setFooter({ text: 'WARSTACK • Battlefield 6' })
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] }).catch(() => {
        console.log(`⚠️ DM impossible pour ${user.username}`);
      });
    }

    const channel =
      client.channels.cache.find(c => c.name === 'annonces-mvp') ||
      client.channels.cache.find(c => c.name === 'classement');

    if (channel) {
      const channelEmbed = new EmbedBuilder()
        .setTitle(`${to.emoji} RANK UP !`)
        .setDescription(`<@${discordId}> vient de passer **${from.emoji} ${from.name}** → **${to.emoji} ${to.name}** !`)
        .setColor(0xFF6600)
        .setFooter({ text: 'WARSTACK • Battlefield 6' })
        .setTimestamp();
      await channel.send({ embeds: [channelEmbed] });
    }

  } catch (error) {
    console.error('❌ Erreur notifyRankUp:', error.message);
  }
}

module.exports = { checkRankUp, notifyRankUp };