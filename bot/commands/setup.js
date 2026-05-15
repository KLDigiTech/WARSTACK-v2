const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configure les salons WARSTACK — Admin only'),

  async execute(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('🖥️ Dashboard Admin').setURL('https://warstack.netlify.app').setStyle(ButtonStyle.Link),
      new ButtonBuilder().setLabel('🌐 Classement Live').setURL('https://kldigitech.github.io/pof-bf6/Pages/tournoi.html').setStyle(ButtonStyle.Link),
      new ButtonBuilder().setLabel('💬 Serveur Discord').setURL('https://discord.gg/tonlien').setStyle(ButtonStyle.Link),
    );

    const embed = new EmbedBuilder()
      .setTitle('⚔️ WARSTACK — LES POTES Ö FEU')
      .setColor(0xFF6600)
      .setDescription(
        '**Bienvenue sur le serveur officiel PöF BF6 !**\n\n' +
        '📊 **Tournoi mensuel** — Classement automatique\n' +
        '🤖 **Bot WARSTACK** — Stats, classement, MVP\n' +
        '🌐 **Site PöF** — Classement live en temps réel\n\n' +
        '> Utilise `/link` pour enregistrer ton compte BF6\n' +
        '> Utilise `/stats` pour voir tes stats\n' +
        '> Utilise `/classement` pour voir le top 10'
      )
      .addFields({ name: '📋 Commandes', value: '`/link` `/stats` `/classement` `/mvp` `/profil` `/comparer`' })
      .setFooter({ text: 'WARSTACK • PöF BF6 Tournament' })
      .setTimestamp();

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    await msg.pin();
    await interaction.reply({ content: '✅ Message de bienvenue posté et épinglé !', ephemeral: true });
  }
};