require('dotenv').config();
const { createClient }    = require('@supabase/supabase-js');
const { scrapeTrackerGG } = require('../services/scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

  console.log(`👥 ${players.length} joueur(s) à scraper`);

  for (const player of players) {
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
        tracker_id  : player.tracker_id,
        kills       : stats.kills,
        deaths      : stats.deaths,
        kd          : stats.kd,
        wins        : stats.wins,
        winrate     : stats.winrate,
        games       : stats.games,
        playtime    : stats.playtime,
        br_rank     : stats.br_rank,
        mp_kills    : stats.mp_kills,
        mp_deaths   : stats.mp_deaths,
        mp_kd       : stats.mp_kd,
        mp_wins     : stats.mp_wins,
        mp_losses   : stats.mp_losses,
        mp_winrate  : stats.mp_winrate,
        br_kills    : stats.br_kills,
        br_deaths   : stats.br_deaths,
        br_kd       : stats.br_kd,
        br_wins     : stats.br_wins,
        br_winrate  : stats.br_winrate,
        snapshot_at : new Date().toISOString(),
      });

    if (snapError) {
      console.error(`❌ Erreur snapshot pour ${player.tracker_id}:`, snapError);
    } else {
      console.log(`✅ Snapshot sauvegardé — K/D: ${stats.kd} | BR Rank: ${stats.br_rank || 'N/A'}`);
    }

    await sleep(10000);
  }

  console.log('\n✅ Scraper terminé !');
}

runScraper().catch(console.error);