const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 Mute un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(o => o.setName('duree').setDescription('Durée en minutes').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const target   = interaction.options.getMember('membre');
    const duration = interaction.options.getInteger('duree');
    const reason   = interaction.options.getString('raison') || 'Aucune raison';

    await target.timeout(duration * 60 * 1000, reason);

    await supabase.from('sanctions').insert({
      guild_id      : interaction.guildId,
      discord_id    : target.user.id,
      username      : target.user.username,
      type          : 'mute',
      reason,
      duration,
      moderator_id  : interaction.user.id,
      moderator_name: interaction.user.username,
      active        : true,
    });

    await interaction.reply({
      content : `✅ **${target.user.username}** mute pendant ${duration} minutes. Raison : ${reason}`,
      ephemeral: true
    });
  }
};