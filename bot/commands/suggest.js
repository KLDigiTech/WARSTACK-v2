const { SlashCommandBuilder } = require('discord.js');
const supabase                = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('💡 Soumettre une suggestion')
    .addStringOption(o =>
      o.setName('suggestion')
        .setDescription('Ta suggestion')
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    try {
      const content = interaction.options.getString('suggestion');
      const guild   = interaction.guild;

      // Récupérer config
      const { data: configs } = await supabase
        .from('config')
        .select('*')
        .eq('guild_id', guild.id);

      const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;

      const channelId = getConfig('suggestions_channel');
      const reactions = getConfig('suggestions_reactions') !== 'false';
      const threads   = getConfig('suggestions_threads') === 'true';
      const anonymous = getConfig('suggestions_anonymous') === 'true';
      const logsId    = getConfig('suggestions_logs');

      if (!channelId) {
        return interaction.reply({
          content: '❌ Le système de suggestions n\'est pas configuré.',
          ephemeral: true
        });
      }

      const enabled = getConfig('suggestions_enabled') === 'true';
      if (!enabled) {
        return interaction.reply({
          content: '❌ Les suggestions sont désactivées.',
          ephemeral: true
        });
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });
      }

      // Insérer en BDD
      const { data: suggestion, error } = await supabase
        .from('suggestions')
        .insert({
          discord_id: interaction.user.id,
          username  : anonymous ? 'Anonyme' : interaction.user.username,
          content,
          status    : 'pending',
        })
        .select()
        .single();

      if (error) {
        return interaction.reply({ content: '❌ Erreur lors de l\'enregistrement.', ephemeral: true });
      }

      // Envoyer le message
      const authorLine = anonymous ? '👤 Anonyme' : `👤 ${interaction.user.username}`;
      const msg = await channel.send(
        `💡 **Suggestion #${suggestion.id.slice(0, 8).toUpperCase()}**\n\n${content}\n\n${authorLine}\n🟡 **En attente**`
      );

      // Réactions auto
      if (reactions) {
        await msg.react('👍');
        await msg.react('👎');
      }

      // Thread auto
      if (threads) {
        await msg.startThread({
          name    : `💬 Discussion — ${content.slice(0, 50)}`,
          autoArchiveDuration: 1440,
        }).catch(() => {});
      }

      // Sauvegarder message_id
      await supabase
        .from('suggestions')
        .update({ message_id: msg.id })
        .eq('id', suggestion.id);

      // Log staff
      if (logsId) {
        const logsChannel = guild.channels.cache.get(logsId);
        if (logsChannel) {
          await logsChannel.send(
            `📋 Nouvelle suggestion de **${interaction.user.username}** :\n> ${content}`
          );
        }
      }

      await interaction.reply({
        content : '✅ Ta suggestion a été soumise !',
        ephemeral: true
      });

    } catch (err) {
      console.error('❌ suggest error:', err.message);
      await interaction.reply({ content: '❌ Erreur inattendue.', ephemeral: true });
    }
  }
};