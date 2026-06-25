const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../services/supabase');
const { scrapeTrackerGG } = require('../services/scraper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('🎮 Lie ton profil tracker.gg à WARSTACK')
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('Ton URL tracker.gg ex: https://tracker.gg/bf6/profile/1023163556057/overview')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const url       = interaction.options.getString('url');
    const discordId = interaction.user.id;
    const username  = interaction.user.username;
    const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
    const guildId   = interaction.guildId;

    const match = url.match(/tracker\.gg\/bf6\/profile\/(\d+)/);
    if (!match) {
      return interaction.editReply({
        content: '❌ URL invalide.\nExemple : `https://tracker.gg/bf6/profile/1023163556057/overview`'
      });
    }

    const trackerId = match[1];

    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    if (existing) {
      await supabase
        .from('players')
        .update({ tracker_id: trackerId, tracker_url: url, username, avatar_url: avatarUrl })
        .eq('discord_id', discordId);
    } else {
      const { error } = await supabase
        .from('players')
        .insert({ discord_id: discordId, username, tracker_id: trackerId, tracker_url: url, avatar_url: avatarUrl });

      if (error) {
        console.error('❌ Supabase insert error:', error);
        return interaction.editReply({ content: '❌ Erreur lors de l\'enregistrement. Réessaie plus tard.' });
      }
    }

    await supabase
      .from('warstack_xp')
      .upsert(
        { discord_id: discordId, guild_id: guildId, xp: existing?.xp ?? 0, level: 1 },
        { onConflict: 'discord_id,guild_id' }
      );

    await supabase
      .from('warstack_wallets')
      .upsert(
        { discord_id: discordId, guild_id: guildId, coins: 0, total_earned: 0 },
        { onConflict: 'discord_id,guild_id' }
      );

    await interaction.editReply({
      content: `⏳ Profil lié ! Récupération de tes stats tracker.gg en cours...\n🔗 \`${url}\``
    });

    const stats = await scrapeTrackerGG('psn', trackerId);

    if (!stats) {
      return interaction.editReply({
        content: `✅ Profil enregistré **${username}** !\n🔗 ${url}\n\n⚠️ Stats non disponibles pour l'instant, elles seront mises à jour automatiquement.`
      });
    }

    await supabase.from('player_snapshots').insert({
      tracker_id  : trackerId,
      kills       : stats.kills      || 0,
      deaths      : stats.deaths     || 0,
      kd          : stats.kd         || 0,
      wins        : stats.wins       || 0,
      winrate     : stats.winrate    || 0,
      games       : stats.games      || 0,
      playtime    : stats.playtime   || '0h',
      br_rank     : stats.br_rank    || null,
      br_rank_img : stats.br_rank_img|| null,
      mp_kills    : stats.mp_kills   || 0,
      mp_deaths   : stats.mp_deaths  || 0,
      mp_kd       : stats.mp_kd      || 0,
      mp_wins     : stats.mp_wins    || 0,
      mp_losses   : stats.mp_losses  || 0,
      mp_winrate  : stats.mp_winrate || 0,
      br_kills    : stats.br_kills   || 0,
      br_deaths   : stats.br_deaths  || 0,
      br_kd       : stats.br_kd      || 0,
      br_wins     : stats.br_wins    || 0,
      br_winrate  : stats.br_winrate || 0,
      snapshot_at : new Date().toISOString(),
    });

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${username} — Profil WARSTACK`)
      .setColor(0x00ff66)
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '🎯 K/D Global',    value: `\`${stats.kd}\``,           inline: true },
        { name: '💀 Kills',         value: `\`${stats.kills}\``,         inline: true },
        { name: '🏆 Wins',          value: `\`${stats.wins}\``,          inline: true },
        { name: '🎖️ BR Rank',       value: `\`${stats.br_rank || '—'}\``, inline: true },
        { name: '🔫 MP K/D',        value: `\`${stats.mp_kd}\``,         inline: true },
        { name: '📊 Win Rate',       value: `\`${stats.winrate}%\``,      inline: true },
      )
      .setFooter({ text: `WARSTACK • Tracker ID: ${trackerId}` })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  }
};