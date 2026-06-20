const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const supabase = require('../services/supabase');

const DASHBOARD_URL = 'https://warstack-v2.vercel.app';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel-public')
    .setDescription('🌐 Poste le panneau public WARSTACK dans ce salon (visible par tous)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild   = interaction.guild;
    const guildId = guild.id;

    // ── Stats live ───────────────────────────────────────────
    const [xpRows, eventRows, ticketRows, tournamentRows] = await Promise.all([
      supabase.from('warstack_xp').select('xp,discord_id').eq('guild_id', guildId).order('xp', { ascending: false }).limit(1),
      supabase.from('events').select('id').eq('guild_id', guildId).eq('status', 'active'),
      supabase.from('tickets').select('id').eq('guild_id', guildId).in('status', ['closed', 'archived']),
      supabase.from('tournaments').select('id').eq('guild_id', guildId).eq('status', 'active'),
    ]);

    const topXp        = xpRows.data?.[0] || null;
    const eventsCount  = eventRows.data?.length || 0;
    const ticketsCount = ticketRows.data?.length || 0;
    const tournoiActif = (tournamentRows.data?.length || 0) > 0;

    let topPlayerName = null;
    if (topXp) {
      const member = await guild.members.fetch(topXp.discord_id).catch(() => null);
      topPlayerName = member?.user?.username || null;
    }

    // ── Embed ───────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x00ff66)
      .setTitle(`⚔️ ${guild.name}`)
      .setDescription('Bienvenue sur la communauté Battlefield 6. Rejoins-nous, grimpe le classement, participe aux tournois.')
      .setThumbnail(guild.iconURL({ size: 256 }) || null)
      .addFields(
        { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Événements actifs', value: `${eventsCount}`, inline: true },
        { name: '✅ Tickets résolus', value: `${ticketsCount}`, inline: true },
      )
      .setFooter({ text: 'WARSTACK • Battlefield 6' });

    if (topPlayerName) {
      embed.addFields({ name: '🏆 Top joueur', value: `${topPlayerName} (${topXp.xp} XP)`, inline: false });
    }
    if (tournoiActif) {
      embed.addFields({ name: '🎯 Tournoi', value: 'Un tournoi est actuellement en cours !', inline: false });
    }

    const bannerURL = guild.bannerURL({ size: 1024 });
    if (bannerURL) embed.setImage(bannerURL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('🌐 Portail').setStyle(ButtonStyle.Link).setURL(`${DASHBOARD_URL}/portail.html?guild=${guildId}`),
      new ButtonBuilder().setLabel('📝 S\'inscrire').setStyle(ButtonStyle.Link).setURL(`${DASHBOARD_URL}/inscription.html?guild=${guildId}`),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });

    await supabase.from('config').upsert({
      guild_id: guildId, key: 'public_panel_channel', value: interaction.channel.id,
    }, { onConflict: 'guild_id,key' }).catch(() => {});

    return interaction.editReply({ content: '✅ Panneau public posté !' });
  }
};