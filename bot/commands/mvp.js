const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase                               = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mvp')
    .setDescription('⭐ Affiche le MVP de la semaine'),

  async execute(interaction) {
    await interaction.deferReply();

    const { data: members } = await supabase
      .from('warstack_xp')
      .select('discord_id')
      .eq('guild_id', interaction.guild.id);

    const memberIds = (members || []).map(m => m.discord_id);
    if (!memberIds.length) return interaction.editReply({ content: '❌ Aucun joueur inscrit pour le moment.' });

    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .in('discord_id', memberIds)
      .order('kd', { ascending: false })
      .limit(1);
    if (error || !players?.length) return interaction.editReply({ content: '❌ Aucun joueur inscrit pour le moment.' });

    const mvp   = players[0];
    const embed = new EmbedBuilder()
      .setTitle('⭐ MVP DE LA SEMAINE')
      .setColor(0xFF6600)
      .setDescription(`**${mvp.pseudo_bf6}** est le meilleur joueur cette semaine !`)
      .addFields(
        { name: '📈 K/D',        value: `\`${mvp.kd?.toFixed(2) || '0.00'}\``, inline: true },
        { name: '🎯 Kills',      value: `\`${mvp.kills || 0}\``,               inline: true },
        { name: '💀 Deaths',     value: `\`${mvp.deaths || 0}\``,              inline: true },
        { name: '📱 Plateforme', value: `\`${mvp.platform?.toUpperCase()}\``,  inline: true },
      )
      .setFooter({ text: 'WARSTACK • PöF BF6 Tournament' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};