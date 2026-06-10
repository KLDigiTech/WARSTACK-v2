const { EmbedBuilder } = require('discord.js');
const supabase         = require('../services/supabase');

const BR_RANK_SCORES = {
  'bronze i': 1,    'bronze ii': 2,    'bronze iii': 3,
  'silver i': 4,    'silver ii': 5,    'silver iii': 6,
  'gold i': 7,      'gold ii': 8,      'gold iii': 9,
  'platinum i': 10, 'platinum ii': 11, 'platinum iii': 12,
  'diamond i': 13,  'diamond ii': 14,  'diamond iii': 15,
  'masters': 16,    'master': 16,
};

function calcScore(snapshot) {
  const kd      = parseFloat(snapshot.kd)      || 0;
  const winrate = parseFloat(snapshot.winrate) || 0;
  const kills   = parseInt(snapshot.kills)     || 0;
  const games   = parseInt(snapshot.games)     || 1;
  const kpm     = kills / games;

  const brKey   = (snapshot.br_rank || '').toLowerCase().trim();
  const brVal   = BR_RANK_SCORES[brKey] ?? 0;
  const brScore = (brVal / 16) * 100;

  return (
    (Math.min(winrate / 60, 1) * 100 * 0.30) +
    (Math.min(kd / 5, 1)       * 100 * 0.25) +
    (Math.min(kpm / 20, 1)     * 100 * 0.15) +
    (Math.min(games / 500, 1)  * 100 * 0.10) +
    (brScore                         * 0.25)
  );
}

function getDivision(score) {
  if (score >= 65) return { name: 'WARSTACK', emoji: '🔱' };
  if (score >= 55) return { name: 'Phantom',  emoji: '👻' };
  if (score >= 45) return { name: 'Elite',    emoji: '💎' };
  if (score >= 35) return { name: 'Veteran',  emoji: '🎖️' };
  if (score >= 25) return { name: 'Soldat',    emoji: '⚔️' };
  return             { name: 'Recruit',       emoji: '🪖' };
}

async function updateLeaderboard(client) {
  try {
    const channel = client.channels.cache.find(c => c.name === 'classement');
    if (!channel) return console.log('❌ Salon #classement introuvable');

    const { data: players, error } = await supabase
      .from('players')
      .select('discord_id, username, tracker_id')
      .not('tracker_id', 'is', null);

    if (error || !players?.length) return;

    const playerStats = [];

    for (const player of players) {
      const { data: snapshot } = await supabase
        .from('player_snapshots')
        .select('*')
        .eq('tracker_id', player.tracker_id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();

      if (!snapshot) continue;

      const score    = calcScore(snapshot);
      const division = getDivision(score);

      playerStats.push({
        username : player.username || 'Inconnu',
        score    : score.toFixed(1),
        division,
        kd       : snapshot.kd,
        kills    : snapshot.kills,
        wins     : snapshot.wins,
        winrate  : snapshot.winrate,
        br_rank  : snapshot.br_rank || '—',
      });
    }

    playerStats.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    const top10     = playerStats.slice(0, 10);
    const podium    = ['🥇', '🥈', '🥉'];
    const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

    const rows = top10.map((p, i) => {
      const rank = podium[i] || `\`#${i + 1}\``;
      return `${rank} **${p.username}** ${p.division.emoji} \`${p.division.name}\`\n┗ 📊 Score: \`${p.score}\` • 📈 K/D: \`${p.kd}\` • 🏆 Winrate: \`${p.winrate}%\` • 🎖️ BR: \`${p.br_rank}\``;
    });

    const totalKills = playerStats.reduce((s, p) => s + (parseInt(p.kills) || 0), 0);
    const mvp        = top10[0]?.username || '—';
    const bestScore  = top10[0]?.score    || '0';

    const embed = new EmbedBuilder()
      .setTitle('🏆  C L A S S E M E N T  —  W A R S T A C K')
      .setColor(0xFF6600)
      .setDescription(`${separator}\n` + rows.join(`\n${separator}\n`) + `\n${separator}`)
      .addFields({
        name: '📊 STATISTIQUES',
        value:
          `> 👥 **Joueurs classés** : \`${playerStats.length}\`\n` +
          `> 🎯 **Kills totaux** : \`${totalKills.toLocaleString('fr-FR')}\`\n` +
          `> 📊 **Meilleur score** : \`${bestScore}\`\n` +
          `> ⭐ **MVP actuel** : **${mvp}**`,
      })
      .setFooter({ text: '⚔️ WARSTACK • Mis à jour toutes les heures' })
      .setTimestamp();

    const messages    = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(m => m.author.bot);
    await Promise.all(botMessages.map(m => m.delete()));

    await channel.send({ embeds: [embed] });
    console.log('✅ Leaderboard mis à jour dans #classement');

  } catch (error) {
    console.error('❌ Erreur leaderboard job:', error.message);
  }
}

module.exports = { updateLeaderboard, calcScore, getDivision };