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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Intercepte la réponse API de tracker.gg
    let apiData = null;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/v2/bf6/') && url.includes(trackerId)) {
        try {
          const json = await response.json();
          if (json?.data?.segments) apiData = json.data;
        } catch (e) {}
      }
    });

    const url = `https://tracker.gg/bf6/profile/${trackerId}/overview`;
    console.log(`🌐 Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    if (!apiData) {
      console.warn('⚠️ Pas de données API interceptées');
      return null;
    }

    const segments = apiData.segments || [];
    const get = (obj, key) => obj?.[key]?.value ?? null;
    const getStr = (obj, key) => obj?.[key]?.displayValue ?? null;

    // Segment overview global
    const overview = segments.find(s => s.type === 'overview');
    const gs = overview?.stats || {};

    // Segments par mode
    const findMode = (name) => segments.find(s =>
      s.type === 'playlist' && s.metadata?.name?.toLowerCase().includes(name.toLowerCase())
    );
    const mpSeg = findMode('multiplayer') || findMode('multi');
    const brSeg = findMode('battle royale') || findMode('br');
    const ms = mpSeg?.stats || {};
    const bs = brSeg?.stats || {};

    // BR Rank depuis metadata
    const brRank = apiData.platformInfo?.additionalParameters?.brRank
      || segments.find(s => s.type === 'br-rank')?.metadata?.tierName
      || null;

    const result = {
      trackerId,
      kills   : get(gs, 'kills')         || 0,
      deaths  : get(gs, 'deaths')        || 0,
      kd      : get(gs, 'kdRatio')       || 0,
      wins    : get(gs, 'wins')          || 0,
      games   : get(gs, 'matchesPlayed') || 0,
      playtime: getStr(gs, 'timePlayed') || '0h',
      winrate : get(gs, 'wlPercentage')  || 0,
      br_rank : brRank,
      mp_kills  : get(ms, 'kills')        || 0,
      mp_deaths : get(ms, 'deaths')       || 0,
      mp_kd     : get(ms, 'kdRatio')      || 0,
      mp_wins   : get(ms, 'wins')         || 0,
      mp_losses : get(ms, 'losses')       || 0,
      mp_winrate: get(ms, 'wlPercentage') || 0,
      br_kills  : get(bs, 'kills')        || 0,
      br_deaths : get(bs, 'deaths')       || 0,
      br_kd     : get(bs, 'kdRatio')      || 0,
      br_wins   : get(bs, 'wins')         || 0,
      br_winrate: get(bs, 'wlPercentage') || 0,
      source    : 'tracker.gg-api'
    };

    console.log(`✅ Stats — K/D: ${result.kd} | MP Kills: ${result.mp_kills} | BR Rank: ${result.br_rank || 'N/A'}`);
    console.log('Segments trouvés:', segments.map(s => `${s.type}:${s.metadata?.name || ''}`).join(', '));

    return result;

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeTrackerGG };