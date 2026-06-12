const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../services/supabase');

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    console.log(`✅ WARSTACK rejoint : ${guild.name} (${guild.id})`);
    await new Promise(r => setTimeout(r, 2000));

    try {
      await guild.channels.fetch();

      // Vérifier si le salon existe déjà
      const existing = guild.channels.cache.find(c => c.name === 'warstack-dashboard');
      if (existing) {
        console.log(`⚠️ #warstack-dashboard déjà présent sur ${guild.name}`);
        return;
      }

      // Créer le salon
      const channel = await guild.channels.create({
        name: 'warstack-dashboard',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ],
        reason: 'WARSTACK — Installation initiale'
      });

      // Embed
      const embed = new EmbedBuilder()
        .setTitle('🚀 Bienvenue sur WARSTACK')
        .setDescription(
          '**WARSTACK est prêt à être configuré sur votre serveur.**\n\n' +
          '> Cliquez sur le bouton ci-dessous pour accéder au dashboard\n' +
          '> et terminer l\'installation en **2 minutes**.\n\n' +
          '✅ Connexion Discord OAuth sécurisée\n' +
          '✅ Aucun mot de passe requis\n' +
          '✅ Configuration guidée étape par étape'
        )
        .setColor(0x00FF66)
        .setFooter({ text: 'WARSTACK • Battlefield 6' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('⚙️ Terminer l\'installation')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.DASHBOARD_URL || 'https://warstack-v2.vercel.app'}/setup.html`)
      );

      await channel.send({ embeds: [embed], components: [row] });

      // Enregistrer en Supabase
      await supabase.from('guilds').upsert({
        guild_id      : guild.id,
        name          : guild.name,
        icon          : guild.iconURL({ size: 256 }),
        member_count  : guild.memberCount,
        setup_complete: false,
        joined_at     : new Date().toISOString(),
      }, { onConflict: 'guild_id' });

      console.log(`✅ #warstack-dashboard créé sur ${guild.name}`);

    } catch (err) {
      console.error(`❌ Erreur guildCreate sur ${guild.name}:`, err.message);
    }
  }
};