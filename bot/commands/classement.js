const { SlashCommandBuilder } = require('discord.js');
const { updateLeaderboard }   = require('../jobs/leaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('🏆 Affiche le classement WARSTACK'),

  async execute(interaction) {
    await interaction.reply({ content: '⏳ Mise à jour du classement en cours...', ephemeral: true });
    updateLeaderboard(interaction.client).catch(console.error);
  }
};