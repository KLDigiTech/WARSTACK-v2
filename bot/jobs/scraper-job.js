require('dotenv').config();
const { createClient }   = require('@supabase/supabase-js');
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
        kills       : parseInt(String(stats.kills).replace(/,/g, ''))    || 0,
        deaths      : parseInt(String(stats.deaths).replace(/,/g, ''))   || 0,
        kd          : parseFloat(stats.kd)                               || 0,
        wins        : parseInt(String(stats.wins).replace(/,/g, ''))     || 0,
        winrate     : parseFloat(String(stats.winrate).replace('%', '')) || 0,
        games       : parseInt(String(stats.games).replace(/,/g, ''))    || 0,
        playtime    : stats.playtime,
        snapshot_at : new Date().toISOString(),
      });

    if (snapError) {
      console.error(`❌ Erreur snapshot pour ${player.tracker_id}:`, snapError);
    } else {
      console.log(`✅ Snapshot sauvegardé — K/D: ${stats.kd} | Kills: ${stats.kills}`);
    }

    await sleep(10000);
  }

  console.log('\n✅ Scraper terminé !');
}

runScraper().catch(console.error);