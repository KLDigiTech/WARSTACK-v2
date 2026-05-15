const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeTrackerGG(platform, trackerId) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://tracker.gg/bf6/profile/${trackerId}/overview`;
    console.log(`🌐 Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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
      return {
        kd      : getStatValue('Player K/D'),
        kills   : getStatValue('Player Kills'),
        deaths  : getStatValue('Deaths'),
        wins    : getStatValue('Wins'),
        games   : getStatValue('Matches Played'),
        winrate : getStatValue('Win %'),
        playtime: getStatValue('Time Played'),
      };
    });

    console.log('Stats extraites:', stats);

    if (!stats.kd && !stats.kills) {
      console.warn('⚠️ Aucune stat trouvée — tracker.gg bloque peut-être le scraping');
      return null;
    }

    return {
      trackerId,
      kills   : parseFloat(String(stats.kills   || '0').replace(/,/g, '')) || 0,
      deaths  : parseFloat(String(stats.deaths  || '0').replace(/,/g, '')) || 0,
      kd      : parseFloat(stats.kd      || '0') || 0,
      wins    : parseFloat(String(stats.wins    || '0').replace(/,/g, '')) || 0,
      games   : parseFloat(String(stats.games   || '0').replace(/,/g, '')) || 0,
      playtime: stats.playtime || '0h',
      winrate : stats.winrate  || '0%',
      source  : 'tracker.gg'
    };

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeTrackerGG };