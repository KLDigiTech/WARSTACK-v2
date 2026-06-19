const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('✅ Débannir un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('id').setDescription('ID Discord du membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const userId = interaction.options.getString('id');
    const reason = interaction.options.getString('raison') || 'Aucune raison';

    await interaction.guild.members.unban(userId, reason).catch(() => {});

    await supabase
      .from('sanctions')
      .update({ active: false })
      .eq('discord_id', userId)
      .eq('guild_id', interaction.guild.id)
      .eq('type', 'ban');

    await interaction.reply({
      content : `✅ Membre \`${userId}\` débanni. Raison : ${reason}`,
      ephemeral: true
    });
  }
};