const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase      = require('../services/supabase');
const { fireRules } = require('../jobs/rule-engine');

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

    // ── Rule Engine ────────────────────────────────────
    const { data: warns } = await supabase
      .from('sanctions')
      .select('id')
      .eq('guild_id', interaction.guildId)
      .eq('discord_id', target.user.id)
      .eq('type', 'warn')
      .eq('active', true);

    const warnCount   = warns?.length || 0;
    const guildMember = await interaction.guild.members.fetch(target.user.id).catch(() => null);

    if (guildMember) {
      await fireRules(interaction.guildId, 'member_warn',        { member: guildMember, guild: interaction.guild, warnCount });
      await fireRules(interaction.guildId, 'member_warns_reach', { member: guildMember, guild: interaction.guild, warnCount });
    }

    await interaction.reply({
      content  : `✅ **${target.user.username}** a été averti. Raison : ${reason}`,
      ephemeral: true
    });
  }
};