const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfile }                         = require('../services/points');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('💰 Affiche ton XP et tes WAR Coins')
    .addUserOption(o =>
      o.setName('joueur')
        .setDescription('Le joueur à consulter (toi par défaut)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const target    = interaction.options.getUser('joueur') || interaction.user;
    const discordId = target.id;
    const guildId   = interaction.guild.id;

    const profile = await getProfile(discordId, guildId);

    // Barre de progression
    const filled  = Math.round(profile.progress / 10);
    const empty   = 10 - filled;
    const xpBar   = '█'.repeat(filled) + '░'.repeat(empty);

    // Prochaine étape
    const nextInfo = profile.nextGrade
      ? `**${profile.nextGrade.emoji} ${profile.nextGrade.name}** dans \`${(profile.nextGrade.xp - profile.xp).toLocaleString('fr-FR')} XP\``
      : '🏆 Grade maximum atteint !';

    const embed = new EmbedBuilder()
      .setTitle(`${profile.grade.emoji} ${target.username} — Points WARSTACK`)
      .setColor(0xFF6600)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name : '🎖️ Grade actuel',
          value:
            `> ${profile.grade.emoji} **${profile.grade.name}** — Niveau \`${profile.grade.level}\`\n` +
            `> ${xpBar} \`${profile.progress}%\`\n` +
            `> ➡️ ${nextInfo}`,
          inline: false,
        },
        {
          name : '✨ XP',
          value: `\`${profile.xp.toLocaleString('fr-FR')} XP\``,
          inline: true,
        },
        {
          name : '💰 WAR Coins',
          value: `\`${profile.coins.toLocaleString('fr-FR')} coins\``,
          inline: true,
        },
        {
          name : '📈 Total gagné',
          value: `\`${profile.totalEarned.toLocaleString('fr-FR')} coins\``,
          inline: true,
        },
        {
          name : '📊 Comment gagner',
          value:
            `> 💬 Message : \`+5 XP / +2 coins\` *(cooldown 60s)*\n` +
            `> 🎤 1h vocal : \`+10 XP / +5 coins\`\n` +
            `> 🎉 Event rejoint : \`+25 XP / +10 coins\`\n` +
            `> 💡 Suggestion acceptée : \`+50 XP / +20 coins\`\n` +
            `> 🏆 Victoire tournoi : \`+200 XP / +250 coins\`\n` +
            `> ⭐ MVP tournoi : \`+75 XP / +75 coins\``,
          inline: false,
        },
      )
      .setFooter({ text: 'WARSTACK • Système de Points' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};