const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Avertir un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison';

    await supabase.from('sanctions').insert({
      guild_id      : interaction.guildId,
      discord_id    : target.user.id,
      username      : target.user.username,
      type          : 'warn',
      reason,
      moderator_id  : interaction.user.id,
      moderator_name: interaction.user.username,
      active        : true,
    });

    await target.send(`⚠️ Tu as reçu un avertissement sur **${interaction.guild.name}**\nRaison : ${reason}`).catch(() => {});

    await interaction.reply({
      content : `✅ **${target.user.username}** a été averti. Raison : ${reason}`,
      ephemeral: true
    });
  }
};