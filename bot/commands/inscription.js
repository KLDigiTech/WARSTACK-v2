const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase                               = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inscription')
    .setDescription('📋 S\'inscrire au tournoi en cours'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;

    const { data: player } = await supabase.from('players').select('*').eq('discord_id', discordId).single();
    if (!player) return interaction.editReply({ content: '❌ Tu n\'es pas inscrit sur WARSTACK. Utilise **/register** d\'abord.' });

    const { data: tournois } = await supabase.from('tournaments').select('*').eq('status', 'active').limit(1);
    const tournoi = tournois?.[0];
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi en cours.' });

    if (tournoi.max_players) {
      const { count } = await supabase.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('tournament_id', tournoi.id);
      if (count >= tournoi.max_players) return interaction.editReply({ content: `❌ Le tournoi est complet (${tournoi.max_players} joueurs max).` });
    }

    const { data: existing } = await supabase.from('tournament_entries').select('*').eq('tournament_id', tournoi.id).eq('discord_id', discordId).single();
    if (existing) return interaction.editReply({ content: `⚠️ Tu es déjà inscrit au tournoi **${tournoi.name}**.` });

    await supabase.from('tournament_entries').insert({
      tournament_id : tournoi.id,
      discord_id    : discordId,
      username      : player.username || interaction.user.username,
      tracker_id    : player.tracker_id,
      status        : 'active',
      created_at    : new Date().toISOString()
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Inscription confirmée !')
      .setColor(0xFF6600)
      .setDescription(`Tu es inscrit au tournoi **${tournoi.name}** !`)
      .addFields(
        { name: '📅 Début', value: `\`${new Date(tournoi.start_date).toLocaleDateString('fr-FR')}\``, inline: true },
        { name: '📅 Fin',   value: `\`${new Date(tournoi.end_date).toLocaleDateString('fr-FR')}\``,   inline: true },
      )
      .setFooter({ text: 'WARSTACK • Bonne chance !' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    const channel = interaction.guild.channels.cache.find(c => c.name === 'inscriptions');
    if (channel) {
      await channel.send({ embeds: [
        new EmbedBuilder()
          .setTitle('📋 Nouvelle inscription')
          .setColor(0x00ff66)
          .setDescription(`<@${discordId}> vient de s'inscrire au tournoi **${tournoi.name}** !`)
          .setTimestamp()
      ]});
    }
  }
};