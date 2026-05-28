import { fetchSupabase } from '../api.js';

const params    = new URLSearchParams(window.location.search);
const discordId = params.get('id');

const loading  = document.getElementById('profil-loading');
const notfound = document.getElementById('profil-notfound');
const content  = document.getElementById('profil-content');

// ── PAYS ──────────────────────────────────────────────────────
const PAYS_LIST = [
  { name: 'France',         code: 'FR' }, { name: 'Belgique',       code: 'BE' },
  { name: 'Suisse',         code: 'CH' }, { name: 'Canada',         code: 'CA' },
  { name: 'Maroc',          code: 'MA' }, { name: 'Algérie',        code: 'DZ' },
  { name: 'Tunisie',        code: 'TN' }, { name: 'États-Unis',     code: 'US' },
  { name: 'Royaume-Uni',    code: 'GB' }, { name: 'Allemagne',      code: 'DE' },
  { name: 'Espagne',        code: 'ES' }, { name: 'Italie',         code: 'IT' },
  { name: 'Portugal',       code: 'PT' }, { name: 'Pays-Bas',       code: 'NL' },
  { name: 'Australie',      code: 'AU' }, { name: 'Brésil',         code: 'BR' },
  { name: 'Mexique',        code: 'MX' }, { name: 'Japon',          code: 'JP' },
  { name: 'Sénégal',        code: 'SN' }, { name: "Côte d'Ivoire",  code: 'CI' },
  { name: 'Russie',         code: 'RU' }, { name: 'Chine',          code: 'CN' },
  { name: 'Inde',           code: 'IN' }, { name: 'Afrique du Sud', code: 'ZA' },
  { name: 'Turquie',        code: 'TR' }, { name: 'Pologne',        code: 'PL' },
  { name: 'Suède',          code: 'SE' }, { name: 'Norvège',        code: 'NO' },
  { name: 'Danemark',       code: 'DK' }, { name: 'Finlande',       code: 'FI' },
  { name: 'Autre',          code: 'XX' },
];

function getFlag(code) {
  if (!code || code === 'XX') return '🌍';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

// ── UTILS ─────────────────────────────────────────────────────
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

function fmt(v, isPercent = false) {
  if (v === null || v === undefined || v === 0) return '—';
  if (isPercent) return `${parseFloat(v).toFixed(1)}%`;
  return typeof v === 'number' && v > 999 ? Number(v).toLocaleString('fr-FR') : v;
}

function initTabs() {
  document.querySelectorAll('.profil-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profil-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profil-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
    });
  });
}

// ── MODAL LOCALISATION ────────────────────────────────────────
async function injectEditLocalisation(player) {
  const { supabase }                  = await import('../supabaseClient.js');
  const { SUPABASE_URL, SUPABASE_KEY } = await import('../config.js');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const sessionDiscordId = session.user?.user_metadata?.provider_id
                        || session.user?.user_metadata?.sub;
  if (sessionDiscordId !== player.discord_id) return;

  // Bouton dans le footer
  const footer = document.querySelector('.profil-footer');
  if (!footer) return;

  const editBtn = document.createElement('button');
  editBtn.className = 'profil-edit-btn';
  editBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Ma localisation`;
  footer.prepend(editBtn);

  // Modal
  const modal = document.createElement('div');
  modal.id        = 'localisation-modal';
  modal.className = 'profil-loc-modal';
  modal.innerHTML = `
    <div class="profil-loc-overlay"></div>
    <div class="profil-loc-box">
      <div class="profil-loc-header">
        <h3>📍 Ma localisation</h3>
        <button class="profil-loc-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="profil-loc-body">
        <p class="profil-loc-hint">Ta localisation apparaîtra sur la carte des membres. La ville est optionnelle.</p>
        <div class="form-group">
          <label>Pays <span style="color:#ff4444">*</span></label>
          <select id="loc-pays" class="form-select">
            <option value="">— Sélectionner —</option>
            ${PAYS_LIST.map(p => `
              <option value="${p.code}" ${player.country_code === p.code ? 'selected' : ''}>
                ${getFlag(p.code)} ${p.name}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Région <span class="profil-loc-optional">(optionnel)</span></label>
          <input type="text" id="loc-region" class="form-input"
                 placeholder="Ex: Occitanie, Île-de-France..."
                 value="${player.region || ''}">
        </div>
        <div class="form-group">
          <label>Ville <span class="profil-loc-optional">(optionnel)</span></label>
          <input type="text" id="loc-ville" class="form-input"
                 placeholder="Ex: Montpellier, Paris..."
                 value="${player.city || ''}">
        </div>
      </div>
      <div class="profil-loc-footer">
        <button class="profil-loc-cancel">Annuler</button>
        <button class="profil-loc-save"><i class="fas fa-save"></i> Sauvegarder</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  editBtn.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('.profil-loc-overlay').addEventListener('click', () => modal.classList.remove('open'));
  modal.querySelector('.profil-loc-close').addEventListener('click',   () => modal.classList.remove('open'));
  modal.querySelector('.profil-loc-cancel').addEventListener('click',  () => modal.classList.remove('open'));

  modal.querySelector('.profil-loc-save').addEventListener('click', async () => {
    const countryCode = document.getElementById('loc-pays').value;
    const region      = document.getElementById('loc-region').value.trim() || null;
    const city        = document.getElementById('loc-ville').value.trim()  || null;

    if (!countryCode) { alert('Sélectionne un pays.'); return; }

    const country = PAYS_LIST.find(p => p.code === countryCode)?.name || countryCode;
    const saveBtn = modal.querySelector('.profil-loc-save');
    saveBtn.textContent = 'Sauvegarde...';
    saveBtn.disabled    = true;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/players?discord_id=eq.${player.discord_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ country, country_code: countryCode, region, city })
      });

      if (!res.ok) throw new Error('Erreur serveur');

      modal.classList.remove('open');

      // Mise à jour du badge localisation
      const flag = getFlag(countryCode);
      const loc  = [city, region, country].filter(Boolean).join(', ');
      let locBadge = document.getElementById('p-localisation');
      if (!locBadge) {
        locBadge = document.createElement('div');
        locBadge.id        = 'p-localisation';
        locBadge.className = 'profil-localisation';
        document.querySelector('.profil-identity')?.appendChild(locBadge);
      }
      locBadge.innerHTML = `${flag} ${loc}`;

    } catch {
      alert('Erreur lors de la sauvegarde. Réessaie.');
    } finally {
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
      saveBtn.disabled  = false;
    }
  });
}

// ── LOAD PROFIL ───────────────────────────────────────────────
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

  document.getElementById('p-avatar').src                = player.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('p-username').textContent       = player.username || player.pseudo_bf6 || '—';
  document.getElementById('p-platform').textContent       = player.platform?.toUpperCase() || '—';
  document.getElementById('p-division').textContent       = `${division.emoji} ${division.name}`;
  document.getElementById('p-division-badge').textContent = division.emoji;
  document.getElementById('p-score').textContent          = score;
  document.documentElement.style.setProperty('--division-color', division.color);

  // Localisation
  if (player.country) {
    const flag     = getFlag(player.country_code);
    const loc      = [player.city, player.region, player.country].filter(Boolean).join(', ');
    const identity = document.querySelector('.profil-identity');
    if (identity) {
      const locEl       = document.createElement('div');
      locEl.id          = 'p-localisation';
      locEl.className   = 'profil-localisation';
      locEl.innerHTML   = `${flag} ${loc}`;
      identity.appendChild(locEl);
    }
  }

  // BR Rank hero
  if (snapshot?.br_rank) {
    const brRankEl = document.getElementById('p-br-rank');
    brRankEl.style.display = 'flex';
    document.getElementById('p-br-rank-value').textContent = snapshot.br_rank;
    if (snapshot.br_rank_img) {
      const img = document.getElementById('p-br-rank-img');
      img.src = snapshot.br_rank_img;
      img.style.display = 'inline';
      document.getElementById('p-br-rank-icon').style.display = 'none';
    }
  }

  // BR Rank card Global
  if (snapshot?.br_rank) {
    if (snapshot.br_rank_img) {
      document.getElementById('p-rank-card').style.display = 'flex';
      document.getElementById('p-rank-card-img').src = snapshot.br_rank_img;
      document.getElementById('p-rank-card-value').textContent = snapshot.br_rank.toUpperCase();
    } else {
      document.getElementById('p-rank-card-fallback').style.display = 'flex';
      document.getElementById('p-rank-card-value-fb').textContent = snapshot.br_rank.toUpperCase();
    }
  }

  // Stats Global
  document.getElementById('p-kills').textContent   = snapshot?.kills  ? Number(snapshot.kills).toLocaleString('fr-FR')  : '—';
  document.getElementById('p-deaths').textContent  = snapshot?.deaths ? Number(snapshot.deaths).toLocaleString('fr-FR') : '—';
  document.getElementById('p-kd').textContent      = snapshot?.kd     || '—';
  document.getElementById('p-games').textContent   = snapshot?.games  ? Number(snapshot.games).toLocaleString('fr-FR')  : '—';
  document.getElementById('p-winrate').textContent = snapshot?.winrate ? `${parseFloat(snapshot.winrate).toFixed(1)}%` : '—';

  // Multiplayer
  document.getElementById('p-mp-kills').textContent   = fmt(snapshot?.mp_kills);
  document.getElementById('p-mp-deaths').textContent  = fmt(snapshot?.mp_deaths);
  document.getElementById('p-mp-kd').textContent      = snapshot?.mp_kd    || '—';
  document.getElementById('p-mp-winrate').textContent = fmt(snapshot?.mp_winrate, true);

  // Battle Royale
  document.getElementById('p-br-kills').textContent   = fmt(snapshot?.br_kills);
  document.getElementById('p-br-deaths').textContent  = fmt(snapshot?.br_deaths);
  document.getElementById('p-br-kd').textContent      = snapshot?.br_kd    || '—';
  document.getElementById('p-br-winrate').textContent = fmt(snapshot?.br_winrate, true);

  // BR banner onglet BR
  if (snapshot?.br_rank) {
    const banner = document.getElementById('p-br-rank-banner');
    banner.style.display = 'flex';
    document.getElementById('p-br-rank-banner-value').textContent = snapshot.br_rank.toUpperCase();
    if (snapshot.br_rank_img) {
      const img = document.getElementById('p-br-banner-img');
      img.src = snapshot.br_rank_img;
      img.style.display = 'inline';
      document.getElementById('p-br-banner-icon').style.display = 'none';
    }
  }

  if (player.tracker_url) {
    document.getElementById('p-tracker-link').href = player.tracker_url;
  } else {
    document.getElementById('p-tracker-link').style.display = 'none';
  }

  if (snapshot?.snapshot_at) {
    document.getElementById('p-updated').textContent = `Mis à jour le ${formatDate(snapshot.snapshot_at)}`;
  }

  document.title = `${player.username || 'Joueur'} — WARSTACK`;

  initTabs();
  await loadTournois(discordId);
  await injectEditLocalisation(player);
  showContent();
}

// ── TOURNOIS ──────────────────────────────────────────────────
async function loadTournois(discordId) {
  const container = document.getElementById('p-tournois');

  const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${discordId}&select=*&order=created_at.desc`);
  if (!entries?.length) {
    container.innerHTML = '<div class="profil-empty">Aucun tournoi participé pour l\'instant.</div>';
    return;
  }

  const rows = await Promise.all(entries.map(async (entry) => {
    const tournois = await fetchSupabase(`tournaments?id=eq.${entry.tournament_id}&select=*`);
    const tournoi  = tournois?.[0];
    if (!tournoi) return null;

    const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${entry.tournament_id}&discord_id=eq.${discordId}&status=eq.approved&order=submitted_at.desc`);

    let totalKills = 0, bestKd = 0, totalGames = subs?.length || 0;
    if (subs?.length) {
      subs.forEach(s => {
        totalKills += s.kills || 0;
        if ((s.kd || 0) > bestKd) bestKd = s.kd;
      });
    }

    const scores     = await fetchSupabase(`tournament_scores?tournament_id=eq.${entry.tournament_id}&order=total_score.desc`);
    const rank       = scores?.findIndex(s => s.discord_id === discordId) ?? -1;
    const rankDisplay= rank >= 0 ? `#${rank + 1}` : '—';
    const isMvp      = rank === 0;
    const isTop3     = rank >= 0 && rank < 3;
    const lastSub    = subs?.[0] || null;

    return { tournoi, entry, lastSub, totalKills, bestKd, totalGames, rankDisplay, isMvp, isTop3 };
  }));

  const valid = rows.filter(Boolean);
  if (!valid.length) {
    container.innerHTML = '<div class="profil-empty">Aucune donnée de tournoi.</div>';
    return;
  }

  container.innerHTML = valid.map(({ tournoi, lastSub, totalKills, bestKd, totalGames, rankDisplay, isMvp, isTop3 }) => `
    <div class="profil-tournoi-card">
      <div class="profil-tournoi-header">
        <div>
          <div class="profil-tournoi-name">${tournoi.name}</div>
          ${tournoi.phase ? `<div class="profil-tournoi-phase">${tournoi.phase}</div>` : ''}
          <div class="profil-tournoi-dates">${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}</div>
        </div>
        <div class="profil-tournoi-rank ${isMvp ? 'mvp' : isTop3 ? 'top3' : ''}">${rankDisplay}</div>
      </div>
      <div class="profil-tournoi-stats">
        <div class="profil-tournoi-stat"><strong>${lastSub?.kd ?? '—'}</strong><span>Meilleur K/D</span></div>
        <div class="profil-tournoi-stat"><strong>${totalKills || '—'}</strong><span>Kills totaux</span></div>
        <div class="profil-tournoi-stat"><strong>${totalGames || '—'}</strong><span>Parties</span></div>
        <div class="profil-tournoi-stat"><strong>${rankDisplay}</strong><span>Classement</span></div>
      </div>
      ${isMvp ? '<div class="profil-tournoi-badge mvp">⭐ MVP</div>' : ''}
      ${isTop3 && !isMvp ? '<div class="profil-tournoi-badge top3">🏆 Top 3</div>' : ''}
    </div>
  `).join('');
}

function showNotFound() { loading.style.display='none'; notfound.style.display='flex'; content.style.display='none'; }
function showContent()  { loading.style.display='none'; notfound.style.display='none'; content.style.display='block'; }

loadProfil();