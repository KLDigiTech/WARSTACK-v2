module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erreur commande /${interaction.commandName}:`, error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ Une erreur est survenue.' });
        } else {
          await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
      } catch (e) {
        console.error('❌ Impossible de répondre à l\'interaction:', e.message);
      }
    }
  }
};