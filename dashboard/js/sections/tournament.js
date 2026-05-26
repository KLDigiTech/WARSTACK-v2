import { fetchSupabase, updateSupabase, insertSupabase, deleteSupabase, callBotAPI } from '../api.js';
import { supabase } from '../supabaseClient.js';
import { showConfirm } from '../ui/confirm.js';

const OCR_URL = 'https://kldigitech-warstack-ocr.hf.space/ocr';

let showCreateForm = false;
let currentTournoi = null;

export async function initTournament() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      loadTab(btn.dataset.tab);
    });
  });
  currentTournoi = await getTournoiActif();
  loadTab('tournoi');
}

async function loadTab(tab) {
  switch (tab) {
    case 'tournoi':     return loadTournoi();
    case 'inscrits':    return loadInscrits();
    case 'soumissions': return loadSoumissions();
    case 'scoreboard':  return loadScoreboard();
    case 'outils':      return loadOutils();
  }
}

// =====================================================
// TOURNOI
// =====================================================

async function loadTournoi() {
  const container = document.getElementById('tab-tournoi');
  container.innerHTML = '<p>Chargement...</p>';

  const tournois = await fetchSupabase('tournaments?order=created_at.desc&limit=20');
  const actifs   = tournois?.filter(t => t.status === 'active') || [];
  const archives = tournois?.filter(t => t.status !== 'active') || [];

  let html = '';

  html += `
    <div class="tournament-topbar">
      <button class="btn btn-primary" id="btn-toggle-create">
        <i class="fas fa-plus"></i> Nouveau tournoi
      </button>
    </div>
  `;

  html += `
    <div class="tournament-create-card" id="create-form" style="display:${showCreateForm ? 'block' : 'none'}">
      <div class="tournament-create-header">➕ CRÉER UN TOURNOI</div>
      <div class="tournament-form-grid">
        <div class="form-group full">
          <label>Nom du tournoi</label>
          <input type="text" id="t-nom" class="form-input" placeholder="ex: Tournoi PöF — Saison 1">
        </div>
        <div class="form-group">
          <label>Date de début</label>
          <input type="date" id="t-start" class="form-input">
        </div>
        <div class="form-group">
          <label>Date de fin</label>
          <input type="date" id="t-end" class="form-input">
        </div>
        <div class="form-group">
          <label>Max joueurs <span class="muted">(0 = illimité)</span></label>
          <input type="number" id="t-max" class="form-input" value="0" min="0">
        </div>
        <div class="form-group">
          <label>Phase <span class="muted">(optionnel)</span></label>
          <input type="text" id="t-phase" class="form-input" placeholder="ex: Phase 1, RedSec, Multi...">
        </div>
        <div class="form-group">
          <label>Points par kill</label>
          <input type="number" id="t-ppk" class="form-input" value="1" min="0">
        </div>
        <div class="form-group">
          <label>Points Top 1</label>
          <input type="number" id="t-top1" class="form-input" value="10" min="0">
        </div>
        <div class="form-group">
          <label>Points Top 2</label>
          <input type="number" id="t-top2" class="form-input" value="7" min="0">
        </div>
        <div class="form-group">
          <label>Points Top 3</label>
          <input type="number" id="t-top3" class="form-input" value="5" min="0">
        </div>
        <div class="form-group">
          <label>Points Top 4</label>
          <input type="number" id="t-top4" class="form-input" value="3" min="0">
        </div>
        <div class="form-group">
          <label>Points Top 5</label>
          <input type="number" id="t-top5" class="form-input" value="1" min="0">
        </div>
        <div class="form-group full">
          <label>Description <span class="muted">(optionnel)</span></label>
          <textarea id="t-desc" class="form-textarea" placeholder="Règles, format, informations..."></textarea>
        </div>
      </div>
      <div class="tournament-actions">
        <button id="btn-create-tournoi" class="btn btn-primary">
          <i class="fas fa-trophy"></i> Créer le tournoi
        </button>
        <button id="btn-cancel-create" class="btn btn-secondary">Annuler</button>
        <span class="form-helper">* Champs obligatoires : nom, dates</span>
      </div>
    </div>
  `;

  if (actifs.length) {
    actifs.forEach(actif => {
      html += `
        <div class="tournament-active-card" data-id="${actif.id}">
          <div class="tournament-active-top">
            <div>
              <div class="tournament-badge-active">🟢 TOURNOI ACTIF${actif.phase ? ` — ${actif.phase}` : ''}</div>
              <h2 class="tournament-active-title">${actif.name}</h2>
              <div class="tournament-stats">
                <div class="tournament-stat">
                  <span class="tournament-stat-label">DÉBUT</span>
                  <span class="tournament-stat-value">${formatDate(actif.start_date)}</span>
                </div>
                <div class="tournament-stat">
                  <span class="tournament-stat-label">FIN</span>
                  <span class="tournament-stat-value">${formatDate(actif.end_date)}</span>
                </div>
                <div class="tournament-stat">
                  <span class="tournament-stat-label">MAX JOUEURS</span>
                  <span class="tournament-stat-value">${actif.max_players || '∞'}</span>
                </div>
                <div class="tournament-stat">
                  <span class="tournament-stat-label">PTS/KILL</span>
                  <span class="tournament-stat-value">${actif.points_per_kill ?? 1}</span>
                </div>
                <div class="tournament-stat">
                  <span class="tournament-stat-label">TOP 1</span>
                  <span class="tournament-stat-value">${actif.points_top1 ?? 10} pts</span>
                </div>
              </div>
              ${actif.description ? `<p class="tournament-description">${actif.description}</p>` : ''}
            </div>
            <div class="tournament-actions-column">
              <button class="btn btn-danger btn-terminer" data-id="${actif.id}">🏁 Terminer</button>
              <button class="btn btn-secondary btn-annuler" data-id="${actif.id}">❌ Annuler</button>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    html += `<div class="empty-state"><i class="fas fa-trophy"></i>Aucun tournoi actif</div>`;
  }

  if (archives.length) {
    html += `
      <div class="tournament-history-card">
        <div class="tournament-history-title">📁 HISTORIQUE</div>
        <table class="data-table">
          <thead><tr><th>Nom</th><th>Phase</th><th>Début</th><th>Fin</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody>
            ${archives.map(t => `
              <tr>
                <td>${t.name}</td>
                <td>${t.phase || '—'}</td>
                <td>${formatDate(t.start_date)}</td>
                <td>${formatDate(t.end_date)}</td>
                <td class="${t.status === 'termine' ? 'status-green' : 'status-red'}">${t.status}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.supprimerTournoi('${t.id}', '${t.name}')">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  html += `<div id="tournament-feedback" class="feedback"></div>`;
  container.innerHTML = html;

  document.getElementById('btn-toggle-create')?.addEventListener('click', () => {
    showCreateForm = !showCreateForm;
    document.getElementById('create-form').style.display = showCreateForm ? 'block' : 'none';
  });

  document.getElementById('btn-cancel-create')?.addEventListener('click', () => {
    showCreateForm = false;
    document.getElementById('create-form').style.display = 'none';
  });

  document.getElementById('btn-create-tournoi')?.addEventListener('click', creerTournoi);

  document.querySelectorAll('.btn-terminer').forEach(btn => {
    btn.addEventListener('click', () => terminerTournoi(btn.dataset.id));
  });

  document.querySelectorAll('.btn-annuler').forEach(btn => {
    btn.addEventListener('click', () => annulerTournoi(btn.dataset.id));
  });
}

// =====================================================
// SOUMISSIONS
// =====================================================

async function loadSoumissions() {
  const container = document.getElementById('tab-soumissions');
  const tournoi   = await getTournoiActif();

  const subs = tournoi
    ? await fetchSupabase(`tournament_submissions?tournament_id=eq.${tournoi.id}&order=submitted_at.desc`)
    : [];

  let html = `
    <div class="soumission-header">
      <div class="soumission-title">📸 SOUMETTRE UN RÉSULTAT</div>
      <div class="soumission-tournoi">${tournoi ? `Tournoi actif : <strong>${tournoi.name}</strong>` : '⚠️ Aucun tournoi actif'}</div>
    </div>

    <div class="soumission-drop-zone${!tournoi ? ' drop-disabled' : ''}" id="sub-drop-zone" ${!tournoi ? 'style="opacity:0.4;pointer-events:none;cursor:not-allowed"' : ''}>
      <div class="soumission-drop-icon">📁</div>
      <div class="soumission-drop-text">Glisse le screenshot de fin de partie ici</div>
      <div class="soumission-drop-sub">ou clique pour sélectionner</div>
      <input type="file" id="sub-file-input" accept="image/*" style="display:none">
    </div>

    <div id="sub-preview-wrap" style="display:none">
      <img id="sub-preview-img" alt="preview" style="max-width:100%;max-height:250px;border-radius:8px;border:1px solid var(--border);margin-bottom:1rem">
    </div>

    <div id="sub-anti-cheat" class="anti-cheat-checks" style="display:none">
      <div class="anti-cheat-title">🛡️ VÉRIFICATIONS ANTI-TRICHE</div>
      <div id="sub-check-resolution" class="check-item">⏳ Résolution image...</div>
      <div id="sub-check-tournoi"    class="check-item">⏳ Tournoi actif...</div>
      <div id="sub-check-doublon"    class="check-item">⏳ Doublon...</div>
      <div id="sub-check-pseudo"     class="check-item">⏳ Pseudo inscrit...</div>
    </div>

    <button id="sub-send-btn" style="display:none" class="btn btn-primary sub-send-btn">
      <span id="sub-btn-text">▶ ANALYSER ET SOUMETTRE</span>
    </button>

    <div id="sub-result" style="display:none" class="sub-result-box"></div>
    <div id="sub-error" style="display:none" class="sub-error-box"></div>

    <div class="soumission-history-title">📋 SOUMISSIONS DU TOURNOI</div>
  `;

  if (!subs?.length) {
    html += '<div class="empty-state"><i class="fas fa-image"></i>Aucune soumission</div>';
  } else {
    html += `
      <table class="data-table">
        <thead>
          <tr>
            <th>Joueur</th>
            <th>Pseudo BF6</th>
            <th>Placement</th>
            <th>Kills</th>
            <th>Score</th>
            <th>Statut</th>
            <th>Screenshot</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${subs.map(s => `
            <tr>
              <td>${s.discord_id || '—'}</td>
              <td>${s.pseudo || '—'}</td>
              <td>#${s.placement ?? '?'}</td>
              <td>${s.kills ?? '—'}</td>
              <td><strong>${s.score ?? '—'}</strong></td>
              <td class="${s.status === 'approved' ? 'status-green' : s.status === 'rejected' ? 'status-red' : 'status-orange'}">${s.status}</td>
              <td>${s.image_url ? `<a href="${s.image_url}" target="_blank" class="btn btn-sm btn-secondary">Voir</a>` : '—'}</td>
              <td>
                ${s.status === 'pending' ? `
                  <button class="btn btn-sm btn-primary btn-approve" data-id="${s.id}" data-tid="${tournoi.id}" data-did="${s.discord_id}" data-kills="${s.kills}" data-score="${s.score}" data-placement="${s.placement}">✅</button>
                  <button class="btn btn-sm btn-danger btn-reject" data-id="${s.id}">❌</button>
                ` : ''}
                <button class="btn btn-sm btn-danger btn-delete-sub" data-id="${s.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = html;
  initSoumissionEvents(tournoi);
}

function initSoumissionEvents(tournoi) {
  const dropZone   = document.getElementById('sub-drop-zone');
  const fileInput  = document.getElementById('sub-file-input');
  const sendBtn    = document.getElementById('sub-send-btn');
  const btnText    = document.getElementById('sub-btn-text');
  const preview    = document.getElementById('sub-preview-wrap');
  const previewImg = document.getElementById('sub-preview-img');
  const resultDiv  = document.getElementById('sub-result');
  const errorDiv   = document.getElementById('sub-error');
  const antiCheat  = document.getElementById('sub-anti-cheat');

  let currentFile = null;
  let imageHash   = null;

  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) loadPreview(file);
  });
  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => { if (fileInput.files[0]) loadPreview(fileInput.files[0]); });

  function loadPreview(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      preview.style.display = 'block';
      sendBtn.style.display = 'block';
      resultDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      antiCheat.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  sendBtn?.addEventListener('click', async () => {
    if (!currentFile) return;

    try {
      btnText.textContent = '⏳ ANALYSE EN COURS...';
      sendBtn.disabled = true;
      resultDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      antiCheat.style.display = 'block';

      // =======================================
      // ANTI-TRICHE 1 — Résolution
      // =======================================
      const img = new Image();
      img.src = URL.createObjectURL(currentFile);
      await new Promise(r => img.onload = r);

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const validRes = [
        [1920, 1080], [2560, 1440], [3840, 2160],
        [1280, 720],  [2560, 1080]
      ];
      const resOk = validRes.some(([rw, rh]) => rw === w && rh === h);
      setCheck('sub-check-resolution', resOk, `Résolution ${w}x${h} ${resOk ? '✅' : '❌ non reconnue'}`);
      if (!resOk) throw new Error(`Résolution ${w}x${h} non reconnue. Screenshot PS5/Xbox/PC requis.`);

      // =======================================
      // ANTI-TRICHE 2 — Tournoi actif
      // =======================================
      const tournoiOk = tournoi.status === 'active';
      setCheck('sub-check-tournoi', tournoiOk, `Tournoi ${tournoiOk ? 'actif ✅' : 'inactif ❌'}`);
      if (!tournoiOk) throw new Error('Aucun tournoi actif en ce moment.');

      // =======================================
      // ANTI-TRICHE 3 — Hash doublon
      // =======================================
      const hashBuffer = await crypto.subtle.digest('SHA-256', await currentFile.arrayBuffer());
      imageHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: existingHash } = await supabase
        .from('tournament_submissions')
        .select('id')
        .eq('tournament_id', tournoi.id)
        .eq('image_hash', imageHash)
        .maybeSingle();

      const doublonOk = !existingHash;
      setCheck('sub-check-doublon', doublonOk, `Doublon ${doublonOk ? 'aucun ✅' : 'détecté ❌'}`);
      if (!doublonOk) throw new Error('Ce screenshot a déjà été soumis.');

      // =======================================
      // OCR
      // =======================================
      const formData = new FormData();
      formData.append('image', currentFile);
      const response = await fetch(OCR_URL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`OCR HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('OCR échoué');

      // =======================================
      // ANTI-TRICHE 4 — Pseudo inscrit
      // =======================================
      let matchedPlayer = null;
      let matchedPseudo = null;

      for (const player of data.players) {
        const pseudo = player.pseudo;
        if (!pseudo || pseudo.startsWith('JOUEUR')) continue;

        const { data: found } = await supabase
          .from('players')
          .select('discord_id, pseudo_bf6, username, avatar_url')
          .ilike('pseudo_bf6', pseudo)
          .maybeSingle();

        if (found) {
          matchedPlayer = found;
          matchedPseudo = pseudo;
          break;
        }
      }

      const pseudoOk = !!matchedPlayer;
      setCheck('sub-check-pseudo', pseudoOk, `Pseudo ${pseudoOk ? `${matchedPseudo} inscrit ✅` : 'aucun joueur inscrit trouvé ⚠️'}`);

      // =======================================
      // CALCUL SCORE
      // =======================================
      const ppk     = tournoi.points_per_kill ?? 1;
      const topPts  = [
        tournoi.points_top1 ?? 10,
        tournoi.points_top2 ?? 7,
        tournoi.points_top3 ?? 5,
        tournoi.points_top4 ?? 3,
        tournoi.points_top5 ?? 1,
      ];
      const placement    = data.placement ?? 0;
      const squadKills   = data.squad_kills ?? 0;
      const placementPts = placement >= 1 && placement <= 5 ? topPts[placement - 1] : 0;
      const killsPts     = squadKills * ppk;
      const totalScore   = placementPts + killsPts;

      // =======================================
      // AUTO-APPROVE ou FLAG
      // =======================================
      const exif = data.exif || {};
      let autoStatus = 'approved';
      let flagReason = [];

      if (!pseudoOk)       flagReason.push('pseudo_non_inscrit');
      if (placement === 0) flagReason.push('placement_non_detecte');
      if (exif.suspicious) flagReason.push(`exif_suspect:${exif.reason}`);

      if (flagReason.length > 0) autoStatus = 'pending';

      const playerData = data.players?.[0] || {};

      // =======================================
      // INSERTION SUPABASE
      // =======================================
      await supabase.from('tournament_submissions').insert({
        tournament_id : tournoi.id,
        discord_id    : matchedPlayer?.discord_id || null,
        pseudo        : matchedPseudo || playerData.pseudo || 'INCONNU',
        kills         : squadKills,
        placement     : placement,
        score         : totalScore,
        kd            : playerData.kd || 0,
        image_hash    : imageHash,
        status        : autoStatus,
        submitted_at  : new Date().toISOString(),
        created_at    : new Date().toISOString(),
      });

      // =======================================
      // SI AUTO-APPROUVÉ → scores + leaderboard Discord
      // =======================================
      if (autoStatus === 'approved' && matchedPlayer?.discord_id) {
        const { data: existingScore } = await supabase
          .from('tournament_scores')
          .select('*')
          .eq('tournament_id', tournoi.id)
          .eq('discord_id', matchedPlayer.discord_id)
          .maybeSingle();

        if (existingScore) {
          await supabase.from('tournament_scores').update({
            total_kills  : (existingScore.total_kills || 0) + squadKills,
            total_score  : (existingScore.total_score || 0) + totalScore,
            games_played : (existingScore.games_played || 0) + 1,
            updated_at   : new Date().toISOString(),
          }).eq('id', existingScore.id);
        } else {
          await supabase.from('tournament_scores').insert({
            tournament_id : tournoi.id,
            discord_id    : matchedPlayer.discord_id,
            total_kills   : squadKills,
            total_score   : totalScore,
            games_played  : 1,
            updated_at    : new Date().toISOString(),
          });
        }

        // ✅ TRIGGER LEADERBOARD DISCORD
        await callBotAPI('leaderboard/tournament', 'POST', { tournament_id: tournoi.id });
      }

      // =======================================
      // AFFICHAGE RÉSULTAT
      // =======================================
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div class="sub-result-title">✅ SOUMISSION ENREGISTRÉE</div>
        <div class="sub-result-grid">
          <div class="sub-result-stat">
            <div class="sub-result-val">#${placement}</div>
            <div class="sub-result-lbl">PLACEMENT</div>
          </div>
          <div class="sub-result-stat">
            <div class="sub-result-val">${squadKills}</div>
            <div class="sub-result-lbl">KILLS</div>
          </div>
          <div class="sub-result-stat">
            <div class="sub-result-val">${totalScore}</div>
            <div class="sub-result-lbl">SCORE</div>
          </div>
        </div>
        <div class="sub-result-detail">
          ${placementPts} pts placement + ${killsPts} pts kills
          ${autoStatus === 'approved'
            ? '— ✅ Auto-approuvé, score enregistré !'
            : '— ⚠️ En attente de validation admin (' + flagReason.join(', ') + ')'
          }
        </div>
      `;

      setTimeout(() => loadSoumissions(), 1500);

    } catch (err) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = '❌ ' + err.message;
    } finally {
      btnText.textContent = '▶ ANALYSER ET SOUMETTRE';
      sendBtn.disabled = false;
    }
  });

  // APPROVE / REJECT manuels
  document.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => approveSubmission(btn.dataset));
  });

  document.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => rejectSubmission(btn.dataset.id));
  });

  document.querySelectorAll('.btn-delete-sub').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('tournament_submissions').delete().eq('id', btn.dataset.id);
      loadSoumissions();
    });
  });
}

function setCheck(id, ok, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.className = `check-item ${ok ? 'check-ok' : 'check-fail'}`; }
}

// =====================================================
// APPROVE MANUEL — avec trigger leaderboard Discord
// =====================================================

async function approveSubmission({ id, tid, did, kills, score, placement }) {
  await supabase.from('tournament_submissions').update({ status: 'approved' }).eq('id', id);

  const { data: existing } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', tid)
    .eq('discord_id', did)
    .maybeSingle();

  if (existing) {
    await supabase.from('tournament_scores').update({
      total_kills  : (existing.total_kills || 0) + parseInt(kills),
      total_score  : (existing.total_score || 0) + parseInt(score),
      games_played : (existing.games_played || 0) + 1,
      updated_at   : new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('tournament_scores').insert({
      tournament_id : tid,
      discord_id    : did,
      total_kills   : parseInt(kills),
      total_score   : parseInt(score),
      games_played  : 1,
      updated_at    : new Date().toISOString(),
    });
  }

  // ✅ TRIGGER LEADERBOARD DISCORD
  await callBotAPI('leaderboard/tournament', 'POST', { tournament_id: tid });

  loadSoumissions();
}

async function rejectSubmission(id) {
  await supabase.from('tournament_submissions').update({ status: 'rejected' }).eq('id', id);
  loadSoumissions();
}

// =====================================================
// SCOREBOARD
// =====================================================

async function loadScoreboard() {
  const container = document.getElementById('tab-scoreboard');
  const tournoi   = await getTournoiActif();
  if (!tournoi) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i>Aucun tournoi actif</div>'; return; }

  // Scores joueurs + jointure players pour username/avatar
  const scores  = await fetchSupabase(`tournament_scores?tournament_id=eq.${tournoi.id}&order=total_score.desc&select=*,players(username,avatar_url)`);
  // Inscrits pour récupérer team_name/team_id par discord_id
  const inscrits = await fetchSupabase(`tournament_entries?tournament_id=eq.${tournoi.id}&select=discord_id,team_id,team_name`);
  // Équipes du tournoi
  const teams   = await fetchSupabase(`teams?tournament_id=eq.${tournoi.id}&select=*`);

  if (!scores?.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i>Aucun score</div>'; return; }

  // Map discord_id → team
  const teamByPlayer = {};
  (inscrits || []).forEach(e => { teamByPlayer[e.discord_id] = { id: e.team_id, name: e.team_name }; });

  // Grouper scores par équipe
  const teamScores = {};
  const soloScores = [];

  scores.forEach(s => {
    const username = s.players?.username || s.discord_id;
    const avatar   = s.players?.avatar_url || null;
    const team     = teamByPlayer[s.discord_id];
    const entry    = { ...s, username, avatar, teamName: team?.name || null, teamId: team?.id || null };

    if (team?.id) {
      if (!teamScores[team.id]) teamScores[team.id] = { name: team.name, total_score: 0, total_kills: 0, games_played: 0, players: [] };
      teamScores[team.id].total_score  += s.total_score  || 0;
      teamScores[team.id].total_kills  += s.total_kills  || 0;
      teamScores[team.id].games_played += s.games_played || 0;
      teamScores[team.id].players.push(entry);
    } else {
      soloScores.push(entry);
    }
  });

  const sortedTeams = Object.values(teamScores).sort((a, b) => b.total_score - a.total_score);
  const medals = ['🥇', '🥈', '🥉'];
  const topKiller = [...scores].sort((a, b) => (b.total_kills || 0) - (a.total_kills || 0))[0];

  let html = '';

  // AWARDS
  html += `
    <div class="scoreboard-awards">
      <div class="award-card">
        <div class="award-icon">💀</div>
        <div class="award-label">TOP KILLER</div>
        <div class="award-value">${topKiller.players?.username || topKiller.discord_id}</div>
        <div class="award-sub">${topKiller.total_kills} kills</div>
      </div>
    </div>
  `;

  // CLASSEMENT PAR EQUIPE
  if (sortedTeams.length) {
    html += `<div class="scoreboard-section-title">🛡️ CLASSEMENT PAR ÉQUIPE</div>`;
    html += `<table class="data-table">
      <thead><tr><th>#</th><th>Équipe</th><th>Score</th><th>Kills</th><th>Parties</th></tr></thead>
      <tbody>
        ${sortedTeams.map((t, i) => `
          <tr class="${i === 0 ? 'row-gold' : i === 1 ? 'row-silver' : i === 2 ? 'row-bronze' : ''}">
            <td>${medals[i] || i + 1}</td>
            <td><strong>${t.name}</strong></td>
            <td><strong>${t.total_score}</strong></td>
            <td>${t.total_kills}</td>
            <td>${t.games_played}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

    // DETAIL PAR EQUIPE
    sortedTeams.forEach((t, i) => {
      html += `
        <div class="scoreboard-team-block">
          <div class="scoreboard-team-title">${medals[i] || '🔹'} ${t.name}</div>
          <table class="data-table">
            <thead><tr><th>Joueur</th><th>Score</th><th>Kills</th><th>Parties</th></tr></thead>
            <tbody>
              ${t.players.sort((a, b) => (b.total_score || 0) - (a.total_score || 0)).map(p => `
                <tr>
                  <td>
                    ${p.avatar ? `<img src="${p.avatar}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px">` : ''}
                    ${p.username}
                  </td>
                  <td><strong>${p.total_score}</strong></td>
                  <td>${p.total_kills ?? 0}</td>
                  <td>${p.games_played ?? 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });
  }

  // JOUEURS SANS EQUIPE
  if (soloScores.length) {
    html += `<div class="scoreboard-section-title" style="margin-top:2rem">👤 JOUEURS SANS ÉQUIPE</div>`;
    html += `<table class="data-table">
      <thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>Kills</th><th>Parties</th></tr></thead>
      <tbody>
        ${soloScores.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>
              ${s.avatar ? `<img src="${s.avatar}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px">` : ''}
              ${s.username}
            </td>
            <td><strong>${s.total_score}</strong></td>
            <td>${s.total_kills ?? 0}</td>
            <td>${s.games_played ?? 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  container.innerHTML = html;
}
// =====================================================
// INSCRITS
// =====================================================

async function loadInscrits() {
  const container = document.getElementById('tab-inscrits');
  const tournoi   = await getTournoiActif();
  if (!tournoi) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i>Aucun tournoi actif</div>'; return; }
  const inscrits = await fetchSupabase(`tournament_entries?tournament_id=eq.${tournoi.id}&order=created_at.asc`);
  if (!inscrits?.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i>Aucun inscrit</div>'; return; }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Joueur</th><th>Tracker ID</th><th>Inscrit le</th><th>Statut</th></tr></thead>
      <tbody>
        ${inscrits.map(e => `
          <tr>
            <td>${e.username || e.discord_id}</td>
            <td><code>${e.tracker_id || '—'}</code></td>
            <td>${formatDate(e.created_at)}</td>
            <td>${e.status || 'active'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// =====================================================
// OUTILS
// =====================================================

function loadOutils() {
  document.getElementById('tab-outils').innerHTML = `
    <div class="outils-grid">
      <div>
        <div class="outils-section-title">🔧 Actions manuelles</div>
        <div class="outils-actions">
          <button class="btn btn-primary" id="btn-leaderboard"><i class="fas fa-sync"></i> Forcer leaderboard</button>
          <button class="btn btn-orange"  id="btn-mvp"><i class="fas fa-star"></i> Poster MVP</button>
          <button class="btn btn-danger"  id="btn-reset"><i class="fas fa-redo"></i> Reset classement</button>
          <button class="btn btn-secondary" id="btn-create-channel"><i class="fas fa-hashtag"></i> Créer salon résultats</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('btn-leaderboard')?.addEventListener('click', () => callBotAPI('leaderboard', 'POST'));
  document.getElementById('btn-mvp')?.addEventListener('click', () => callBotAPI('mvp', 'POST'));
  document.getElementById('btn-create-channel')?.addEventListener('click', async () => {
    const result = await callBotAPI('channel/create', 'POST', { name: 'resultats-tournoi' });
    if (result?.success) setFeedback('✅ Salon créé sur Discord !');
    else setFeedback('❌ Erreur création salon');
  });
}

// =====================================================
// HELPERS
// =====================================================

async function creerTournoi() {
  const nom   = document.getElementById('t-nom').value.trim();
  const start = document.getElementById('t-start').value;
  const end   = document.getElementById('t-end').value;
  const max   = parseInt(document.getElementById('t-max').value) || 0;
  const phase = document.getElementById('t-phase').value.trim();
  const desc  = document.getElementById('t-desc').value.trim();
  const ppk   = parseInt(document.getElementById('t-ppk').value) || 1;
  const top1  = parseInt(document.getElementById('t-top1').value) || 10;
  const top2  = parseInt(document.getElementById('t-top2').value) || 7;
  const top3  = parseInt(document.getElementById('t-top3').value) || 5;
  const top4  = parseInt(document.getElementById('t-top4').value) || 3;
  const top5  = parseInt(document.getElementById('t-top5').value) || 1;

  if (!nom || !start || !end) return setFeedback('❌ Remplis tous les champs obligatoires.');
  setFeedback('Création en cours...');

  await insertSupabase('tournaments', {
    name           : nom,
    start_date     : start,
    end_date       : end,
    max_players    : max || null,
    phase          : phase || null,
    description    : desc || null,
    status         : 'active',
    points_per_kill: ppk,
    points_top1    : top1,
    points_top2    : top2,
    points_top3    : top3,
    points_top4    : top4,
    points_top5    : top5,
    created_at     : new Date().toISOString()
  });

  showCreateForm = false;
  setFeedback('✅ Tournoi créé !');
  loadTournoi();
}

async function terminerTournoi(id) {
  showConfirm({
    title: '🏁 Terminer', message: 'Es-tu sûr ?', confirmText: 'Terminer', cancelText: 'Annuler',
    onConfirm: async () => {
      await changerStatut(id, 'termine');
      await callBotAPI('tournament/results', 'POST', { tournament_id: id });
      setFeedback('✅ Terminé — résultats postés sur Discord !');
      loadTournoi();
    }
  });
}

async function annulerTournoi(id) {
  showConfirm({
    title: '❌ Annuler', message: 'Es-tu sûr ?', confirmText: 'Annuler le tournoi', cancelText: 'Retour',
    onConfirm: async () => { await changerStatut(id, 'annule'); setFeedback('✅ Annulé.'); loadTournoi(); }
  });
}

async function changerStatut(id, statut) {
  await updateSupabase(`tournaments?id=eq.${id}`, { status: statut });
  loadTournoi();
}

window.supprimerTournoi = async function(id, nom) {
  showConfirm({
    title: '🗑️ Supprimer', message: `Supprimer "${nom}" et toutes ses soumissions ?`, confirmText: 'Supprimer', cancelText: 'Annuler',
    onConfirm: async () => {
      await supabase.from('tournament_submissions').delete().eq('tournament_id', id);
      await supabase.from('tournament_scores').delete().eq('tournament_id', id);
      await supabase.from('tournament_entries').delete().eq('tournament_id', id);
      await deleteSupabase(`tournaments?id=eq.${id}`);
      loadTournoi();
    }
  });
};

async function getTournoiActif() {
  const tournois = await fetchSupabase('tournaments?status=eq.active&limit=1');
  return tournois?.[0] || null;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function setFeedback(msg) {
  const el = document.getElementById('tournament-feedback');
  if (el) el.textContent = msg;
}