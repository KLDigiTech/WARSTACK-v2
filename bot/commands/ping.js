const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Vérifie si WARSTACK est en ligne'),

  async execute(interaction) {
    const latence = Date.now() - interaction.createdTimestamp;
    await interaction.reply({ content: `🟢 **WARSTACK opérationnel**\n⚡ Latence : **${latence}ms**`, ephemeral: true });
  }
};