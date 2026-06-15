const supabase = require('../services/supabase');
const { handleOnboardingInteraction } = require('../services/onboarding');

// Vérifie si un membre a le rôle Staff, le rôle Leader, ou est admin du serveur.
function isStaffOrLeader(member, configs) {
  if (member.permissions?.has?.('Administrator')) return true;
  const getConfig   = (key) => configs?.find(c => c.key === key)?.value;
  const staffRoleId  = getConfig('ticket_staff_role');
  const leaderRoleId = getConfig('ticket_leader_role');
  if (staffRoleId  && member.roles.cache.has(staffRoleId))  return true;
  if (leaderRoleId && member.roles.cache.has(leaderRoleId)) return true;
  return false;
}

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

    // ── ONBOARDING ────────────────────────────────────────
    if (
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
      (
        interaction.customId === 'ob_accept_rules'  ||
        interaction.customId.startsWith('ob_team_') ||
        interaction.customId.startsWith('ob_plat_') ||
        interaction.customId === 'ob_games_select'  ||
        interaction.customId === 'ob_tracker_link'  ||
        interaction.customId === 'ob_tracker_modal' ||
        interaction.customId === 'ob_tracker_skip'
      )
    ) {
      const handled = await handleOnboardingInteraction(interaction);
      if (handled) return;
    }

    // ── BOUTONS OUVERTURE TICKET (ticket_cat_{uuid}) ──────
    // Affiche un modal pour que le membre décrive son problème avant création du salon
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cat_')) {
      const categoryId = interaction.customId.replace('ticket_cat_', '');

      // Vérifier ticket existant AVANT d'afficher le modal
      const { data: existing } = await supabase
        .from('tickets')
        .select('id')
        .eq('discord_id', interaction.user.id)
        .in('status', ['open', 'in_progress'])
        .maybeSingle();

      if (existing) {
        return interaction.reply({ content: '❌ Tu as déjà un ticket ouvert !', ephemeral: true });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${categoryId}`)
        .setTitle('📋 Ouvrir un ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Sujet')
        .setPlaceholder('Résumé en quelques mots...')
        .setStyle(TextInputStyle.Short)
        .setMinLength(5)
        .setMaxLength(100)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Description')
        .setPlaceholder('Décris ton problème en détail...')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // ── MODAL SUBMIT TICKET (ticket_modal_{uuid}) ─────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
      const categoryId = interaction.customId.replace('ticket_modal_', '');
      const guild      = interaction.guild;
      const member     = interaction.member;
      const subject    = interaction.fields.getTextInputValue('ticket_subject');
      const description = interaction.fields.getTextInputValue('ticket_description');

      await interaction.deferReply({ ephemeral: true });

      try {
        const { data: catData } = await supabase
          .from('ticket_categories')
          .select('*')
          .eq('id', categoryId)
          .single();

        const ticketType = catData
          ? { id: catData.id, label: catData.label, emoji: catData.emoji }
          : { id: categoryId, label: 'Ticket', emoji: '🎫' };

        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', guild.id);

        const getConfig         = (key) => configs?.find(c => c.key === key)?.value;
        const categoryWaitingId = getConfig('ticket_category_waiting');
        const staffRoleId       = getConfig('ticket_staff_role');
        const leaderRoleId      = getConfig('ticket_leader_role');
        const logChId           = getConfig('ticket_logs_channel');

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
          parent  : categoryWaitingId || null,
          permissionOverwrites,
        });

        await supabase.from('tickets').insert({
          guild_id        : guild.id,
          discord_id      : member.user.id,
          username        : member.user.username,
          type            : ticketType.id,
          subject         : subject,
          channel_id      : ticketChannel.id,
          status          : 'open',
          last_activity_at: new Date().toISOString(),
        });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(0x00ff66)
          .setTitle(`${ticketType.emoji} Ticket — ${ticketType.label}`)
          .setDescription(`**${member.user.username}** a ouvert un ticket.`)
          .addFields(
            { name: '📌 Sujet',       value: subject,      inline: false },
            { name: '📋 Description', value: description,  inline: false },
          )
          .setTimestamp()
          .setFooter({ text: 'Un membre du staff va te répondre rapidement.' });

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

        await ticketChannel.send({ embeds: [embed], components: [row] });

        if (logChId) {
          const logCh = guild.channels.cache.get(logChId);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(`🎫 Nouveau ticket — ${ticketType.label}`)
              .addFields(
                { name: 'Membre',  value: `${member}`,  inline: true },
                { name: 'Sujet',   value: subject,      inline: true },
                { name: 'Salon',   value: `${ticketChannel}`, inline: true },
              )
              .setTimestamp();
            await logCh.send({ embeds: [logEmbed] });
          }
        }

        await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });

      } catch (err) {
        console.error('❌ Ticket modal error:', err.message);
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

        await supabase.from('tickets').update({
          status          : 'in_progress',
          assigned_to     : staffName,
          taken_by_id     : interaction.user.id,
          taken_at        : new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }).eq('id', ticket.id);

        const { data: configs } = await supabase
          .from('config').select('*').eq('guild_id', interaction.guild.id);

        const getConfig = (key) => configs?.find(c => c.key === key)?.value;
        const categoryActiveId = getConfig('ticket_category_active');

        if (categoryActiveId) {
          await interaction.channel.setParent(categoryActiveId, { lockPermissions: false });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const rowUpdated = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_take_staff') .setLabel('Pris en charge')      .setEmoji('✅').setStyle(ButtonStyle.Success)  .setDisabled(true),
          new ButtonBuilder().setCustomId('ticket_take_leader').setLabel('Contacter un Leader')  .setEmoji('👑').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket_close')      .setLabel('Fermer')               .setEmoji('🔒').setStyle(ButtonStyle.Danger),
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
          .from('tickets').select('*').eq('channel_id', interaction.channelId).single();

        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });
        if (ticket.status === 'closed') return interaction.editReply({ content: '❌ Ce ticket est déjà fermé.' });

        const { data: configs } = await supabase
          .from('config').select('*').eq('guild_id', interaction.guild.id);

        const getConfig    = (key) => configs?.find(c => c.key === key)?.value;
        const leaderRoleId = getConfig('ticket_leader_role');

        await supabase.from('tickets')
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
          .from('tickets').select('*').eq('channel_id', interaction.channelId).single();

        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });

        await supabase.from('tickets')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', ticket.id);

        const { data: configs } = await supabase
          .from('config').select('*').eq('guild_id', interaction.guild.id);

        const getConfig        = (key) => configs?.find(c => c.key === key)?.value;
        const categoryClosedId = getConfig('ticket_category_closed');

        if (categoryClosedId) {
          await interaction.channel.setParent(categoryClosedId, { lockPermissions: false });
          await interaction.channel.permissionOverwrites.edit(ticket.discord_id, {
            SendMessages: false,
          }).catch(() => {});
        }

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

    // ── BOUTON STAFF : CONVOQUER UN MEMBRE ────────────────
    // Réservé aux rôles Staff / Leader (ou admin). Permet d'ouvrir
    // un ticket avec un membre ciblé pour lui parler d'un sujet.
    if (interaction.isButton() && interaction.customId === 'ticket_staff_summon') {
      const { data: configs } = await supabase
        .from('config').select('*').eq('guild_id', interaction.guild.id);

      if (!isStaffOrLeader(interaction.member, configs)) {
        return interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
      }

      const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

      const select = new UserSelectMenuBuilder()
        .setCustomId('ticket_staff_select_user')
        .setPlaceholder('Choisis le membre à convoquer')
        .setMinValues(1)
        .setMaxValues(1);

      await interaction.reply({
        content: '👤 Sélectionne le membre que tu veux convoquer :',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
      return;
    }

    // ── SELECT MENU : MEMBRE CIBLÉ POUR CONVOCATION ───────
    if (interaction.isUserSelectMenu() && interaction.customId === 'ticket_staff_select_user') {
      const { data: configs } = await supabase
        .from('config').select('*').eq('guild_id', interaction.guild.id);

      if (!isStaffOrLeader(interaction.member, configs)) {
        return interaction.update({ content: '❌ Réservé au staff.', components: [] });
      }

      const targetId = interaction.values[0];

      if (targetId === interaction.user.id) {
        return interaction.update({ content: '❌ Tu ne peux pas te convoquer toi-même.', components: [] });
      }

      const { data: existing } = await supabase
        .from('tickets')
        .select('id')
        .eq('discord_id', targetId)
        .eq('guild_id', interaction.guild.id)
        .in('status', ['open', 'in_progress'])
        .maybeSingle();

      if (existing) {
        return interaction.update({ content: '❌ Ce membre a déjà un ticket ouvert.', components: [] });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      const modal = new ModalBuilder()
        .setCustomId(`ticket_staff_modal_${targetId}`)
        .setTitle('🗣️ Convoquer un membre');

      const reasonInput = new TextInputBuilder()
        .setCustomId('ticket_staff_reason')
        .setLabel('Sujet de la convocation')
        .setPlaceholder('De quoi veux-tu parler avec ce membre ?')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(5)
        .setMaxLength(1000)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

      await interaction.showModal(modal);
      return;
    }

    // ── MODAL SUBMIT : CRÉATION TICKET DE CONVOCATION ─────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_staff_modal_')) {
      const targetId = interaction.customId.replace('ticket_staff_modal_', '');
      const guild    = interaction.guild;
      const reason   = interaction.fields.getTextInputValue('ticket_staff_reason');

      await interaction.deferReply({ ephemeral: true });

      try {
        const targetMember = await guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) {
          return interaction.editReply({ content: '❌ Membre introuvable sur ce serveur.' });
        }

        const { data: configs } = await supabase
          .from('config').select('*').eq('guild_id', guild.id);

        const getConfig         = (key) => configs?.find(c => c.key === key)?.value;
        const categoryActiveId  = getConfig('ticket_category_active') || getConfig('ticket_category_waiting');
        const staffRoleId       = getConfig('ticket_staff_role');
        const leaderRoleId      = getConfig('ticket_leader_role');
        const logChId           = getConfig('ticket_logs_channel');

        const channelName = `ticket-${targetMember.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

        const permissionOverwrites = [
          { id: guild.roles.everyone, deny: ['ViewChannel'] },
          { id: targetMember.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
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
          parent  : categoryActiveId || null,
          permissionOverwrites,
        });

        const staffName = interaction.member.displayName || interaction.user.username;

        await supabase.from('tickets').insert({
          guild_id        : guild.id,
          discord_id      : targetMember.user.id,
          username        : targetMember.user.username,
          type            : 'staff_summon',
          subject         : reason,
          channel_id      : ticketChannel.id,
          status          : 'in_progress',
          assigned_to     : staffName,
          taken_by_id      : interaction.user.id,
          taken_at        : new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(0xff9900)
          .setTitle('🗣️ Convocation — Staff')
          .setDescription(`**${staffName}** souhaite te parler, ${targetMember} :`)
          .addFields({ name: '📌 Sujet', value: reason, inline: false })
          .setTimestamp()
          .setFooter({ text: `Convoqué par ${staffName}` });

        const row = new ActionRowBuilder().addComponents(
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

        await ticketChannel.send({ content: `${targetMember}`, embeds: [embed], components: [row] });

        if (logChId) {
          const logCh = guild.channels.cache.get(logChId);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xff9900)
              .setTitle('🗣️ Convocation — Staff')
              .addFields(
                { name: 'Membre',    value: `${targetMember}`, inline: true },
                { name: 'Convoqué par', value: staffName,       inline: true },
                { name: 'Salon',     value: `${ticketChannel}`, inline: true },
              )
              .setTimestamp();
            await logCh.send({ embeds: [logEmbed] });
          }
        }

        await interaction.editReply({ content: `✅ Ticket de convocation créé : ${ticketChannel}` });

      } catch (err) {
        console.error('❌ Ticket staff summon error:', err.message);
        await interaction.editReply({ content: '❌ Erreur lors de la création du ticket.' });
      }
      return;
    }

    // ── BOUTONS REACTION ROLES ────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('rxrole_')) {
      const roleId = interaction.customId.replace('rxrole_', '');
      const member = interaction.member;

      await interaction.deferReply({ ephemeral: true });

      try {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ Rôle introuvable.' });

        const { data: menu } = await supabase
          .from('reaction_menus')
          .select('*, reaction_roles(*)')
          .eq('message_id', interaction.message.id)
          .single();

        if (menu?.type === 'unique') {
          const otherRoleIds = (menu.reaction_roles || [])
            .map(r => r.role_id)
            .filter(id => id !== roleId);
          for (const id of otherRoleIds) {
            const r = interaction.guild.roles.cache.get(id);
            if (r && member.roles.cache.has(id)) await member.roles.remove(r).catch(() => {});
          }
        }

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role);
          await interaction.editReply({ content: `✅ Rôle **${role.name}** retiré.` });
        } else {
          await member.roles.add(role);
          await interaction.editReply({ content: `✅ Rôle **${role.name}** obtenu !` });
        }
      } catch (err) {
        console.error('❌ rxrole error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
      }
      return;
    }

    // ── SELECT MENU REACTION ROLES ────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rxmenu_')) {
      const menuId   = interaction.customId.replace('rxmenu_', '');
      const member   = interaction.member;
      const selected = interaction.values;

      await interaction.deferReply({ ephemeral: true });

      try {
        const { data: menu } = await supabase
          .from('reaction_menus')
          .select('*, reaction_roles(*)')
          .eq('id', menuId)
          .single();

        if (!menu) return interaction.editReply({ content: '❌ Menu introuvable.' });

        const allRoleIds = (menu.reaction_roles || []).map(r => r.role_id);

        if (menu.type === 'unique') {
          for (const id of allRoleIds) {
            const r = interaction.guild.roles.cache.get(id);
            if (r && member.roles.cache.has(id)) await member.roles.remove(r).catch(() => {});
          }
          for (const id of selected) {
            const r = interaction.guild.roles.cache.get(id);
            if (r) await member.roles.add(r).catch(() => {});
          }
        } else {
          for (const id of selected) {
            const r = interaction.guild.roles.cache.get(id);
            if (!r) continue;
            if (member.roles.cache.has(id)) await member.roles.remove(r).catch(() => {});
            else await member.roles.add(r).catch(() => {});
          }
        }

        await interaction.editReply({ content: `✅ Rôles mis à jour !` });
      } catch (err) {
        console.error('❌ rxmenu error:', err.message);
        await interaction.editReply({ content: '❌ Erreur.' });
      }
      return;
    }
  }
};