const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('🖥️ Accès au dashboard WARSTACK'),

  async execute(interaction) {
    const isAdmin = interaction.member.roles.cache.some(r => r.name === 'Admin');
    if (!isAdmin) return interaction.reply({ content: '❌ Accès refusé — Réservé aux admins.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🖥️ WARSTACK — Panel Admin')
      .setColor(0xFF6600)
      .setDescription('Accès au dashboard d\'administration WARSTACK.')
      .addFields(
        { name: '👥 Joueurs', value: 'Gérer les joueurs inscrits', inline: true },
        { name: '🏆 Tournoi', value: 'Reset / forcer update', inline: true },
        { name: '📊 Stats', value: 'Vue d\'ensemble live', inline: true },
      )
      .setFooter({ text: 'WARSTACK • Admin Only • Ne partage pas ce lien' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🖥️ Ouvrir le Dashboard').setURL('https://warstack-v2.vercel.app/login.html').setStyle(ButtonStyle.Link))],
      ephemeral: true
    });
  }
};