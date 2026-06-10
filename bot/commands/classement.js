const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase                               = require('../services/supabase');
const { getLeaderboard, getGrade }           = require('../services/points');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('🏆 Affiche le classement WARSTACK')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Type de classement')
        .setRequired(false)
        .addChoices(
          { name: '⭐ WARSTACK XP',    value: 'xp'      },
          { name: '💰 WAR Coins',      value: 'coins'   },
          { name: '🪖 Tracker BF6',    value: 'tracker' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const type    = interaction.options.getString('type') || 'xp';
    const guildId = interaction.guild.id;

    // ── Classement WARSTACK XP ────────────────────────
    if (type === 'xp') {
      const rows = await getLeaderboard(guildId, 'xp', 10);

      if (!rows.length) {
        return interaction.editReply({ content: '❌ Aucun joueur classé pour le moment.' });
      }

      const podium    = ['🥇', '🥈', '🥉'];
      const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

      const lines = await Promise.all(rows.map(async (p, i) => {
        const grade = getGrade(p.xp);
        let username = p.discord_id;
        try {
          const user = await interaction.client.users.fetch(p.discord_id);
          username = user.username;
        } catch {}
        const rank = podium[i] || `\`#${i + 1}\``;
        return `${rank} **${username}** ${grade.emoji} \`${grade.name}\`\n┗ ✨ XP: \`${p.xp.toLocaleString('fr-FR')}\``;
      }));

      const embed = new EmbedBuilder()
        .setTitle('⭐  C L A S S E M E N T  —  W A R S T A C K  X P')
        .setColor(0xFF6600)
        .setDescription(`${separator}\n` + lines.join(`\n${separator}\n`) + `\n${separator}`)
        .addFields({
          name : '📊 INFO',
          value:
            `> 👥 **Joueurs classés** : \`${rows.length}\`\n` +
            `> ✨ **Meilleur XP** : \`${rows[0]?.xp?.toLocaleString('fr-FR') ?? 0}\`\n` +
            `> 🎖️ **Grade** : ${getGrade(rows[0]?.xp ?? 0).emoji} \`${getGrade(rows[0]?.xp ?? 0).name}\``,
        })
        .setFooter({ text: '⚔️ WARSTACK • XP Communautaire' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Classement WAR Coins ──────────────────────────
    if (type === 'coins') {
      const rows = await getLeaderboard(guildId, 'coins', 10);

      if (!rows.length) {
        return interaction.editReply({ content: '❌ Aucun joueur classé pour le moment.' });
      }

      const podium    = ['🥇', '🥈', '🥉'];
      const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

      const lines = await Promise.all(rows.map(async (p, i) => {
        let username = p.discord_id;
        try {
          const user = await interaction.client.users.fetch(p.discord_id);
          username = user.username;
        } catch {}
        const rank = podium[i] || `\`#${i + 1}\``;
        return `${rank} **${username}**\n┗ 💰 Coins: \`${p.coins.toLocaleString('fr-FR')}\` • Total gagné: \`${p.total_earned.toLocaleString('fr-FR')}\``;
      }));

      const embed = new EmbedBuilder()
        .setTitle('💰  C L A S S E M E N T  —  W A R  C O I N S')
        .setColor(0xFFD700)
        .setDescription(`${separator}\n` + lines.join(`\n${separator}\n`) + `\n${separator}`)
        .addFields({
          name : '📊 INFO',
          value:
            `> 👥 **Joueurs classés** : \`${rows.length}\`\n` +
            `> 💰 **Plus riche** : \`${rows[0]?.coins?.toLocaleString('fr-FR') ?? 0} coins\`\n` +
            `> 📈 **Total gagné** : \`${rows[0]?.total_earned?.toLocaleString('fr-FR') ?? 0} coins\``,
        })
        .setFooter({ text: '⚔️ WARSTACK • WAR Coins' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Classement Tracker BF6 ────────────────────────
    if (type === 'tracker') {
      const { data: players } = await supabase
        .from('players')
        .select('discord_id, username, tracker_id')
        .not('tracker_id', 'is', null);

      if (!players?.length) {
        return interaction.editReply({ content: '❌ Aucun joueur BF6 inscrit.' });
      }

      const playerStats = [];

      for (const player of players) {
        const { data: snapshot } = await supabase
          .from('player_snapshots')
          .select('kd, winrate, kills, games, br_rank, wins')
          .eq('tracker_id', player.tracker_id)
          .order('snapshot_at', { ascending: false })
          .limit(1)
          .single();

        if (!snapshot) continue;

        const kd      = parseFloat(snapshot.kd)      || 0;
        const winrate = parseFloat(snapshot.winrate) || 0;
        const kills   = parseInt(snapshot.kills)     || 0;
        const games   = parseInt(snapshot.games)     || 1;
        const kpm     = kills / games;

        // Score BF6 amélioré
        const score = (
          (Math.min(kd / 5, 1)        * 100 * 0.25) +
          (Math.min(winrate / 60, 1)  * 100 * 0.30) +
          (Math.min(kpm / 20, 1)      * 100 * 0.15) +
          (Math.min(games / 500, 1)   * 100 * 0.10)
        );

        playerStats.push({
          username : player.username || 'Inconnu',
          score    : score.toFixed(1),
          kd       : kd.toFixed(2),
          winrate  : snapshot.winrate || 0,
          wins     : snapshot.wins    || 0,
          br_rank  : snapshot.br_rank || '—',
        });
      }

      playerStats.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

      const top10     = playerStats.slice(0, 10);
      const podium    = ['🥇', '🥈', '🥉'];
      const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

      const lines = top10.map((p, i) => {
        const rank = podium[i] || `\`#${i + 1}\``;
        return `${rank} **${p.username}** 🎖️ \`${p.br_rank}\`\n┗ 📊 Score: \`${p.score}\` • 📈 K/D: \`${p.kd}\` • 🏆 Winrate: \`${p.winrate}%\``;
      });

      const embed = new EmbedBuilder()
        .setTitle('🪖  C L A S S E M E N T  —  T R A C K E R  B F 6')
        .setColor(0x2196F3)
        .setDescription(`${separator}\n` + lines.join(`\n${separator}\n`) + `\n${separator}`)
        .addFields({
          name : '📊 INFO',
          value:
            `> 👥 **Joueurs classés** : \`${playerStats.length}\`\n` +
            `> 📊 **Meilleur score** : \`${top10[0]?.score ?? 0}\`\n` +
            `> 📈 **Meilleur K/D** : \`${top10[0]?.kd ?? 0}\``,
        })
        .setFooter({ text: '⚔️ WARSTACK • Tracker BF6' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};