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

      // Trouve les attributs data-v- dynamiques de Vue
      function getVueAttrs() {
        const statEl = document.querySelector('[class*="stat-name"]');
        const valEl  = document.querySelector('[class*="stat-value"]');
        const statAttr = statEl ? Array.from(statEl.attributes).find(a => a.name.startsWith('data-v-'))?.name : null;
        const valAttr  = valEl  ? Array.from(valEl.attributes).find(a => a.name.startsWith('data-v-'))?.name  : null;
        return { statAttr, valAttr };
      }

      const { statAttr, valAttr } = getVueAttrs();
      console.log('Vue attrs:', statAttr, valAttr);

      // Cherche une stat par label dans un conteneur donné
      function getStat(container, label) {
        const labelEls = statAttr
          ? Array.from(container.querySelectorAll(`[${statAttr}]`))
          : Array.from(container.querySelectorAll('[class*="stat-name"]'));

        for (const el of labelEls) {
          const span = el.querySelector('span') || el;
          if (span.textContent.trim() === label) {
            const parent = el.parentElement;
            const valEl  = valAttr
              ? parent?.querySelector(`[${valAttr}] span, [${valAttr}]`)
              : parent?.querySelector('[class*="stat-value"] span, [class*="value"]');
            if (valEl) return valEl.textContent.trim();
          }
        }
        return null;
      }

      // Stats globales
      function getGlobal(label) {
        return getStat(document.body, label);
      }

      // Stats par section via h2
      function getSection(title) {
        const headers = Array.from(document.querySelectorAll('h2, h3, [class*="card__title"]'));
        for (const h of headers) {
          if (h.textContent.trim() === title) {
            const card = h.closest('.v3-card') || h.closest('section') || h.parentElement?.parentElement?.parentElement;
            return card;
          }
        }
        return null;
      }

      function getBRRank() {
        const all = Array.from(document.querySelectorAll('span, div, p'));
        for (const el of all) {
          if (el.children.length === 0 && el.textContent.trim() === 'CURRENT') {
            const block = el.parentElement?.parentElement?.parentElement;
            if (!block) continue;
            const cands = Array.from(block.querySelectorAll('span, div, p'));
            for (const c of cands) {
              if (c.children.length === 0 && /^(BRONZE|SILVER|GOLD|PLATINUM|DIAMOND|MASTER|PREDATOR)\s+(I{1,3}|IV|V)$/i.test(c.textContent.trim())) {
                return c.textContent.trim();
              }
            }
          }
        }
        return null;
      }

      const mpCard = getSection('Multiplayer');
      const brCard = getSection('Battle Royale');

      return {
        kd      : getGlobal('Player K/D'),
        kills   : getGlobal('Player Kills'),
        deaths  : getGlobal('Deaths'),
        wins    : getGlobal('Wins'),
        games   : getGlobal('Matches Played'),
        winrate : getGlobal('Win %'),
        playtime: getGlobal('Time Played'),
        br_rank : getBRRank(),
        mp: mpCard ? {
          kills  : getStat(mpCard, 'Kills') || getStat(mpCard, 'Player Kills'),
          deaths : getStat(mpCard, 'Deaths'),
          kd     : getStat(mpCard, 'K/D'),
          wins   : getStat(mpCard, 'Wins'),
          losses : getStat(mpCard, 'Losses'),
          winrate: getStat(mpCard, 'Win %'),
        } : null,
        br: brCard ? {
          kills  : getStat(brCard, 'Kills') || getStat(brCard, 'Player Kills'),
          deaths : getStat(brCard, 'Deaths'),
          kd     : getStat(brCard, 'K/D'),
          wins   : getStat(brCard, 'Wins'),
          winrate: getStat(brCard, 'Win %'),
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