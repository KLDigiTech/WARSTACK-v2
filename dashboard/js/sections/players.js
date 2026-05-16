import { fetchSupabase, deleteSupabase } from '../api.js';
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

    // Dernier tournoi
    const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${player.discord_id}&order=created_at.desc&limit=1`);
    player.lastEntry = entries?.[0] || null;

    if (player.lastEntry) {
      const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${player.lastEntry.tournament_id}&discord_id=eq.${player.discord_id}&order=submitted_at.desc&limit=1`);
      player.lastSub = subs?.[0] || null;

      const tournois = await fetchSupabase(`tournaments?id=eq.${player.lastEntry.tournament_id}&select=name,phase`);
      player.lastTournoi = tournois?.[0] || null;
    }
  }

  renderTable(allPlayers);

  const searchInput = document.getElementById('search-player');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q        = e.target.value.toLowerCase();
      const filtered = allPlayers.filter(p =>
        p.username?.toLowerCase().includes(q) || p.tracker_id?.includes(q)
      );
      renderTable(filtered);
    });
  }
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
  const wrapper = document.getElementById('players-grid');
  if (!players || players.length === 0) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i>Aucun joueur trouvé</div>';
    return;
  }

  wrapper.innerHTML = players.map(p => {
    const s        = p.snapshot;
    const score    = calcScore(s);
    const division = getDivision(score);

    const tournoi   = p.lastTournoi;
    const sub       = p.lastSub;
    const tournoisBadge = tournoi ? `
      <div class="player-tournoi">
        <span class="player-tournoi-name">🏆 ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''}</span>
        ${sub ? `
          <span class="player-tournoi-stat">K/D <strong>${sub.kd ?? '—'}</strong></span>
          <span class="player-tournoi-stat">Kills <strong>${sub.kills ?? '—'}</strong></span>
        ` : '<span class="player-tournoi-stat">Pas de soumission</span>'}
      </div>
    ` : '';

    return `
      <div class="player-card">
        <div class="player-card-top">
          <div class="player-avatar">
            <img
              src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
              alt="${p.username}"
              onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
          </div>
          <div class="player-main">
            <div class="player-name">${p.username || 'Unknown'}</div>
            <div class="player-division">${division}</div>
          </div>
          <div class="player-card-actions">
            <a href="profil.html?id=${p.discord_id}" target="_blank" class="action-btn profile" title="Voir le profil">
              <i class="fas fa-user"></i>
            </a>
            <button class="action-btn delete" onclick="window.deletePlayer('${p.discord_id}', '${p.username}')" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div class="player-stats">
          <div class="player-stat">
            <span>K/D</span>
            <strong>${s?.kd ?? '—'}</strong>
          </div>
          <div class="player-stat">
            <span>Kills</span>
            <strong>${s?.kills ?? '—'}</strong>
          </div>
          <div class="player-stat">
            <span>Wins</span>
            <strong>${s?.wins ?? '—'}</strong>
          </div>
          <div class="player-stat">
            <span>Score</span>
            <strong>${score}</strong>
          </div>
        </div>

        ${tournoisBadge}

        <div class="player-tracker">${p.tracker_id || 'No tracker'}</div>
      </div>
    `;
  }).join('');
}

window.deletePlayer = async function(discordId, username) {
  if (!confirm(`Supprimer ${username} ?`)) return;
  await deleteSupabase(`players?discord_id=eq.${discordId}`);
  showToast('✅ Joueur supprimé');
  initPlayers();
};