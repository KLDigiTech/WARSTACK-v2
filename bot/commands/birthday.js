const { SlashCommandBuilder } = require('discord.js');
const supabase                = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('🎂 Gère ton anniversaire')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Enregistre ton anniversaire')
        .addIntegerOption(o => o.setName('jour').setDescription('Jour (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption(o => o.setName('mois').setDescription('Mois (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
        .addIntegerOption(o => o.setName('annee').setDescription('Année (optionnel)').setRequired(false).setMinValue(1900).setMaxValue(2010))
    )
    .addSubcommand(sub =>
      sub.setName('get')
        .setDescription('Voir l\'anniversaire d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Supprimer ton anniversaire')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const day   = interaction.options.getInteger('jour');
      const month = interaction.options.getInteger('mois');
      const year  = interaction.options.getInteger('annee') || null;

      const { error } = await supabase
        .from('birthdays')
        .upsert({
          discord_id: interaction.user.id,
          username  : interaction.user.username,
          day,
          month,
          year,
        }, { onConflict: 'discord_id' });

      if (error) {
        return interaction.reply({ content: '❌ Erreur lors de l\'enregistrement.', ephemeral: true });
      }

      const dateStr = `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}${year ? `/${year}` : ''}`;
      return interaction.reply({
        content: `✅ Anniversaire enregistré : **${dateStr}** 🎂`,
        ephemeral: true
      });
    }

    if (sub === 'get') {
      const target    = interaction.options.getUser('membre') || interaction.user;
      const { data }  = await supabase
        .from('birthdays')
        .select('*')
        .eq('discord_id', target.id)
        .single();

      if (!data) {
        return interaction.reply({
          content: `❌ **${target.username}** n'a pas enregistré son anniversaire.`,
          ephemeral: true
        });
      }

      const dateStr = `${String(data.day).padStart(2,'0')}/${String(data.month).padStart(2,'0')}${data.year ? `/${data.year}` : ''}`;
      return interaction.reply({
        content: `🎂 Anniversaire de **${target.username}** : **${dateStr}**`,
        ephemeral: true
      });
    }

    if (sub === 'delete') {
      await supabase
        .from('birthdays')
        .delete()
        .eq('discord_id', interaction.user.id);

      return interaction.reply({
        content: '✅ Ton anniversaire a été supprimé.',
        ephemeral: true
      });
    }
  }
};