const { EmbedBuilder } = require('discord.js');
const supabase         = require('../services/supabase');

async function postTournamentResults(client, tournamentId) {
  try {
    const channel = client.channels.cache.find(c =>
      c.name === 'tournoi-live' || c.name === 'classement'
    );
    if (!channel) return console.log('❌ Salon résultats introuvable');

    // Infos tournoi
    const { data: tournoi } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!tournoi) return;

    // Soumissions du tournoi
    const { data: subs } = await supabase
      .from('tournament_submissions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending')
      .order('kd', { ascending: false });

    if (!subs?.length) {
      await channel.send({ embeds: [
        new EmbedBuilder()
          .setTitle(`🏆 ${tournoi.name} — Résultats`)
          .setColor(0xFF6600)
          .setDescription('Aucune soumission pour ce tournoi.')
          .setTimestamp()
      ]});
      return;
    }

    // Récupère les usernames
    const results = await Promise.all(subs.map(async (sub, i) => {
      const { data: player } = await supabase
        .from('players')
        .select('username, discord_id')
        .eq('discord_id', sub.discord_id)
        .single();

      return {
        rank     : i + 1,
        username : player?.username || sub.discord_id,
        discordId: sub.discord_id,
        kd       : sub.kd       ?? '—',
        kills    : sub.kills    ?? '—',
        deaths   : sub.deaths   ?? '—',
        score    : sub.score    ?? '—',
      };
    }));

    const podium    = ['🥇', '🥈', '🥉'];
    const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

    const rows = results.map((p) => {
      const rank = podium[p.rank - 1] || `\`#${p.rank}\``;
      return `${rank} **${p.username}**\n┗ 📈 K/D: \`${p.kd}\` • 🎯 Kills: \`${p.kills}\` • 💀 Deaths: \`${p.deaths}\``;
    });

    const mvp = results[0];

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''} — RÉSULTATS FINAUX`)
      .setColor(0xFF6600)
      .setDescription(`${separator}\n` + rows.join(`\n${separator}\n`) + `\n${separator}`)
      .addFields({
        name: '⭐ MVP DU TOURNOI',
        value: `**${mvp.username}** • K/D \`${mvp.kd}\` • \`${mvp.kills}\` kills`,
      })
      .setFooter({ text: `⚔️ WARSTACK • ${tournoi.name}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // Mention MVP
    await channel.send(`🎖️ Félicitations à <@${mvp.discordId}> pour sa victoire ! ⚔️`);

    // Marque les soumissions comme validées
    await supabase
      .from('tournament_submissions')
      .update({ status: 'valide' })
      .eq('tournament_id', tournamentId);

    console.log(`✅ Résultats tournoi ${tournoi.name} postés`);

  } catch (error) {
    console.error('❌ Erreur tournament results:', error.message);
  }
}

module.exports = { postTournamentResults };