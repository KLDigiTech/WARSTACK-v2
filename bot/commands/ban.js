const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Bannir un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison';

    await interaction.guild.members.ban(target.user.id, { reason });

    await supabase.from('sanctions').insert({
      guild_id      : interaction.guildId,
      discord_id    : target.user.id,
      username      : target.user.username,
      type          : 'ban',
      reason,
      moderator_id  : interaction.user.id,
      moderator_name: interaction.user.username,
      active        : true,
    });

    await interaction.reply({
      content : `✅ **${target.user.username}** a été banni. Raison : ${reason}`,
      ephemeral: true
    });
  }
};