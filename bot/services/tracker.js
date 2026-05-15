const axios = require('axios');

const GAMETOOLS_URL = 'https://api.gametools.network/bf6/stats/';

async function getPlayerStats(platform, identifier) {
  try {
    const response = await axios.get(GAMETOOLS_URL, {
      params:  { name: identifier, platform: platform },
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });

    const d = response.data;
    if (!d || d.errors) return null;

    return {
      kills   : d.kills         ?? 0,
      deaths  : d.deaths        ?? 0,
      kd      : d.kd            ?? 0,
      wins    : d.wins          ?? 0,
      games   : d.matchesPlayed ?? 0,
      playtime: d.timePlayed    ?? '0h',
      level   : d.rank          ?? null,
      pseudo  : d.userName      || identifier
    };

  } catch (error) {
    console.error('❌ GameTools API error:', error.response?.status, error.message);
    return null;
  }
}

module.exports = { getPlayerStats };