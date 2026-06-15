const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase                               = require('../services/supabase');
const axios                                  = require('axios');

const OCR_URL = process.env.OCR_SERVICE_URL || 'https://warstack-ocr.onrender.com';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resultat')
    .setDescription('📸 Soumet ton screenshot de fin de partie pour le tournoi')
    .addAttachmentOption(o => o.setName('screenshot').setDescription('Screenshot de fin de partie').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const discordId  = interaction.user.id;
    const attachment = interaction.options.getAttachment('screenshot');

    if (!attachment.contentType?.startsWith('image/')) return interaction.editReply({ content: '❌ Le fichier doit être une image (PNG, JPG).' });

    const { data: player } = await supabase.from('players').select('*').eq('discord_id', discordId).single();
    if (!player) return interaction.editReply({ content: '❌ Tu n\'es pas inscrit. Utilise **/register** d\'abord.' });

    const { data: tournoi } = await supabase.from('tournaments').select('*').eq('status', 'active').eq('guild_id', interaction.guild.id).single();
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi en cours.' });

    const { data: entry } = await supabase.from('tournament_entries').select('*').eq('tournament_id', tournoi.id).eq('discord_id', discordId).single();
    if (!entry) return interaction.editReply({ content: '❌ Tu n\'es pas inscrit à ce tournoi. Utilise **/inscription**.' });

    try {
      const ocrResponse = await axios.post(`${OCR_URL}/ocr`, { image_url: attachment.url }, { timeout: 30000 });
      const stats       = ocrResponse.data.stats;

      await supabase.from('tournament_submissions').insert({
        tournament_id : tournoi.id,
        discord_id    : discordId,
        image_url     : attachment.url,
        kills         : stats.kills,
        deaths        : stats.deaths,
        score         : stats.score,
        kd            : stats.kd,
        submitted_at  : new Date().toISOString(),
        status        : 'pending'
      });

      const embed = new EmbedBuilder()
        .setTitle('📸 Screenshot soumis !')
        .setColor(0xFF6600)
        .setThumbnail(attachment.url)
        .addFields(
          { name: '🎯 Kills détectés',  value: `\`${stats.kills ?? '—'}\``,  inline: true },
          { name: '💀 Deaths détectés', value: `\`${stats.deaths ?? '—'}\``, inline: true },
          { name: '📊 Score détecté',   value: `\`${stats.score ?? '—'}\``,  inline: true },
        )
        .setDescription('⏳ Ton résultat est en attente de validation par un admin.')
        .setFooter({ text: `WARSTACK • Tournoi : ${tournoi.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      const adminChannel = interaction.guild.channels.cache.find(c => c.name === 'tournoi-live');
      if (adminChannel) {
        await adminChannel.send({ embeds: [
          new EmbedBuilder()
            .setTitle('📥 Nouvelle soumission à valider')
            .setColor(0xFFFF00)
            .setImage(attachment.url)
            .addFields(
              { name: '👤 Joueur', value: `<@${discordId}>`,           inline: true },
              { name: '🎯 Kills', value: `\`${stats.kills ?? '—'}\``,  inline: true },
              { name: '💀 Deaths',value: `\`${stats.deaths ?? '—'}\``, inline: true },
              { name: '📊 Score', value: `\`${stats.score ?? '—'}\``,  inline: true },
            )
            .setFooter({ text: `Tournoi : ${tournoi.name}` })
            .setTimestamp()
        ]});
      }

    } catch (error) {
      console.error('❌ OCR error:', error.message);
      return interaction.editReply({ content: '❌ Erreur lors de l\'analyse du screenshot. Réessaie ou contacte un admin.' });
    }
  }
};