const { EmbedBuilder } = require('discord.js');
const supabase         = require('../services/supabase');
const { award, addXP, addCoins } = require('../services/points');

async function postTournamentResults(client, tournamentId) {
  try {
    // Infos tournoi (récupéré en premier pour connaître le guild ciblé)
    const { data: tournoi } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!tournoi) return;

    const guild = tournoi.guild_id
      ? client.guilds.cache.get(tournoi.guild_id)
      : client.guilds.cache.first();

    if (!guild) return console.log('❌ Serveur introuvable pour ce tournoi');

    const channel = guild.channels.cache.find(c =>
      c.name === 'tournoi-live' || c.name === 'classement'
    );
    if (!channel) return console.log(`❌ Salon résultats introuvable sur ${guild.name}`);

    // Soumissions validées triées par KD
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

    // Récupère les usernames + attribue les points
    const results = await Promise.all(subs.map(async (sub, i) => {
      const { data: player } = await supabase
        .from('players')
        .select('username, discord_id')
        .eq('discord_id', sub.discord_id)
        .single();

      const rank     = i + 1;
      const username = player?.username || sub.discord_id;
      const guildId  = tournoi.guild_id || channel.guild?.id;

      // ── Attribution points selon le rang ──────────────
      if (guildId && sub.discord_id) {

        // Participation — tout le monde
        await award(sub.discord_id, guildId, 'tournament_played');

        // Gains selon classement
        if (rank === 1) {
          await award(sub.discord_id, guildId, 'tournament_win');
          console.log(`🏆 ${username} — Victoire tournoi → XP + Coins`);
        } else if (rank === 2) {
          await award(sub.discord_id, guildId, 'tournament_finalist');
          console.log(`🥈 ${username} — Finaliste → XP + Coins`);
        } else if (rank === 3) {
          await award(sub.discord_id, guildId, 'tournament_top3');
          console.log(`🥉 ${username} — Top 3 → XP + Coins`);
        } else if (rank <= 4) {
          await award(sub.discord_id, guildId, 'tournament_top4');
        } else if (rank <= 8) {
          await award(sub.discord_id, guildId, 'tournament_top8');
        }
      }

      return {
        rank,
        username,
        discordId: sub.discord_id,
        guildId,
        kd     : sub.kd     ?? '—',
        kills  : sub.kills  ?? '—',
        deaths : sub.deaths ?? '—',
        score  : sub.score  ?? '—',
      };
    }));

    // ── MVP = meilleur KD ──────────────────────────────
    const mvp = results[0];

    // Bonus MVP (peut cumuler avec la victoire)
    if (mvp?.guildId && mvp?.discordId) {
      await award(mvp.discordId, mvp.guildId, 'tournament_mvp');
      console.log(`⭐ MVP ${mvp.username} → XP + Coins bonus`);
    }

    // ── Embed résultats ────────────────────────────────
    const podium    = ['🥇', '🥈', '🥉'];
    const separator = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

    const rows = results.map((p) => {
      const rank = podium[p.rank - 1] || `\`#${p.rank}\``;
      return `${rank} **${p.username}**\n┗ 📈 K/D: \`${p.kd}\` • 🎯 Kills: \`${p.kills}\` • 💀 Deaths: \`${p.deaths}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''} — RÉSULTATS FINAUX`)
      .setColor(0xFF6600)
      .setDescription(`${separator}\n` + rows.join(`\n${separator}\n`) + `\n${separator}`)
      .addFields(
        {
          name : '⭐ MVP DU TOURNOI',
          value: `**${mvp.username}** • K/D \`${mvp.kd}\` • \`${mvp.kills}\` kills`,
        },
        {
          name : '🎖️ Points attribués',
          value:
            `> 🥇 Victoire : \`+200 XP / +250 coins\`\n` +
            `> 🥈 Finaliste : \`+125 XP / +150 coins\`\n` +
            `> 🥉 Top 3 : \`+100 XP / +100 coins\`\n` +
            `> 🎮 Participation : \`+30 XP / +25 coins\`\n` +
            `> ⭐ MVP : \`+75 XP / +75 coins\` (bonus)`,
        }
      )
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

    console.log(`✅ Résultats tournoi ${tournoi.name} postés + points attribués`);

  } catch (error) {
    console.error('❌ Erreur tournament results:', error.message);
  }
}

module.exports = { postTournamentResults };