const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../services/supabase');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function getDivision(score) {
  const s = parseFloat(score);
  if (s >= 65) return { name: 'WARSTACK', emoji: '🔱' };
  if (s >= 55) return { name: 'Phantom', emoji: '👻' };
  if (s >= 45) return { name: 'Elite', emoji: '💎' };
  if (s >= 35) return { name: 'Veteran', emoji: '🎖️' };
  if (s >= 25) return { name: 'Grunt', emoji: '⚔️' };
  return { name: 'Recruit', emoji: '🪖' };
}

function getDivisionColor(name) {
  const colors = { 'WARSTACK': 0xFF0000, 'Phantom': 0x9B59B6, 'Elite': 0x00BFFF, 'Veteran': 0xFF6600, 'Grunt': 0x95A5A6, 'Recruit': 0x607D8B };
  return colors[name] || 0xFF6600;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Affiche les stats BF6 d\'un joueur')
    .addUserOption(option => option.setName('joueur').setDescription('Le joueur à consulter (toi par défaut)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('joueur') || interaction.user;
    const discordId = target.id;

    const { data: player } = await supabase.from('players').select('*').eq('discord_id', discordId).single();
    if (!player?.tracker_id) return interaction.editReply({ content: `❌ **${target.username}** n'est pas inscrit.\nUtilise **/register** avec ton URL tracker.gg !` });

    const { data: snapshot } = await supabase.from('player_snapshots').select('*').eq('tracker_id', player.tracker_id).order('snapshot_at', { ascending: false }).limit(1).single();
    if (!snapshot) return interaction.editReply({ content: `⏳ **${target.username}** est inscrit mais les stats ne sont pas encore disponibles.` });

    const kd = parseFloat(snapshot.kd) || 0;
    const winrate = parseFloat(snapshot.winrate) || 0;
    const kills = parseInt(snapshot.kills) || 0;
    const games = parseInt(snapshot.games) || 1;
    const kpm = kills / games;
    const score = ((Math.min(kd / 5, 1) * 100 * 0.30) + (Math.min(winrate / 60, 1) * 100 * 0.35) + (Math.min(kpm / 20, 1) * 100 * 0.25)).toFixed(2);
    const division = getDivision(score);

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'WARSTACK • Stats BF6' })
      .setTitle(`${division.emoji}  ${player.username || target.username}`)
      .setDescription(`**${division.name}** — Score \`${score}\``)
      .setColor(getDivisionColor(division.name))
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '​', value: '**── COMBAT ──**', inline: false },
        { name: '🎯 Kills', value: `\`${Number(snapshot.kills).toLocaleString('fr-FR')}\``, inline: true },
        { name: '💀 Deaths', value: `\`${Number(snapshot.deaths).toLocaleString('fr-FR')}\``, inline: true },
        { name: '📈 K/D', value: `\`${snapshot.kd}\``, inline: true },
        { name: '​', value: '**── VICTOIRES ──**', inline: false },
        { name: '🏆 Wins', value: `\`${snapshot.wins}\``, inline: true },
        { name: '🎮 Parties', value: `\`${snapshot.games}\``, inline: true },
        { name: '🏳️ Win Rate', value: `\`${snapshot.winrate}%\``, inline: true },
        { name: '​', value: '**── GÉNÉRAL ──**', inline: false },
        { name: '⏱️ Temps de jeu', value: `\`${snapshot.playtime}\``, inline: true },
        { name: '🔗 Tracker ID', value: `\`${player.tracker_id}\``, inline: true },
        { name: '📅 Mis à jour', value: `\`${new Date(snapshot.snapshot_at).toLocaleDateString('fr-FR')}\``, inline: true },
      )
      .setFooter({ text: 'WARSTACK • Battlefield 6 Stats' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('📊 Stats complètes')
        .setStyle(ButtonStyle.Link)
        .setURL('https://warstack-v2.vercel.app/#players'),
      new ButtonBuilder()
        .setLabel('🏆 Classement')
        .setStyle(ButtonStyle.Link)
        .setURL('https://warstack-v2.vercel.app/#classement'),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};