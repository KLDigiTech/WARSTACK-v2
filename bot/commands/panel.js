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
    .setDescription('🔗 Reposte le panneau dans #accès-dashboard — Admin only')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelChannel = interaction.guild.channels.cache.find(
      c => c.name.includes('accès-dashboard') && c.type === ChannelType.GuildText
    );

    if (!panelChannel) {
      return interaction.editReply({ content: '❌ Salon #accès-dashboard introuvable. Lance `/setup` d\'abord.' });
    }

    const messages    = await panelChannel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(m => m.author.id === interaction.client.user.id);
    await Promise.all(botMessages.map(m => m.delete()));

    const bannerURL = interaction.guild.bannerURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setColor(0x00FF66)
      .setFooter({ text: 'WARSTACK • Battlefield 6' });

    if (bannerURL) embed.setImage(bannerURL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('📊 Dashboard').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/#overview'),
      new ButtonBuilder().setLabel('📝 S\'inscrire').setStyle(ButtonStyle.Link).setURL(`https://warstack-v2.vercel.app/inscription.html?guild=${interaction.guild.id}`),
      new ButtonBuilder().setLabel('🏆 Classement').setStyle(ButtonStyle.Link).setURL('https://warstack-v2.vercel.app/')
    );

    await panelChannel.send({ embeds: [embed], components: [row] });

    return interaction.editReply({ content: '✅ Panneau reposté dans #accès-dashboard !' });
  }
};