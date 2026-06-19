const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const STRUCTURE = [
  {
    name: '⚔️ WARSTACK',
    channels: [
      { name: '📋│règlement',     type: ChannelType.GuildText,  locked: true  },
      { name: '📣│annonces',      type: ChannelType.GuildText,  locked: true  },
      { name: '🤖│commandes-bot', type: ChannelType.GuildText,  locked: false },
    ]
  },
  {
    name: '🏆 TOURNOI',
    channels: [
      { name: '🔗│accès-dashboard', type: ChannelType.GuildText, locked: true,  panel: true        },
      { name: '📝│inscription',     type: ChannelType.GuildText, locked: true,  inscription: true  },
      { name: '📸│soumissions',     type: ChannelType.GuildText, locked: false, soumissions: true  },
      { name: '🏅│classement',      type: ChannelType.GuildText, locked: true                      },
      { name: '🔴│tournoi-live',    type: ChannelType.GuildText, locked: true                      },
    ]
  },
  {
    name: '🎖️ RÉSULTATS',
    channels: [
      { name: '🏆│annonces-mvp', type: ChannelType.GuildText, locked: true },
      { name: '📊│résultats',    type: ChannelType.GuildText, locked: true },
    ]
  },
  {
    name: '💬 GÉNÉRAL',
    channels: [
      { name: '💬│général',       type: ChannelType.GuildText,  locked: false },
      { name: '🎮│gaming',        type: ChannelType.GuildText,  locked: false },
      { name: '🔊│vocal-général', type: ChannelType.GuildVoice, locked: false },
    ]
  },
  {
    name: '🔧 ADMIN',
    adminOnly: true,
    channels: [
      { name: '⚙️│admin-logs', type: ChannelType.GuildText, locked: true  },
      { name: '🛠️│bot-config', type: ChannelType.GuildText, locked: false },
    ]
  }
];

const setupInProgress = new Set();

async function setupStructure(guild) {

  if (setupInProgress.has(guild.id)) {
    console.log(`⚠️ Setup déjà en cours sur ${guild.name}, ignoré.`);
    return { success: false, reason: 'already_setup' };
  }

  setupInProgress.add(guild.id);

  try {

    await guild.channels.fetch();
    await guild.roles.fetch();
    await new Promise(resolve => setTimeout(resolve, 1500));

    const alreadySetup = guild.channels.cache.find(
      c => c.name === '⚔️ WARSTACK' && c.type === ChannelType.GuildCategory
    );

    if (alreadySetup) {
      console.log(`⚠️ WARSTACK déjà installé sur ${guild.name}, setup ignoré.`);
      return { success: false, reason: 'already_setup' };
    }

    console.log(`🔧 Installation WARSTACK sur ${guild.name}...`);

    let adminRole = guild.roles.cache.find(r => r.name === 'Admin');
    if (!adminRole) {
      adminRole = await guild.roles.create({
        name: 'Admin',
        color: 0x00FF66,
        permissions: [PermissionFlagsBits.Administrator],
        reason: 'WARSTACK setup'
      });
    }

    const everyone        = guild.roles.everyone;
    let   panelChannel    = null;
    let   inscriptChannel = null;
    let   soumChannel     = null;

    for (const category of STRUCTURE) {

      const catOverwrites = category.adminOnly
        ? [
            { id: everyone.id,  deny:  [PermissionFlagsBits.ViewChannel] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel] }
          ]
        : [];

      const cat = await guild.channels.create({
        name: category.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: catOverwrites,
        reason: 'WARSTACK setup'
      });

      for (const ch of category.channels) {

        const overwrites = [];

        if (category.adminOnly) {
          overwrites.push({ id: everyone.id,  deny:  [PermissionFlagsBits.ViewChannel]  });
          overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        } else if (ch.locked) {
          overwrites.push({ id: everyone.id,  deny:  [PermissionFlagsBits.SendMessages] });
          overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.SendMessages] });
        }

        const created = await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: cat.id,
          permissionOverwrites: overwrites,
          reason: 'WARSTACK setup'
        });

        if (ch.panel)       panelChannel    = created;
        if (ch.inscription) inscriptChannel = created;
        if (ch.soumissions) soumChannel     = created;
      }
    }

    // ✅ Bannière dynamique du serveur
    const bannerURL = guild.bannerURL({ size: 1024 });

    // ✅ Embed accès-dashboard
    if (panelChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF66)
        .setFooter({ text: 'WARSTACK • Battlefield 6' });

      if (bannerURL) embed.setImage(bannerURL);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('📊 Dashboard').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/#overview'),
        new ButtonBuilder().setLabel('📝 S\'inscrire').setStyle(ButtonStyle.Link).setURL(`https://warstack-v2.vercel.app/inscription.html?guild=${guild.id}`),
        new ButtonBuilder().setLabel('🏆 Classement').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/')
      );

      await panelChannel.send({ embeds: [embed], components: [row] });
    }

    // ✅ Embed inscription
    if (inscriptChannel) {
      const embed = new EmbedBuilder()
        .setTitle('📝 INSCRIPTION AU TOURNOI')
        .setColor(0x00FF66)
        .setDescription(
          '**Pour participer aux tournois WARSTACK, tu dois lier ton compte Battlefield 6.**\n\n' +
          '> Utilise la commande `/register` dans <#' + (guild.channels.cache.find(c => c.name.includes('commandes-bot'))?.id || '') + '>\n' +
          '> Ou clique sur le bouton ci-dessous pour t\'inscrire via le site.\n\n' +
          '⚠️ **Sans inscription, tes soumissions ne seront pas comptabilisées.**'
        )
        .setFooter({ text: 'WARSTACK • Battlefield 6' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('📝 S\'inscrire').setStyle(ButtonStyle.Link).setURL(`https://warstack-v2.vercel.app/inscription.html?guild=${guild.id}`)
      );

      await inscriptChannel.send({ embeds: [embed], components: [row] });
    }

    // ✅ Embed soumissions
    if (soumChannel) {
      const embed = new EmbedBuilder()
        .setTitle('📸 SOUMISSION DE SCREENSHOT')
        .setColor(0x00FF66)
        .setDescription(
          '**Poste ton screenshot directement dans ce salon.**\n\n' +
          '> Le screenshot doit être une **capture d\'écran** (console ou PC).\n' +
          '> ❌ Les photos prises avec un smartphone ne sont pas acceptées.\n\n' +
          '**La capture doit obligatoirement afficher :**\n' +
          '> 📄 **Page 2 — Votre escouade**\n' +
          '> 🏅 Le classement de fin de partie\n' +
          '> 💀 Les kills totaux de chaque joueur\n' +
          '> 💥 Les dégâts infligés\n' +
          '> 🎯 Le score individuel de chaque membre\n\n' +
          '⚠️ **Tout screenshot illisible ou incomplet sera rejeté automatiquement.**'
        )
        .setFooter({ text: 'WARSTACK • Battlefield 6' });

      await soumChannel.send({ embeds: [embed] });
    }

    console.log(`✅ Structure WARSTACK créée sur ${guild.name}`);
    return { success: true };

  } catch (err) {
    console.error(`❌ Erreur setupStructure sur ${guild.name}:`, err);
    return { success: false, reason: 'error', error: err };

  } finally {
    setupInProgress.delete(guild.id);
  }
}

module.exports = { setupStructure };