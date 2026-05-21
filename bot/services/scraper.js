const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeTrackerGG(platform, trackerId) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless        : 'new',
      protocolTimeout : 120000,
      args            : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://tracker.gg/bf6/profile/${trackerId}/overview`;
    console.log(`🌐 Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    const stats = await page.evaluate(() => {

      // Récupère une stat dans une v3-card par le label span.stat-name
      function getCardStat(card, label) {
        const spans = Array.from(card.querySelectorAll('.stat-name, [class*="stat-name"]'));
        for (const span of spans) {
          if (span.textContent.trim() === label) {
            // La valeur est dans un élément frère ou cousin avec class name-value
            const parent = span.closest('[class*="stat"]') || span.parentElement;
            const val = parent?.querySelector('[class*="name-value"], [class*="value"]');
            if (val) return val.textContent.trim();
          }
        }
        return null;
      }

      // Stats globales — cherche dans toute la page
      function getGlobalStat(label) {
        const spans = Array.from(document.querySelectorAll('.stat-name, [class*="stat-name"]'));
        for (const span of spans) {
          if (span.textContent.trim() === label) {
            const parent = span.closest('[class*="stat"]') || span.parentElement;
            const val = parent?.querySelector('[class*="name-value"], [class*="value"]');
            if (val) return val.textContent.trim();
          }
        }
        return null;
      }

      // Trouve une v3-card par son titre h2/h3
      function getCard(title) {
        const headers = Array.from(document.querySelectorAll('.v3-card__title, h2, h3'));
        for (const h of headers) {
          if (h.textContent.trim() === title) {
            return h.closest('.v3-card') || h.parentElement?.parentElement;
          }
        }
        return null;
      }

      // BR Rank — cherche "CURRENT" puis le rank juste après
      function getBRRank() {
        const allSpans = Array.from(document.querySelectorAll('span, div, p'));
        for (const el of allSpans) {
          if (el.children.length === 0 && el.textContent.trim() === 'CURRENT') {
            const block = el.parentElement?.parentElement?.parentElement;
            if (!block) continue;
            const allInBlock = Array.from(block.querySelectorAll('span, div, p'));
            for (const c of allInBlock) {
              if (c.children.length === 0 && /^(BRONZE|SILVER|GOLD|PLATINUM|DIAMOND|MASTER|PREDATOR)\s+(I{1,3}|IV|V)$/i.test(c.textContent.trim())) {
                return c.textContent.trim();
              }
            }
          }
        }
        return null;
      }

      const mpCard = getCard('Multiplayer');
      const brCard = getCard('Battle Royale');

      return {
        // Global
        kd      : getGlobalStat('Player K/D'),
        kills   : getGlobalStat('Player Kills'),
        deaths  : getGlobalStat('Deaths'),
        wins    : getGlobalStat('Wins'),
        games   : getGlobalStat('Matches Played'),
        winrate : getGlobalStat('Win %'),
        playtime: getGlobalStat('Time Played'),
        br_rank : getBRRank(),
        // Multiplayer
        mp: mpCard ? {
          kills  : getCardStat(mpCard, 'Kills') || getCardStat(mpCard, 'Player Kills'),
          deaths : getCardStat(mpCard, 'Deaths'),
          kd     : getCardStat(mpCard, 'K/D'),
          wins   : getCardStat(mpCard, 'Wins'),
          losses : getCardStat(mpCard, 'Losses'),
          winrate: getCardStat(mpCard, 'Win %'),
        } : null,
        // Battle Royale
        br: brCard ? {
          kills  : getCardStat(brCard, 'Kills') || getCardStat(brCard, 'Player Kills'),
          deaths : getCardStat(brCard, 'Deaths'),
          kd     : getCardStat(brCard, 'K/D'),
          wins   : getCardStat(brCard, 'Wins'),
          winrate: getCardStat(brCard, 'Win %'),
        } : null,
      };
    });

    console.log('Stats extraites:', JSON.stringify(stats, null, 2));

    if (!stats.kd && !stats.kills) {
      console.warn('⚠️ Aucune stat trouvée');
      return null;
    }

    const parseNum = (v) => parseFloat(String(v || '0').replace(/,/g, '')) || 0;

    return {
      trackerId,
      kills     : parseNum(stats.kills),
      deaths    : parseNum(stats.deaths),
      kd        : parseNum(stats.kd),
      wins      : parseNum(stats.wins),
      games     : parseNum(stats.games),
      playtime  : stats.playtime || '0h',
      winrate   : parseNum(String(stats.winrate).replace('%', '')),
      br_rank   : stats.br_rank || null,
      mp_kills  : parseNum(stats.mp?.kills),
      mp_deaths : parseNum(stats.mp?.deaths),
      mp_kd     : parseNum(stats.mp?.kd),
      mp_wins   : parseNum(stats.mp?.wins),
      mp_losses : parseNum(stats.mp?.losses),
      mp_winrate: parseNum(String(stats.mp?.winrate || '0').replace('%', '')),
      br_kills  : parseNum(stats.br?.kills),
      br_deaths : parseNum(stats.br?.deaths),
      br_kd     : parseNum(stats.br?.kd),
      br_wins   : parseNum(stats.br?.wins),
      br_winrate: parseNum(String(stats.br?.winrate || '0').replace('%', '')),
      source    : 'tracker.gg'
    };

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeTrackerGG };