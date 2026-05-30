const supabase = require('../services/supabase');

const TICKET_TYPES = {
  ticket_support    : { id: 'support',     label: 'Support Technique', emoji: '🔧' },
  ticket_bug        : { id: 'bug',         label: 'Bug',               emoji: '🐛' },
  ticket_appeal     : { id: 'appeal',      label: 'Appel de Sanction', emoji: '⚖️' },
  ticket_partnership: { id: 'partnership', label: 'Partenariat',       emoji: '🤝' },
  ticket_application: { id: 'application', label: 'Candidature Staff', emoji: '📝' },
  ticket_other      : { id: 'other',       label: 'Autre',             emoji: '❓' },
};

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {

    // ── COMMANDES SLASH ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true });
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`❌ Erreur commande /${interaction.commandName}:`, error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Une erreur est survenue.' });
          } else {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
          }
        } catch (e) {
          console.error('❌ Impossible de répondre:', e.message);
        }
      }
      return;
    }

    // ── BOUTONS TICKETS ───────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
      const ticketType = TICKET_TYPES[interaction.customId];
      if (!ticketType) return;

      const guild  = interaction.guild;
      const member = interaction.member;

      await interaction.deferReply({ ephemeral: true });

      try {
        // Charger config
        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', guild.id);

        const getConfig = (key) => configs?.find(c => c.key === key)?.value;
        const categoryId  = getConfig('ticket_category');
        const staffRoleId = getConfig('ticket_staff_role');
        const logChId     = getConfig('ticket_logs_channel');

        // Vérifier si ticket déjà ouvert
        const { data: existing } = await supabase
          .from('tickets')
          .select('id')
          .eq('discord_id', member.user.id)
          .eq('status', 'open')
          .single();

        if (existing) {
          return interaction.editReply({ content: '❌ Tu as déjà un ticket ouvert !' });
        }

        // Créer le salon ticket
        const channelName = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

        const permissionOverwrites = [
          { id: guild.roles.everyone, deny: ['ViewChannel'] },
          { id: member.user.id,       allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ];

        if (staffRoleId) {
          permissionOverwrites.push({
            id   : staffRoleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
          });
        }

        const ticketChannel = await guild.channels.create({
          name    : channelName,
          type    : 0,
          parent  : categoryId || null,
          permissionOverwrites,
        });

        // Enregistrer en BDD
        const { data: ticket } = await supabase
          .from('tickets')
          .insert({
            guild_id  : guild.id,
            discord_id: member.user.id,
            username  : member.user.username,
            type      : ticketType.id,
            channel_id: ticketChannel.id,
            status    : 'open',
          })
          .select()
          .single();

        // Message dans le ticket
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Fermer le ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          content: `${ticketType.emoji} **Ticket ${ticketType.label}**\n\n${member} a ouvert un ticket. Le staff va te répondre rapidement.\n\n📋 **Décris ton problème ci-dessous.**`,
          components: [closeRow],
        });

        // Log
        if (logChId) {
          const logCh = guild.channels.cache.get(logChId);
          if (logCh) {
            await logCh.send(
              `🎫 Nouveau ticket **${ticketType.label}** ouvert par **${member.user.username}** → ${ticketChannel}`
            );
          }
        }

        await interaction.editReply({
          content: `✅ Ton ticket a été créé : ${ticketChannel}`,
        });

      } catch (err) {
        console.error('❌ Ticket error:', err.message);
        await interaction.editReply({ content: '❌ Erreur lors de la création du ticket.' });
      }
      return;
    }

    // ── BOUTON FERMER TICKET ──────────────────────────────
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('*')
          .eq('channel_id', interaction.channelId)
          .single();

        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });

        await supabase
          .from('tickets')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', ticket.id);

        await interaction.channel.send('🔒 Ticket fermé. Le salon sera supprimé dans 5 secondes.');
        await interaction.editReply({ content: '✅ Ticket fermé.' });

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);

      } catch (err) {
        console.error('❌ Close ticket error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
      }
      return;
    }
  }
};