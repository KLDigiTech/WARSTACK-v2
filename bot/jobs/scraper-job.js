require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { scrapeTrackerGG } = require('../services/scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Délai minimum entre deux scrapes d'un même joueur (en heures).
// Légèrement en dessous de l'intervalle du cron (6h) pour laisser une marge,
// mais assez large pour qu'un joueur fraîchement inscrit (scrapé immédiatement
// à l'inscription) ne soit pas re-scrapé par le cron qui suit de peu.
// C'est ce qui limite le nombre de requêtes envoyées à tracker.gg et réduit
// le risque de ban de l'IP qui scrape.
const MIN_HOURS_BETWEEN_SCRAPES = 5.5;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runScraper() {
  console.log('🚀 Démarrage du scraper WARSTACK...');

  const { data: players, error } = await supabase
    .from('players')
    .select('discord_id, tracker_id, username')
    .not('tracker_id', 'is', null);

  if (error || !players?.length) {
    console.log('❌ Aucun joueur trouvé ou erreur:', error);
    return;
  }

  console.log(`👥 ${players.length} joueur(s) éligible(s)`);

  const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_SCRAPES * 60 * 60 * 1000).toISOString();

  let skipped = 0;
  let scraped = 0;

  for (const player of players) {
    // ── Cooldown : on ne re-scrape pas un joueur déjà scrapé récemment ──
    const { data: lastSnap } = await supabase
      .from('player_snapshots')
      .select('snapshot_at')
      .eq('tracker_id', player.tracker_id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSnap && lastSnap.snapshot_at > cutoff) {
      console.log(`⏭️  ${player.username || player.discord_id} déjà scrapé récemment (${lastSnap.snapshot_at}), on saute.`);
      skipped++;
      continue;
    }

    console.log(`\n🎮 Scraping ${player.username || player.discord_id} (${player.tracker_id})`);

    const stats = await scrapeTrackerGG('psn', player.tracker_id);

    if (!stats) {
      console.warn(`⚠️ Échec scraping pour ${player.tracker_id}`);
      await sleep(5000);
      continue;
    }

    const { error: snapError } = await supabase
      .from('player_snapshots')
      .insert({
        tracker_id: player.tracker_id,
        kills: stats.kills || 0,
        deaths: stats.deaths || 0,
        kd: stats.kd || 0,
        wins: stats.wins || 0,
        winrate: stats.winrate || 0,
        games: stats.games || 0,
        playtime: stats.playtime || '0h',
        br_rank: stats.br_rank || null,
        br_rank_img: stats.br_rank_img || null,
        mp_kills: stats.mp_kills || 0,
        mp_deaths: stats.mp_deaths || 0,
        mp_kd: stats.mp_kd || 0,
        mp_wins: stats.mp_wins || 0,
        mp_losses: stats.mp_losses || 0,
        mp_winrate: stats.mp_winrate || 0,
        br_kills: stats.br_kills || 0,
        br_deaths: stats.br_deaths || 0,
        br_kd: stats.br_kd || 0,
        br_wins: stats.br_wins || 0,
        br_winrate: stats.br_winrate || 0,
        snapshot_at: new Date().toISOString(),
      });

    if (snapError) {
      console.error(`❌ Erreur snapshot pour ${player.tracker_id}:`, snapError);
    } else {
      console.log(`✅ Snapshot sauvegardé — K/D: ${stats.kd} | Kills: ${stats.kills}`);
      scraped++;
    }

    await sleep(10000);
  }

  console.log(`\n✅ Scraper terminé ! ${scraped} scrapé(s), ${skipped} sauté(s) (cooldown).`);
}

runScraper().catch(console.error);