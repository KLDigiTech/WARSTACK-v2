const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('📋 Reposte le panneau de contrôle WARSTACK dans #panneau — Admin only')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelChannel = interaction.guild.channels.cache.find(
      c => c.name.includes('panneau') && c.type === ChannelType.GuildText
    );

    if (!panelChannel) {
      return interaction.editReply({ content: '❌ Salon #panneau introuvable. Lance `/setup` d\'abord.' });
    }

    const messages = await panelChannel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(m => m.author.id === interaction.client.user.id);
    await Promise.all(botMessages.map(m => m.delete()));

    const embed = new EmbedBuilder()
      .setTitle('⚔️ WARSTACK — PANNEAU DE CONTRÔLE')
      .setColor(0x00FF66)
      .setImage('https://raw.githubusercontent.com/KLDigiTech/WARSTACK-v2/main/dashboard/warstack-banner.png')
      .setDescription('Bienvenue sur le serveur WARSTACK.\nUtilise les boutons ci-dessous pour participer aux tournois.')
      .addFields(
        { name: '🎮 S\'inscrire',  value: 'Rejoins le tournoi en cours',           inline: true },
        { name: '📸 Soumettre',    value: 'Envoie ton screenshot de fin de partie', inline: true },
        { name: '🏆 Classement',   value: 'Consulte le classement en direct',       inline: true },
        { name: '⚙️ Dashboard',    value: 'Accède au dashboard WARSTACK',           inline: true }
      )
      .setFooter({ text: 'WARSTACK • Battlefield 6' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('🎮 S\'inscrire').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/inscription.html'),
      new ButtonBuilder().setLabel('📸 Soumettre').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/soumettre.html'),
      new ButtonBuilder().setLabel('🏆 Classement').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('⚙️ Dashboard').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/#overview')
    );

    await panelChannel.send({ embeds: [embed], components: [row1, row2] });

    return interaction.editReply({ content: '✅ Panneau reposté dans #panneau !' });
  }
};