const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase                               = require('../services/supabase');
const { getProfile, getGrade }               = require('../services/points');

const DASHBOARD_URL = 'https://warstack-v2.vercel.app';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('🪪 Affiche le profil complet d\'un joueur')
    .addUserOption(o => o.setName('joueur').setDescription('Le joueur à consulter (toi par défaut)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const target    = interaction.options.getUser('joueur') || interaction.user;
    const discordId = target.id;
    const guildId   = interaction.guild.id;

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    const { data: snapshot } = player?.tracker_id ? await supabase
      .from('player_snapshots')
      .select('*')
      .eq('tracker_id', player.tracker_id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single() : { data: null };

    const { data: tournoiPoints } = await supabase
      .from('tournament_submissions')
      .select('tournament_id')
      .eq('discord_id', discordId)
      .eq('status', 'valide');

    const tournoiCount = tournoiPoints?.length ?? 0;

    const wProfile = await getProfile(discordId, guildId);

    let rangTracker = '—';
    if (snapshot) {
      const { data: members } = await supabase
        .from('warstack_xp')
        .select('discord_id')
        .eq('guild_id', guildId);
      const memberIds = (members || []).map(m => m.discord_id);

      const { data: scopedPlayers } = await supabase
        .from('players')
        .select('tracker_id')
        .in('discord_id', memberIds)
        .not('tracker_id', 'is', null);
      const scopedTrackerIds = (scopedPlayers || []).map(p => p.tracker_id);

      const { data: allPlayers } = await supabase
        .from('player_snapshots')
        .select('tracker_id, kd')
        .in('tracker_id', scopedTrackerIds)
        .order('kd', { ascending: false });
      const idx = allPlayers?.findIndex(p => p.tracker_id === player?.tracker_id);
      if (idx !== undefined && idx >= 0) rangTracker = `#${idx + 1}`;
    }

    const gradeColors = {
      1 : 0x607D8B,
      2 : 0x78909C,
      3 : 0x90A4AE,
      4 : 0xFF9800,
      5 : 0xFF9800,
      6 : 0x4CAF50,
      7 : 0x4CAF50,
      8 : 0x2196F3,
      9 : 0x2196F3,
      10: 0x9C27B0,
      11: 0x9C27B0,
      12: 0xFF6600,
      13: 0xFFD700,
    };
    const embedColor = gradeColors[wProfile.grade.level] ?? 0xFF6600;

    const filled  = Math.round(wProfile.progress / 10);
    const empty   = 10 - filled;
    const xpBar   = '█'.repeat(filled) + '░'.repeat(empty);

    const embed = new EmbedBuilder()
      .setTitle(`${wProfile.grade.emoji} ${target.username}`)
      .setColor(embedColor)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`**${wProfile.grade.name}** — Niveau \`${wProfile.grade.level}\``)
      .addFields(
        {
          name : '⭐ __WARSTACK__',
          value:
            `> 🎖️ **Grade** : ${wProfile.grade.emoji} \`${wProfile.grade.name}\`\n` +
            `> ✨ **XP** : \`${wProfile.xp.toLocaleString('fr-FR')} XP\`\n` +
            `> 💰 **Coins** : \`${wProfile.coins.toLocaleString('fr-FR')} coins\`\n` +
            `> ${xpBar} \`${wProfile.progress}%\`${wProfile.nextGrade ? ` → ${wProfile.nextGrade.emoji} ${wProfile.nextGrade.name}` : ' *(MAX)*'}`,
          inline: false,
        },
        {
          name : '📊 __Activité__',
          value:
            `> 💬 **Messages** : \`${wProfile.stats.messages.toLocaleString('fr-FR')}\`\n` +
            `> 🎤 **Vocal** : \`${wProfile.stats.voice} min\`\n` +
            `> 🎉 **Events** : \`${wProfile.stats.events}\`\n` +
            `> 💡 **Suggestions** : \`${wProfile.stats.suggestions}\``,
          inline: true,
        },
        {
          name : '🏆 __Tournois__',
          value:
            `> 🎮 **Participations** : \`${wProfile.stats.tournaments}\`\n` +
            `> 🥇 **Victoires** : \`${wProfile.stats.wins}\`\n` +
            `> ⭐ **MVP** : \`${wProfile.stats.mvp}\`\n` +
            `> 📋 **Soumissions** : \`${tournoiCount}\``,
          inline: true,
        },
      );

    if (snapshot) {
      embed.addFields({
        name : '🪖 __Battlefield 6__',
        value:
          `> 🏅 **Rang** : \`${rangTracker}\`\n` +
          `> 📈 **K/D** : \`${parseFloat(snapshot.kd || 0).toFixed(2)}\`\n` +
          `> 🎯 **Kills** : \`${Number(snapshot.kills || 0).toLocaleString('fr-FR')}\`\n` +
          `> 🏆 **Winrate** : \`${snapshot.winrate || 0}%\`\n` +
          `> 🎖️ **BR Rank** : \`${snapshot.br_rank || '—'}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name : '🪖 __Battlefield 6__',
        value: '> *Non lié — utilise `/register` pour connecter ton compte BF6*',
        inline: false,
      });
    }

    embed
      .setFooter({ text: 'WARSTACK • Profil Joueur' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👤 Profil complet')
        .setStyle(ButtonStyle.Link)
        .setURL(`${DASHBOARD_URL}/#players`),
      new ButtonBuilder()
        .setLabel('💰 Mes points')
        .setStyle(ButtonStyle.Link)
        .setURL(`${DASHBOARD_URL}/#players`),
      new ButtonBuilder()
        .setLabel('🏆 Classement')
        .setStyle(ButtonStyle.Link)
        .setURL(`${DASHBOARD_URL}/#classement`),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};