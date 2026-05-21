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

      function getStatValue(label) {
        const allEls = Array.from(document.querySelectorAll('span, div, p'));
        for (const el of allEls) {
          if (el.children.length === 0 && el.textContent.trim() === label) {
            const parent      = el.parentElement;
            if (!parent) continue;
            const grandParent = parent.parentElement;
            if (!grandParent) continue;
            const candidates  = Array.from(grandParent.querySelectorAll('span, div, p'));
            for (const c of candidates) {
              const text = c.textContent.trim();
              if (c.children.length === 0 && text && text !== label && /^[\d,\.%hm\s]+$/.test(text)) {
                return text;
              }
            }
          }
        }
        return null;
      }

      function getBRRank() {
        // "SILVER I" est dans un span/div après "CURRENT"
        const allEls = Array.from(document.querySelectorAll('div, span, p'));
        for (const el of allEls) {
          if (el.children.length === 0 && el.textContent.trim() === 'CURRENT') {
            // Le rank est dans le même bloc parent, cherche un texte type "SILVER I"
            const block = el.closest('.trn-card, .v3-card, section, article') || el.parentElement?.parentElement?.parentElement;
            if (!block) continue;
            const candidates = Array.from(block.querySelectorAll('div, span, p'));
            for (const c of candidates) {
              const txt = c.textContent.trim();
              if (c.children.length === 0 && /^(BRONZE|SILVER|GOLD|PLATINUM|DIAMOND|MASTER|PREDATOR)\s+(I{1,3}|IV|V)$/i.test(txt)) {
                return txt;
              }
            }
          }
        }
        return null;
      }

      function getSectionStats(sectionLabel) {
        // Cherche le h2/h3 exact puis remonte au .v3-card parent
        const headers = Array.from(document.querySelectorAll('h2, h3'));
        for (const h of headers) {
          if (h.textContent.trim() === sectionLabel) {
            const card = h.closest('.v3-card') || h.parentElement?.parentElement?.parentElement;
            if (!card) continue;

            const get = (label) => {
              const els = Array.from(card.querySelectorAll('span, div, p'));
              for (const el of els) {
                if (el.children.length === 0 && el.textContent.trim() === label) {
                  const p  = el.parentElement;
                  const gp = p?.parentElement;
                  if (!gp) continue;
                  const cands = Array.from(gp.querySelectorAll('span, div, p'));
                  for (const c of cands) {
                    const t = c.textContent.trim();
                    if (c.children.length === 0 && t && t !== label && /^[\d,\.%hm\s]+$/.test(t)) return t;
                  }
                }
              }
              return null;
            };

            return {
              wins   : get('Wins'),
              losses : get('Losses'),
              kills  : get('Kills') || get('Player Kills'),
              deaths : get('Deaths'),
              kd     : get('K/D'),
              winrate: get('Win %') || get('Win%'),
            };
          }
        }
        return null;
      }

      return {
        kd      : getStatValue('Player K/D'),
        kills   : getStatValue('Player Kills'),
        deaths  : getStatValue('Deaths'),
        wins    : getStatValue('Wins'),
        games   : getStatValue('Matches Played'),
        winrate : getStatValue('Win %'),
        playtime: getStatValue('Time Played'),
        br_rank : getBRRank(),
        mp      : getSectionStats('Multiplayer'),
        br      : getSectionStats('Battle Royale'),
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