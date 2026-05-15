const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase                               = require('../services/supabase');

function calcScore(s) {
  if (!s) return 0;
  const kd = parseFloat(s.kd) || 0, winrate = parseFloat(s.winrate) || 0;
  const kills = parseInt(s.kills) || 0, games = parseInt(s.games) || 1, kpm = kills / games;
  return ((Math.min(kd / 5, 1) * 100 * 0.30) + (Math.min(winrate / 60, 1) * 100 * 0.35) + (Math.min(kpm / 20, 1) * 100 * 0.25)).toFixed(2);
}

function getDivision(score) {
  const s = parseFloat(score);
  if (s >= 65) return { name: 'WARSTACK', emoji: '🔱' };
  if (s >= 55) return { name: 'Phantom',  emoji: '👻' };
  if (s >= 45) return { name: 'Elite',    emoji: '💎' };
  if (s >= 35) return { name: 'Veteran',  emoji: '🎖️' };
  if (s >= 25) return { name: 'Grunt',    emoji: '⚔️' };
  return             { name: 'Recruit',   emoji: '🪖' };
}

async function getPlayerSnapshot(discordId) {
  const { data: player } = await supabase.from('players').select('*').eq('discord_id', discordId).single();
  if (!player?.tracker_id) return null;
  const { data: snapshot } = await supabase.from('player_snapshots').select('*').eq('tracker_id', player.tracker_id).order('snapshot_at', { ascending: false }).limit(1).single();
  return { player, snapshot };
}

function w(v1, v2) { return parseFloat(v1) >= parseFloat(v2) ? '🟢' : '🔴'; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comparer')
    .setDescription('⚔️ Compare les stats de deux joueurs')
    .addUserOption(o => o.setName('joueur1').setDescription('Premier joueur').setRequired(true))
    .addUserOption(o => o.setName('joueur2').setDescription('Deuxième joueur').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const user1 = interaction.options.getUser('joueur1');
    const user2 = interaction.options.getUser('joueur2');
    const [data1, data2] = await Promise.all([getPlayerSnapshot(user1.id), getPlayerSnapshot(user2.id)]);

    if (!data1?.snapshot) return interaction.editReply({ content: `❌ **${user1.username}** n'a pas de stats disponibles.` });
    if (!data2?.snapshot) return interaction.editReply({ content: `❌ **${user2.username}** n'a pas de stats disponibles.` });

    const s1 = data1.snapshot, s2 = data2.snapshot;
    const score1 = calcScore(s1), score2 = calcScore(s2);
    const div1 = getDivision(score1), div2 = getDivision(score2);
    const n1 = data1.player.username || user1.username, n2 = data2.player.username || user2.username;

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${n1} VS ${n2}`)
      .setColor(0xFF6600)
      .addFields(
        { name: '​', value: `**${n1}** ${div1.emoji} vs ${div2.emoji} **${n2}**`, inline: false },
        { name: '📊 Score',      value: `${w(score1,score2)} \`${score1}\` — \`${score2}\` ${w(score2,score1)}`, inline: false },
        { name: '📈 K/D',        value: `${w(s1.kd,s2.kd)} \`${s1.kd}\` — \`${s2.kd}\` ${w(s2.kd,s1.kd)}`, inline: false },
        { name: '🎯 Kills',      value: `${w(s1.kills,s2.kills)} \`${s1.kills}\` — \`${s2.kills}\` ${w(s2.kills,s1.kills)}`, inline: false },
        { name: '🏆 Wins',       value: `${w(s1.wins,s2.wins)} \`${s1.wins}\` — \`${s2.wins}\` ${w(s2.wins,s1.wins)}`, inline: false },
        { name: '🏳️ Win Rate',   value: `${w(s1.winrate,s2.winrate)} \`${s1.winrate}%\` — \`${s2.winrate}%\` ${w(s2.winrate,s1.winrate)}`, inline: false },
      )
      .setFooter({ text: 'WARSTACK • Battlefield 6 Stats' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};