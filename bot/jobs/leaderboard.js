const { EmbedBuilder } = require('discord.js');
const supabase         = require('../services/supabase');

const BR_RANK_SCORES = {
  'bronze i': 1,   'bronze ii': 2,   'bronze iii': 3,   'bronze iv': 4,   'bronze v': 5,
  'silver i': 6,   'silver ii': 7,   'silver iii': 8,   'silver iv': 9,   'silver v': 10,
  'gold i': 11,    'gold ii': 12,    'gold iii': 13,    'gold iv': 14,    'gold v': 15,
  'platinum i': 16,'platinum ii': 17,'platinum iii': 18,'platinum iv': 19,'platinum v': 20,
  'diamond i': 21, 'diamond ii': 22, 'diamond iii': 23, 'diamond iv': 24, 'diamond v': 25,
  'master i': 26,  'master ii': 27,  'master iii': 28,  'master iv': 29,  'master v': 30,
  'masters': 30,
};

function calcScore(snapshot) {
  const kd      = parseFloat(snapshot.kd)      || 0;
  const winrate = parseFloat(snapshot.winrate) || 0;
  const kills   = parseInt(snapshot.kills)     || 0;
  const games   = parseInt(snapshot.games)     || 1;
  const kpm     = kills / games;

  const brKey   = (snapshot.br_rank || '').toLowerCase().trim();
  const brVal   = BR_RANK_SCORES[brKey] ?? 0;
  const brScore = (brVal / 30) * 100;

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

// Met à jour le classement #classement sur CHAQUE serveur où le bot est installé,
// avec uniquement les joueurs rattachés à ce serveur (warstack_xp).
async function updateLeaderboard(client) {
  for (const guild of client.guilds.cache.values()) {
    await updateLeaderboardForGuild(guild);
  }
}

async function updateLeaderboardForGuild(guild) {
  try {
    const channel = guild.channels.cache.find(c => c.name === 'classement');
    if (!channel) return console.log(`❌ Salon #classement introuvable sur ${guild.name}`);

    const { data: members } = await supabase
      .from('warstack_xp')
      .select('discord_id')
      .eq('guild_id', guild.id);

    const memberIds = (members || []).map(m => m.discord_id);
    if (!memberIds.length) return;

    const { data: players, error } = await supabase
      .from('players')
      .select('discord_id, username, tracker_id')
      .in('discord_id', memberIds)
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

    if (!playerStats.length) return;

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
    console.log(`✅ Leaderboard mis à jour dans #classement (${guild.name})`);

  } catch (error) {
    console.error(`❌ Erreur leaderboard job (${guild.name}):`, error.message);
  }
}

module.exports = { updateLeaderboard, calcScore, getDivision };