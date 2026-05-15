import { fetchSupabase } from '../api.js';

export async function initOverview() {
  const players = await fetchSupabase('players?select=*');
  if (!players || players.length === 0) return;

  const withSnaps = [];

  for (const player of players) {
    if (!player.tracker_id) continue;
    const snaps   = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
    const snapshot = snaps?.[0] || null;
    if (snapshot) withSnaps.push({ ...player, snapshot });
  }

  if (withSnaps.length === 0) return;

  withSnaps.sort((a, b) => parseFloat(b.snapshot.kd) - parseFloat(a.snapshot.kd));

  const totalKills = withSnaps.reduce((s, p) => s + (parseInt(p.snapshot.kills) || 0), 0);
  const mvp        = withSnaps[0];

  document.getElementById('ov-players').textContent = withSnaps.length;
  document.getElementById('ov-kills').textContent   = totalKills.toLocaleString();
  document.getElementById('ov-kd').textContent      = parseFloat(mvp.snapshot.kd).toFixed(2);
  document.getElementById('ov-mvp').textContent     = mvp.username || mvp.pseudo_bf6 || '—';

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  document.getElementById('top5-list').innerHTML = withSnaps.slice(0, 5).map((p, i) => `
    <div class="top5-row">
      <div class="top5-rank">${medals[i]}</div>
      <div class="top5-name">${p.username || p.pseudo_bf6 || '—'}</div>
      <div class="top5-platform">${p.platform?.toUpperCase() || '—'}</div>
      <div class="top5-kd">${parseFloat(p.snapshot.kd).toFixed(2)}</div>
      <div class="top5-kills">🎯 ${p.snapshot.kills || 0}</div>
    </div>
  `).join('');
}