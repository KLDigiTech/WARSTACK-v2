import { fetchSupabase } from '../api.js';

const params    = new URLSearchParams(window.location.search);
const discordId = params.get('id');

const loading  = document.getElementById('profil-loading');
const notfound = document.getElementById('profil-notfound');
const content  = document.getElementById('profil-content');

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
  if (s >= 65) return { name: 'WARSTACK', emoji: '🔱', color: '#ff0000' };
  if (s >= 55) return { name: 'Phantom',  emoji: '👻', color: '#9B59B6' };
  if (s >= 45) return { name: 'Elite',    emoji: '💎', color: '#00BFFF' };
  if (s >= 35) return { name: 'Veteran',  emoji: '🎖️', color: '#FF6600' };
  if (s >= 25) return { name: 'Grunt',    emoji: '⚔️', color: '#95A5A6' };
  return             { name: 'Recruit',   emoji: '🪖', color: '#607D8B' };
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

async function loadProfil() {
  if (!discordId) { showNotFound(); return; }

  const players = await fetchSupabase(`players?discord_id=eq.${discordId}&select=*`);
  const player  = players?.[0];
  if (!player) { showNotFound(); return; }

  let snapshot = null;
  if (player.tracker_id) {
    const snaps = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
    snapshot    = snaps?.[0] || null;
  }

  const score    = calcScore(snapshot);
  const division = getDivision(score);

  document.getElementById('p-avatar').src                  = player.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('p-username').textContent         = player.username || player.pseudo_bf6 || '—';
  document.getElementById('p-platform').textContent         = player.platform?.toUpperCase() || '—';
  document.getElementById('p-division').textContent         = `${division.emoji} ${division.name}`;
  document.getElementById('p-division-badge').textContent   = division.emoji;
  document.getElementById('p-score').textContent            = score;
  document.documentElement.style.setProperty('--division-color', division.color);

  document.getElementById('p-kills').textContent   = snapshot?.kills   ? Number(snapshot.kills).toLocaleString('fr-FR')   : '—';
  document.getElementById('p-deaths').textContent  = snapshot?.deaths  ? Number(snapshot.deaths).toLocaleString('fr-FR')  : '—';
  document.getElementById('p-kd').textContent      = snapshot?.kd      ?? '—';
  document.getElementById('p-wins').textContent    = snapshot?.wins    ?? '—';
  document.getElementById('p-games').textContent   = snapshot?.games   ?? '—';
  document.getElementById('p-winrate').textContent = snapshot?.winrate ? `${snapshot.winrate}%` : '—';

  if (player.tracker_url) {
    document.getElementById('p-tracker-link').href = player.tracker_url;
  } else {
    document.getElementById('p-tracker-link').style.display = 'none';
  }

  if (snapshot?.snapshot_at) {
    document.getElementById('p-updated').textContent = `Mis à jour le ${formatDate(snapshot.snapshot_at)}`;
  }

  document.title = `${player.username || 'Joueur'} — WARSTACK`;

  await loadTournois(discordId);

  showContent();
}

async function loadTournois(discordId) {
  const container = document.getElementById('p-tournois');

  const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${discordId}&select=*`);
  if (!entries?.length) {
    container.innerHTML = '<div class="profil-empty">Aucun tournoi participé pour l\'instant.</div>';
    return;
  }

  const rows = await Promise.all(entries.map(async (entry) => {
    const tournois = await fetchSupabase(`tournaments?id=eq.${entry.tournament_id}&select=*`);
    const tournoi  = tournois?.[0];
    if (!tournoi) return null;

    const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${entry.tournament_id}&discord_id=eq.${discordId}&order=submitted_at.desc&limit=1`);
    const sub  = subs?.[0] || null;

    const scores = await fetchSupabase(`tournament_scores?tournament_id=eq.${entry.tournament_id}&order=score.desc`);
    const rank   = scores?.findIndex(s => s.discord_id === discordId) ?? -1;
    const rankDisplay = rank >= 0 ? `#${rank + 1}` : '—';
    const isMvp  = rank === 0;
    const isTop3 = rank >= 0 && rank < 3;

    return { tournoi, sub, rankDisplay, isMvp, isTop3 };
  }));

  const valid = rows.filter(Boolean);

  if (!valid.length) {
    container.innerHTML = '<div class="profil-empty">Aucune donnée de tournoi disponible.</div>';
    return;
  }

  container.innerHTML = valid.map(({ tournoi, sub, rankDisplay, isMvp, isTop3 }) => `
    <div class="profil-tournoi-card">
      <div>
        <div class="profil-tournoi-name">${tournoi.name}</div>
        ${tournoi.phase ? `<div class="profil-tournoi-phase">${tournoi.phase}</div>` : ''}
        <div class="profil-tournoi-phase">${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}</div>
      </div>
      <div class="profil-tournoi-stats">
        <div class="profil-tournoi-stat">
          <strong>${sub?.kd ?? '—'}</strong>
          <span>K/D</span>
        </div>
        <div class="profil-tournoi-stat">
          <strong>${sub?.kills ?? '—'}</strong>
          <span>Kills</span>
        </div>
        <div class="profil-tournoi-stat">
          <strong>${rankDisplay}</strong>
          <span>Classement</span>
        </div>
      </div>
      ${isMvp  ? '<div class="profil-tournoi-badge mvp">⭐ MVP</div>'   : ''}
      ${isTop3 && !isMvp ? '<div class="profil-tournoi-badge top3">🏆 Top 3</div>' : ''}
    </div>
  `).join('');
}

function showNotFound() {
  loading.style.display  = 'none';
  notfound.style.display = 'flex';
  content.style.display  = 'none';
}

function showContent() {
  loading.style.display  = 'none';
  notfound.style.display = 'none';
  content.style.display  = 'block';
}

loadProfil();