const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setupStructure } = require('../services/setupStructure');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Installe la structure complète WARSTACK sur ce serveur — Admin only')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    // ✅ Vérifie que l'utilisateur est admin
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Tu dois être Administrateur pour utiliser cette commande.',
        ephemeral: true
      });
    }

    // ✅ Defer pour éviter le timeout (création de salons peut prendre quelques secondes)
    await interaction.deferReply({ ephemeral: true });

    const result = await setupStructure(interaction.guild);

    if (result.reason === 'already_setup') {
      return interaction.editReply({
        content: '⚠️ La structure WARSTACK est déjà installée sur ce serveur.'
      });
    }

    if (!result.success) {
      return interaction.editReply({
        content: '❌ Une erreur est survenue pendant l\'installation. Vérifie les logs du bot.'
      });
    }

    return interaction.editReply({
      content: '✅ Structure WARSTACK installée avec succès !\nCatégories, salons, permissions et panneau de contrôle créés.'
    });
  }
};