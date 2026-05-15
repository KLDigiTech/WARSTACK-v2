import { fetchSupabase, updateSupabase, insertSupabase, deleteSupabase, callBotAPI } from '../api.js';
import { showConfirm } from '../ui/confirm.js';

let showCreateForm = false;

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

async function loadTournoi() {
  const container = document.getElementById('tab-tournoi');
  container.innerHTML = '<p>Chargement...</p>';

  const tournois = await fetchSupabase('tournaments?order=created_at.desc&limit=20');
  const actifs   = tournois?.filter(t => t.status === 'active') || [];
  const archives = tournois?.filter(t => t.status !== 'active') || [];

  let html = '';

  // BOUTON NOUVEAU TOURNOI — toujours visible
  html += `
    <div class="tournament-topbar">
      <button class="btn btn-primary" id="btn-toggle-create">
        <i class="fas fa-plus"></i> Nouveau tournoi
      </button>
    </div>
  `;

  // FORMULAIRE CRÉATION — togglable
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

  // TOURNOIS ACTIFS
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

  // HISTORIQUE
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

  // EVENTS
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

function loadOutils() {
  document.getElementById('tab-outils').innerHTML = `
    <div class="outils-grid">
      <div>
        <div class="outils-section-title">🔧 Actions manuelles</div>
        <div class="outils-actions">
          <button class="btn btn-primary" id="btn-leaderboard"><i class="fas fa-sync"></i> Forcer leaderboard</button>
          <button class="btn btn-orange"  id="btn-mvp"><i class="fas fa-star"></i> Poster MVP</button>
          <button class="btn btn-danger"  id="btn-reset"><i class="fas fa-redo"></i> Reset classement</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('btn-leaderboard')?.addEventListener('click', () => callBotAPI('leaderboard', 'POST'));
  document.getElementById('btn-mvp')?.addEventListener('click',         () => callBotAPI('mvp', 'POST'));
}

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

async function loadSoumissions() {
  const container = document.getElementById('tab-soumissions');
  const tournoi   = await getTournoiActif();
  if (!tournoi) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i>Aucun tournoi actif</div>'; return; }
  const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${tournoi.id}&order=submitted_at.desc`);
  if (!subs?.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-image"></i>Aucune soumission</div>'; return; }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Joueur</th><th>K/D</th><th>Kills</th><th>Deaths</th><th>Score</th><th>Statut</th><th>Screenshot</th></tr></thead>
      <tbody>
        ${subs.map(s => `
          <tr>
            <td>${s.discord_id}</td>
            <td>${s.kd ?? '—'}</td>
            <td>${s.kills ?? '—'}</td>
            <td>${s.deaths ?? '—'}</td>
            <td>${s.score ?? '—'}</td>
            <td>${s.status}</td>
            <td><a href="${s.image_url}" target="_blank" class="btn btn-sm btn-secondary">Voir</a></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadScoreboard() {
  const container = document.getElementById('tab-scoreboard');
  const tournoi   = await getTournoiActif();
  if (!tournoi) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i>Aucun tournoi actif</div>'; return; }
  const scores = await fetchSupabase(`tournament_scores?tournament_id=eq.${tournoi.id}&order=score.desc`);
  if (!scores?.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i>Aucun score</div>'; return; }
  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>K/D</th></tr></thead>
      <tbody>
        ${scores.map((s, i) => `
          <tr>
            <td>${medals[i] || i + 1}</td>
            <td>${s.discord_id}</td>
            <td><strong>${s.score}</strong></td>
            <td>${s.kd ?? '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function creerTournoi() {
  const nom   = document.getElementById('t-nom').value.trim();
  const start = document.getElementById('t-start').value;
  const end   = document.getElementById('t-end').value;
  const max   = parseInt(document.getElementById('t-max').value) || 0;
  const phase = document.getElementById('t-phase').value.trim();
  const desc  = document.getElementById('t-desc').value.trim();
  if (!nom || !start || !end) return setFeedback('❌ Remplis tous les champs obligatoires.');
  setFeedback('Création en cours...');
  await insertSupabase('tournaments', {
    name        : nom,
    start_date  : start,
    end_date    : end,
    max_players : max || null,
    phase       : phase || null,
    description : desc || null,
    status      : 'active',
    created_at  : new Date().toISOString()
  });
  showCreateForm = false;
  setFeedback('✅ Tournoi créé !');
  loadTournoi();
}

async function terminerTournoi(id) {
  showConfirm({
    title: '🏁 Terminer', message: 'Es-tu sûr ?', confirmText: 'Terminer', cancelText: 'Annuler',
    onConfirm: async () => { await changerStatut(id, 'termine'); setFeedback('✅ Terminé.'); loadTournoi(); }
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
    title: '🗑️ Supprimer', message: `Supprimer "${nom}" ?`, confirmText: 'Supprimer', cancelText: 'Annuler',
    onConfirm: async () => { await deleteSupabase(`tournaments?id=eq.${id}`); loadTournoi(); }
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