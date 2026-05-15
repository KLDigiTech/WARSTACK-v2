import { fetchSupabase } from '../api.js';

export async function initOverview() {
  const players = await fetchSupabase('players?select=*&order=kd.desc');
  if (!players || players.length === 0) return;

  document.getElementById('ov-players').textContent = players.length;
  document.getElementById('ov-kills').textContent   = players.reduce((s, p) => s + (p.kills || 0), 0).toLocaleString();
  document.getElementById('ov-kd').textContent      = (players[0].kd || 0).toFixed(2);
  document.getElementById('ov-mvp').textContent     = players[0].pseudo_bf6;

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  document.getElementById('top5-list').innerHTML = players.slice(0, 5).map((p, i) => `
    <div class="top5-row">
      <div class="top5-rank">${medals[i]}</div>
      <div class="top5-name">${p.pseudo_bf6}</div>
      <div class="top5-platform">${p.platform?.toUpperCase()}</div>
      <div class="top5-kd">${(p.kd || 0).toFixed(2)}</div>
      <div class="top5-kills">🎯 ${p.kills || 0}</div>
    </div>
  `).join('');
}