import { fetchSupabase, deleteSupabase, insertSupabase, callBotAPI } from '../api.js';
import { showToast } from '../ui/toast.js';

let allPlayers = [];

export async function initPlayers() {
  const players = await fetchSupabase('players?select=*&order=created_at.desc');
  allPlayers    = players || [];

  for (const player of allPlayers) {
    // Dernier snapshot
    if (player.tracker_id) {
      const snaps     = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
      player.snapshot = snaps?.[0] || null;
    }

    // Dernière participation tournoi
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
        p.username?.toLowerCase().includes(q) ||
        p.pseudo_bf6?.toLowerCase().includes(q) ||
        p.tracker_id?.includes(q)
      );
      renderTable(filtered);
    });
  }

  initAddPlayerModal();
}

// ─── SCORE ───────────────────────────────────────────────────────────────────

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

// ─── RENDER ──────────────────────────────────────────────────────────────────

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
    const tournoi  = p.lastTournoi;
    const sub      = p.lastSub;

    const tournoisBadge = tournoi ? `
      <div class="player-tournoi">
        <span class="player-tournoi-name">🏆 ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''}</span>
        ${sub
          ? `<span class="player-tournoi-stat">K/D <strong>${sub.kd ?? '—'}</strong></span>
             <span class="player-tournoi-stat">Kills <strong>${sub.kills ?? '—'}</strong></span>`
          : '<span class="player-tournoi-stat">Pas de soumission</span>'}
      </div>` : '';

    // BR rank image
    const brRankHtml = s?.br_rank ? `
      <div class="player-br-rank">
        ${s.br_rank_img ? `<img src="${s.br_rank_img}" style="width:20px;height:20px;object-fit:contain">` : '<i class="fas fa-shield-alt"></i>'}
        <span>${s.br_rank}</span>
      </div>` : '';

    return `
      <div class="player-card">
        <div class="player-card-top">
          <div class="player-avatar">
            <img src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
              alt="${p.username}"
              onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
          </div>
          <div class="player-main">
            <div class="player-name">${p.username || 'Unknown'}</div>
            <div class="player-division">${division}</div>
            ${brRankHtml}
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
            <strong>${s?.kills ? Number(s.kills).toLocaleString('fr-FR') : '—'}</strong>
          </div>
          <div class="player-stat">
            <span>Win Rate</span>
            <strong>${s?.winrate ? `${parseFloat(s.winrate).toFixed(1)}%` : '—'}</strong>
          </div>
          <div class="player-stat">
            <span>Score WS</span>
            <strong style="color:var(--green)">${score}</strong>
          </div>
        </div>

        ${tournoisBadge}

        <div class="player-tracker">${p.tracker_id || 'No tracker'}</div>
      </div>`;
  }).join('');
}

// ─── MODAL AJOUT ─────────────────────────────────────────────────────────────

function initAddPlayerModal() {
  const btnOpen      = document.getElementById('btn-add-player');
  const modal        = document.getElementById('modal-add-player');
  const btnClose     = document.getElementById('modal-add-close');
  const btnConfirm   = document.getElementById('btn-add-confirm');
  const btnFetch     = document.getElementById('btn-fetch-discord');
  const discordInput = document.getElementById('add-discord-id');
  const trackerInput = document.getElementById('add-tracker-url');
  const trackerHint  = document.getElementById('add-tracker-hint');
  const errorDiv     = document.getElementById('add-error');
  const discordPreview  = document.getElementById('add-discord-preview');
  const discordAvatar   = document.getElementById('add-discord-avatar');
  const discordUsername = document.getElementById('add-discord-username');
  const discordError    = document.getElementById('add-discord-error');

  let selectedPlatform = null;
  let fetchedAvatar    = null;

  if (!btnOpen || !modal) return;

  btnOpen.addEventListener('click', () => { resetAddForm(); modal.style.display = 'flex'; });
  btnClose.addEventListener('click', () => modal.style.display = 'none');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  btnFetch.addEventListener('click', async () => {
    const id = discordInput.value.trim();
    if (!id || !/^\d{15,20}$/.test(id)) {
      discordError.style.display = 'block';
      discordError.textContent   = 'ID Discord invalide (15-20 chiffres)';
      return;
    }
    btnFetch.disabled     = true;
    btnFetch.innerHTML    = '<i class="fas fa-spinner fa-spin"></i>';
    discordError.style.display   = 'none';
    discordPreview.style.display = 'none';
    try {
      const data = await callBotAPI(`user/${id}`);
      if (data?.error) throw new Error(data.error);
      document.getElementById('add-username').value = data.username;
      fetchedAvatar = data.avatar;
      discordAvatar.src           = data.avatar;
      discordUsername.textContent = data.username;
      discordPreview.style.display = 'flex';
      checkAddReady();
    } catch (e) {
      discordError.style.display = 'block';
      discordError.textContent   = '❌ ' + e.message;
    } finally {
      btnFetch.disabled  = false;
      btnFetch.innerHTML = '<i class="fas fa-search"></i> Fetch';
    }
  });

  document.querySelectorAll('#modal-add-player .platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modal-add-player .platform-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkAddReady();
    });
  });

  trackerInput.addEventListener('input', () => {
    const val   = trackerInput.value.trim();
    const match = val.match(/\/(\d{8,})(?:\/|$)/);
    if (match) {
      trackerHint.style.display = 'block';
      trackerHint.className     = 'hint ok';
      trackerHint.textContent   = `✓ Tracker ID détecté : ${match[1]}`;
    } else if (val.length > 0) {
      trackerHint.style.display = 'block';
      trackerHint.className     = 'hint';
      trackerHint.textContent   = 'URL non reconnue — ajouté sans tracker';
    } else {
      trackerHint.style.display = 'none';
    }
    checkAddReady();
  });

  document.getElementById('add-username').addEventListener('input', checkAddReady);
  document.getElementById('add-pseudo-bf6').addEventListener('input', checkAddReady);

  function checkAddReady() {
    const username  = document.getElementById('add-username').value.trim();
    const pseudoBf6 = document.getElementById('add-pseudo-bf6').value.trim();
    btnConfirm.disabled = !(username.length >= 2 && pseudoBf6.length >= 2 && !!selectedPlatform);
  }

  btnConfirm.addEventListener('click', async () => {
    const username   = document.getElementById('add-username').value.trim();
    const pseudoBf6  = document.getElementById('add-pseudo-bf6').value.trim();
    const trackerUrl = trackerInput.value.trim();
    const discordId  = discordInput.value.trim();
    const match      = trackerUrl.match(/\/(\d{8,})(?:\/|$)/);
    const trackerId  = match ? match[1] : null;
    const finalDiscordId = discordId || `manual_${Date.now()}`;

    errorDiv.style.display = 'none';
    btnConfirm.disabled    = true;
    btnConfirm.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

    try {
      const existing = await fetchSupabase(`players?discord_id=eq.${finalDiscordId}`);
      if (existing?.length > 0) { showError('Ce Discord ID existe déjà.'); return; }

      await insertSupabase('players', {
        discord_id  : finalDiscordId,
        username    : username,
        pseudo_bf6  : pseudoBf6,
        platform    : selectedPlatform,
        tracker_id  : trackerId,
        tracker_url : trackerUrl || null,
        avatar_url  : fetchedAvatar || null,
        created_at  : new Date().toISOString(),
      });

      modal.style.display = 'none';
      showToast(`✅ ${username} ajouté !`);
      initPlayers();
    } catch (err) {
      showError('Erreur : ' + err.message);
    }
  });

  function showError(msg) {
    errorDiv.style.display = 'block';
    errorDiv.textContent   = '❌ ' + msg;
    btnConfirm.disabled    = false;
    btnConfirm.innerHTML   = '<i class="fas fa-plus"></i> INSCRIRE LE JOUEUR';
  }

  function resetAddForm() {
    document.getElementById('add-username').value    = '';
    document.getElementById('add-pseudo-bf6').value  = '';
    document.getElementById('add-tracker-url').value = '';
    document.getElementById('add-discord-id').value  = '';
    trackerHint.style.display    = 'none';
    errorDiv.style.display       = 'none';
    discordPreview.style.display = 'none';
    discordError.style.display   = 'none';
    btnConfirm.disabled          = true;
    btnConfirm.innerHTML         = '<i class="fas fa-plus"></i> INSCRIRE LE JOUEUR';
    selectedPlatform             = null;
    fetchedAvatar                = null;
    document.querySelectorAll('#modal-add-player .platform-btn').forEach(b => b.classList.remove('selected'));
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

window.deletePlayer = async function(discordId, username) {
  if (!confirm(`Supprimer ${username} ?`)) return;
  await deleteSupabase(`players?discord_id=eq.${discordId}`);
  showToast('✅ Joueur supprimé');
  initPlayers();
};