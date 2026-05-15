import { fetchSupabase, deleteSupabase } from '../api.js';
import { createTable }                   from '../components/table.js';
import { createActionButtons }           from '../components/actionButtons.js';
import { showToast }                     from '../ui/toast.js';

let allPlayers = [];

export async function initPlayers() {
  const players = await fetchSupabase('players?select=*&order=created_at.desc');
  allPlayers    = players || [];

  for (const player of allPlayers) {
    if (player.tracker_id) {
      const snaps     = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
      player.snapshot = snaps?.[0] || null;
    }
  }

  renderTable(allPlayers);

  document.getElementById('search-player').addEventListener('input', (e) => {
    const q        = e.target.value.toLowerCase();
    const filtered = allPlayers.filter(p =>
      p.username?.toLowerCase().includes(q) || p.tracker_id?.includes(q)
    );
    renderTable(filtered);
  });
}

function calcScore(s) {
  if (!s) return 0;
  const kd      = parseFloat(s.kd)      || 0;
  const winrate = parseFloat(s.winrate) || 0;
  const kills   = parseInt(s.kills)     || 0;
  const games   = parseInt(s.games)     || 1;
  const kpm     = kills / games;
  return ((Math.min(kd / 5, 1) * 100 * 0.30) + (Math.min(winrate / 60, 1) * 100 * 0.35) + (Math.min(kpm / 20, 1) * 100 * 0.25)).toFixed(2);
}

function getDivision(score) {
  const s = parseFloat(score);
  if (s >= 65) return 'WARSTACK 🔱';
  if (s >= 55) return 'Phantom 👻';
  if (s >= 45) return 'Elite 💎';
  if (s >= 35) return 'Veteran 🎖️';
  if (s >= 25) return 'Grunt ⚔️';
  return 'Recruit 🪖';
}

function renderTable(players) {
  const wrapper = document.getElementById('players-table-wrapper');
  if (!players || players.length === 0) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i>Aucun joueur trouvé</div>';
    return;
  }
  wrapper.innerHTML = createTable({
    headers: ['Pseudo', 'Tracker ID', 'Division', 'Score', 'K/D', 'Kills', 'Wins', 'Actions'],
    rows: players.map(p => {
      const s        = p.snapshot;
      const score    = calcScore(s);
      const division = getDivision(score);
      return `
        <tr>
          <td><strong>${p.username || '—'}</strong></td>
          <td><code>${p.tracker_id || '—'}</code></td>
          <td>${division}</td>
          <td>${score}</td>
          <td>${s?.kd ?? '—'}</td>
          <td>${s?.kills ?? '—'}</td>
          <td>${s?.wins ?? '—'}</td>
          <td>${createActionButtons({ remove: `window.deletePlayer('${p.discord_id}', '${p.username}')` })}</td>
        </tr>
      `;
    }).join('')
  });
}

window.deletePlayer = async function(discordId, username) {
  if (!confirm(`Supprimer ${username} ?`)) return;
  await deleteSupabase(`players?discord_id=eq.${discordId}`);
  showToast('✅ Joueur supprimé');
  initPlayers();
};