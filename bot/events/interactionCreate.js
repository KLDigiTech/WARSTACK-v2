const supabase = require('../services/supabase');

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

    // ── BOUTONS OUVERTURE TICKET (ticket_cat_{uuid}) ──────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cat_')) {

      const categoryId = interaction.customId.replace('ticket_cat_', '');
      const guild      = interaction.guild;
      const member     = interaction.member;

      await interaction.deferReply({ ephemeral: true });

      try {
        // Charger la catégorie depuis Supabase
        const { data: catData } = await supabase
          .from('ticket_categories')
          .select('*')
          .eq('id', categoryId)
          .single();

        const ticketType = catData
          ? { id: catData.id, label: catData.label, emoji: catData.emoji }
          : { id: categoryId, label: 'Ticket', emoji: '🎫' };

        // Charger config
        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', guild.id);

        const getConfig = (key) => configs?.find(c => c.key === key)?.value;
        const categoryWaitingId = getConfig('ticket_category_waiting');
        const categoryId2       = categoryWaitingId || getConfig('ticket_category');
        const staffRoleId       = getConfig('ticket_staff_role');
        const leaderRoleId      = getConfig('ticket_leader_role');
        const logChId           = getConfig('ticket_logs_channel');

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
          { id: member.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ];

        if (staffRoleId) {
          permissionOverwrites.push({
            id   : staffRoleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
          });
        }

        if (leaderRoleId && leaderRoleId !== staffRoleId) {
          permissionOverwrites.push({
            id   : leaderRoleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
          });
        }

        const ticketChannel = await guild.channels.create({
          name    : channelName,
          type    : 0,
          parent  : categoryId2 || null,
          permissionOverwrites,
        });

        // Enregistrer en BDD
        await supabase
          .from('tickets')
          .insert({
            guild_id        : guild.id,
            discord_id      : member.user.id,
            username        : member.user.username,
            type            : ticketType.id,
            channel_id      : ticketChannel.id,
            status          : 'open',
            last_activity_at: new Date().toISOString(),
          });

        // Message dans le ticket
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_take_staff')
            .setLabel('Prendre en charge')
            .setEmoji('🎖️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_take_leader')
            .setLabel('Contacter un Leader')
            .setEmoji('👑')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Fermer')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
        );

        await ticketChannel.send({
          content: `${ticketType.emoji} **Ticket ${ticketType.label}**\n\n${member} a ouvert un ticket.\n\n📋 **Décris ton problème ci-dessous.**\n\n⏳ Un membre du staff va te répondre rapidement.`,
          components: [row],
        });

        if (logChId) {
          const logCh = guild.channels.cache.get(logChId);
          if (logCh) {
            await logCh.send(
              `🎫 Nouveau ticket **${ticketType.label}** ouvert par **${member.user.username}** → ${ticketChannel}`
            );
          }
        }

        await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });

      } catch (err) {
        console.error('❌ Ticket error:', err.message);
        await interaction.editReply({ content: '❌ Erreur lors de la création du ticket.' });
      }
      return;
    }

    // ── BOUTON PRENDRE EN CHARGE (Staff) ─────────────────
    if (interaction.isButton() && interaction.customId === 'ticket_take_staff') {
      await interaction.deferReply({ ephemeral: false });

      try {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('*')
          .eq('channel_id', interaction.channelId)
          .single();

        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });
        if (ticket.status === 'closed') return interaction.editReply({ content: '❌ Ce ticket est déjà fermé.' });

        const staffName = interaction.member.displayName || interaction.user.username;

        await supabase
          .from('tickets')
          .update({
            status          : 'in_progress',
            assigned_to     : staffName,
            taken_by_id     : interaction.user.id,
            taken_at        : new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', ticket.id);

        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', interaction.guild.id);

        const getConfig = (key) => configs?.find(c => c.key === key)?.value;
        const categoryActiveId = getConfig('ticket_category_active');

        if (categoryActiveId) {
          await interaction.channel.setParent(categoryActiveId, { lockPermissions: false });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const rowUpdated = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_take_staff')
            .setLabel('Pris en charge')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('ticket_take_leader')
            .setLabel('Contacter un Leader')
            .setEmoji('👑')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Fermer')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
        );

        try {
          const messages = await interaction.channel.messages.fetch({ limit: 10 });
          const botMsg   = messages.find(m => m.author.bot && m.components?.length > 0);
          if (botMsg) {
            await botMsg.edit({
              content   : botMsg.content + `\n\n✅ **Pris en charge par ${interaction.member} (${staffName})**`,
              components: [rowUpdated],
            });
          }
        } catch {}

        await interaction.editReply({ content: `🎖️ **${staffName}** prend en charge ce ticket.` });

      } catch (err) {
        console.error('❌ Take staff error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
      }
      return;
    }

    // ── BOUTON CONTACTER UN LEADER ────────────────────────
    if (interaction.isButton() && interaction.customId === 'ticket_take_leader') {
      await interaction.deferReply({ ephemeral: false });

      try {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('*')
          .eq('channel_id', interaction.channelId)
          .single();

        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });
        if (ticket.status === 'closed') return interaction.editReply({ content: '❌ Ce ticket est déjà fermé.' });

        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', interaction.guild.id);

        const getConfig   = (key) => configs?.find(c => c.key === key)?.value;
        const leaderRoleId = getConfig('ticket_leader_role');

        await supabase
          .from('tickets')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', ticket.id);

        const mention = leaderRoleId ? `<@&${leaderRoleId}>` : '**@Leader**';
        await interaction.editReply({
          content: `👑 ${mention} — intervention demandée dans ce ticket par ${interaction.member}.`,
        });

      } catch (err) {
        console.error('❌ Take leader error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
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

        // Update BDD
        await supabase
          .from('tickets')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', ticket.id);

        // Changer catégorie Discord → Clôturé
        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', interaction.guild.id);

        const getConfig        = (key) => configs?.find(c => c.key === key)?.value;
        const categoryClosedId = getConfig('ticket_category_closed');

        if (categoryClosedId) {
          await interaction.channel.setParent(categoryClosedId, { lockPermissions: false });
          await interaction.channel.permissionOverwrites.edit(ticket.discord_id, {
            SendMessages: false,
          }).catch(() => {});
        }

        // Transcription
        const transcriptEnabled = getConfig('ticket_transcript') !== 'false';
        const logChId           = getConfig('ticket_logs_channel');

        if (transcriptEnabled && logChId) {
          const logCh = interaction.guild.channels.cache.get(logChId);
          if (logCh) {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const lines = [...messages.values()]
              .reverse()
              .map(m => `[${new Date(m.createdTimestamp).toLocaleString('fr-FR')}] ${m.author.username}: ${m.content}`)
              .join('\n');

            const { AttachmentBuilder } = require('discord.js');
            const buf = Buffer.from(lines, 'utf-8');
            const att = new AttachmentBuilder(buf, { name: `ticket-${ticket.id}.txt` });
            await logCh.send({ content: `📄 Transcription — ticket fermé par **${interaction.user.username}**`, files: [att] });
          }
        }

        // Désactiver les boutons
        try {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const allMessages = await interaction.channel.messages.fetch({ limit: 20 });
          const botMsg = allMessages.find(m => m.author.bot && m.components?.length > 0);
          if (botMsg) {
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('ticket_take_staff') .setLabel('Pris en charge').setEmoji('✅').setStyle(ButtonStyle.Success)  .setDisabled(true),
              new ButtonBuilder().setCustomId('ticket_take_leader').setLabel('Leader')        .setEmoji('👑').setStyle(ButtonStyle.Secondary).setDisabled(true),
              new ButtonBuilder().setCustomId('ticket_close')      .setLabel('Fermé')         .setEmoji('🔒').setStyle(ButtonStyle.Danger)   .setDisabled(true),
            );
            await botMsg.edit({ components: [disabledRow] });
          }
        } catch {}

        await interaction.channel.send('🔒 Ticket clôturé. Salon archivé.');
        await interaction.editReply({ content: '✅ Ticket fermé.' });

        if (!categoryClosedId) {
          setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

      } catch (err) {
        console.error('❌ Close ticket error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
      }
      return;
    }
  }
};