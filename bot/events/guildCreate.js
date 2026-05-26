const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const STRUCTURE = [
  {
    name: '⚔️ WARSTACK',
    channels: [
      { name: '📋│règlement',       type: ChannelType.GuildText, locked: true },
      { name: '📣│annonces',        type: ChannelType.GuildText, locked: true },
      { name: '🤖│commandes-bot',   type: ChannelType.GuildText, locked: false },
    ]
  },
  {
    name: '🏆 TOURNOI',
    channels: [
      { name: '🎮│panneau',         type: ChannelType.GuildText, locked: true, panel: true },
      { name: '📸│soumissions',     type: ChannelType.GuildText, locked: true },
      { name: '🏅│classement',      type: ChannelType.GuildText, locked: true },
      { name: '🔴│tournoi-live',    type: ChannelType.GuildText, locked: true },
    ]
  },
  {
    name: '🎖️ RÉSULTATS',
    channels: [
      { name: '🏆│annonces-mvp',    type: ChannelType.GuildText, locked: true },
      { name: '📊│résultats',       type: ChannelType.GuildText, locked: true },
    ]
  },
  {
    name: '💬 GÉNÉRAL',
    channels: [
      { name: '💬│général',         type: ChannelType.GuildText, locked: false },
      { name: '🎮│gaming',          type: ChannelType.GuildText, locked: false },
      { name: '🔊│vocal-général',   type: ChannelType.GuildVoice, locked: false },
    ]
  },
  {
    name: '🔧 ADMIN',
    adminOnly: true,
    channels: [
      { name: '⚙️│admin-logs',      type: ChannelType.GuildText, locked: true },
      { name: '🛠️│bot-config',      type: ChannelType.GuildText, locked: false },
    ]
  }
];

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild, client) {
    console.log(`✅ WARSTACK rejoint le serveur : ${guild.name}`);

    try {
      // Récupérer ou créer le rôle Admin
      let adminRole = guild.roles.cache.find(r => r.name === 'Admin');
      if (!adminRole) {
        adminRole = await guild.roles.create({
          name: 'Admin',
          color: 0xFF6600,
          permissions: [PermissionFlagsBits.Administrator],
          reason: 'WARSTACK setup'
        });
      }

      // Récupérer @everyone
      const everyone = guild.roles.everyone;

      let panelChannel = null;

      for (const category of STRUCTURE) {
        // Créer la catégorie
        const permOverwrites = category.adminOnly ? [
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel] },
        ] : [];

        const cat = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: permOverwrites,
          reason: 'WARSTACK setup'
        });

        for (const ch of category.channels) {
          const overwrites = [];

          if (category.adminOnly) {
            overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
            overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
          } else if (ch.locked) {
            overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.SendMessages] });
            overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.SendMessages] });
          }

          const channel = await guild.channels.create({
            name: ch.name,
            type: ch.type,
            parent: cat.id,
            permissionOverwrites: overwrites,
            reason: 'WARSTACK setup'
          });

          if (ch.panel) panelChannel = channel;
        }
      }

      // Poster le panneau de contrôle
      if (panelChannel) {
        const embed = new EmbedBuilder()
          .setTitle('⚔️ WARSTACK — PANNEAU DE CONTRÔLE')
          .setColor(0x00FF66)
          .setDescription('Bienvenue sur le serveur WARSTACK.\nUtilise les boutons ci-dessous pour participer aux tournois.')
          .addFields(
            { name: '🎮 S\'inscrire', value: 'Rejoins le tournoi en cours', inline: true },
            { name: '📸 Soumettre', value: 'Envoie ton screenshot de fin de partie', inline: true },
            { name: '🏆 Classement', value: 'Consulte le classement en direct', inline: true },
          )
          .setFooter({ text: 'WARSTACK • Battlefield 6' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🎮 S\'inscrire')
            .setStyle(ButtonStyle.Link)
            .setURL('https://warstack-v2.vercel.app/inscription.html'),
          new ButtonBuilder()
            .setLabel('📸 Soumettre')
            .setStyle(ButtonStyle.Link)
            .setURL('https://warstack-v2.vercel.app/soumettre.html'),
          new ButtonBuilder()
            .setLabel('🏆 Classement')
            .setStyle(ButtonStyle.Link)
            .setURL('https://warstack-v2.vercel.app/'),
        );

        await panelChannel.send({ embeds: [embed], components: [row] });
      }

      console.log(`✅ Structure WARSTACK créée sur ${guild.name}`);

    } catch (err) {
      console.error('❌ Erreur guildCreate:', err.message);
    }
  }
};