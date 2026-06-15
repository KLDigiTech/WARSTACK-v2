import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';

let currentFilter    = 'all';
let currentSuggestion = null;

export async function initSuggestions() {

  const [configs, channelsData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
  ]);

  // ── Salons ──────────────────────────────────────────────
  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('suggestions-channel').innerHTML = chOpts;
  document.getElementById('suggestions-logs').innerHTML    = chOpts;

  // ── Config sauvegardée ──────────────────────────────────
  document.getElementById('suggestions-enabled').checked   = getConfig(configs, 'suggestions_enabled') === 'true';
  document.getElementById('suggestions-channel').value     = getConfig(configs, 'suggestions_channel') || '';
  document.getElementById('suggestions-logs').value        = getConfig(configs, 'suggestions_logs')    || '';
  document.getElementById('suggestions-reactions').checked = getConfig(configs, 'suggestions_reactions') !== 'false';
  document.getElementById('suggestions-threads').checked   = getConfig(configs, 'suggestions_threads') === 'true';
  document.getElementById('suggestions-anonymous').checked = getConfig(configs, 'suggestions_anonymous') === 'true';

  // ── Sauvegarder ─────────────────────────────────────────
  document.getElementById('btn-save-suggestions').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('suggestions_enabled',   String(document.getElementById('suggestions-enabled').checked)),
      saveConfig('suggestions_channel',   document.getElementById('suggestions-channel').value),
      saveConfig('suggestions_logs',      document.getElementById('suggestions-logs').value),
      saveConfig('suggestions_reactions', String(document.getElementById('suggestions-reactions').checked)),
      saveConfig('suggestions_threads',   String(document.getElementById('suggestions-threads').checked)),
      saveConfig('suggestions_anonymous', String(document.getElementById('suggestions-anonymous').checked)),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  // ── Filtres ─────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadSuggestions();
    });
  });

  // ── Modal ───────────────────────────────────────────────
  document.getElementById('modal-close').addEventListener('click',  closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save-note').addEventListener('click', saveStaffNote);

  // ── Charger ─────────────────────────────────────────────
  await loadSuggestions();
  await loadStats();
  await loadLeaderboard();
}

// ── Charger suggestions ──────────────────────────────────────────────────────

async function loadSuggestions() {
  const container = document.getElementById('suggestions-list');
  container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Chargement...</div>`;

  const guildId = await getActiveGuildId();
  let url = `suggestions?guild_id=eq.${guildId}&select=*&order=created_at.desc`;
  if (currentFilter !== 'all') url += `&status=eq.${currentFilter}`;

  const data = await fetchSupabase(url);
  const list = data || [];

  if (!list.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune suggestion.</div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="suggestion-card" data-id="${s.id}">
      <div class="suggestion-header">
        <div class="suggestion-meta">
          <span class="suggestion-author">${s.username || 'Anonyme'}</span>
          <span class="suggestion-date">${new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        <span class="suggestion-status status-${s.status}">${statusLabel(s.status)}</span>
      </div>
      <div class="suggestion-content">${s.content}</div>
      <div class="suggestion-footer">
        <div class="suggestion-votes">
          <span class="vote-up">👍 ${s.votes_up}</span>
          <span class="vote-down">👎 ${s.votes_down}</span>
        </div>
        <div class="suggestion-actions">
          <button class="btn btn-sm sug-btn" data-id="${s.id}" data-action="reviewing" title="En analyse">🔵</button>
          <button class="btn btn-sm sug-btn" data-id="${s.id}" data-action="accepted"  title="Accepter">🟢</button>
          <button class="btn btn-sm sug-btn" data-id="${s.id}" data-action="refused"   title="Refuser">🔴</button>
          <button class="btn btn-sm sug-btn" data-id="${s.id}" data-action="implemented" title="Implémenter">⚫</button>
          <button class="btn btn-sm sug-btn" data-id="${s.id}" data-action="note"      title="Note staff">📝</button>
          <button class="btn btn-danger btn-sm sug-btn" data-id="${s.id}" data-action="delete" title="Supprimer">🗑️</button>
        </div>
      </div>
      ${s.staff_note ? `<div class="staff-note">📝 ${s.staff_note}</div>` : ''}
    </div>
  `).join('');

  // Events actions
  document.querySelectorAll('.sug-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.id, btn.dataset.action));
  });
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function handleAction(id, action) {
  if (action === 'delete') {
    if (!confirm('Supprimer cette suggestion ?')) return;
    await fetchSupabase(`suggestions?id=eq.${id}`, 'DELETE');
    showToast('✅ Suggestion supprimée');
    await loadSuggestions();
    await loadStats();
    return;
  }

  if (action === 'note') {
    currentSuggestion = id;
    document.getElementById('modal-staff-note').style.display = 'flex';
    return;
  }

  // Changer statut
  await fetchSupabase(`suggestions?id=eq.${id}`, 'PATCH', { status: action });

  // Notifier le bot pour éditer le message Discord
  await callBotAPI('suggestion/status', 'POST', { suggestion_id: id, status: action });

  showToast(`✅ Statut mis à jour`);
  await loadSuggestions();
  await loadStats();
}

// ── Modal note staff ─────────────────────────────────────────────────────────

function closeModal() {
  document.getElementById('modal-staff-note').style.display = 'none';
  document.getElementById('staff-note-input').value = '';
  currentSuggestion = null;
}

async function saveStaffNote() {
  const note = document.getElementById('staff-note-input').value.trim();
  if (!note || !currentSuggestion) return;
  await fetchSupabase(`suggestions?id=eq.${currentSuggestion}`, 'PATCH', { staff_note: note });
  showToast('✅ Note sauvegardée');
  closeModal();
  await loadSuggestions();
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`suggestions?guild_id=eq.${guildId}&select=status`);
  const list = data || [];
  document.getElementById('stat-total').textContent       = list.length;
  document.getElementById('stat-accepted').textContent    = list.filter(s => s.status === 'accepted').length;
  document.getElementById('stat-refused').textContent     = list.filter(s => s.status === 'refused').length;
  document.getElementById('stat-implemented').textContent = list.filter(s => s.status === 'implemented').length;
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

async function loadLeaderboard() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`suggestions?guild_id=eq.${guildId}&select=discord_id,username`);
  const list = data || [];

  const counts = {};
  list.forEach(s => {
    if (!counts[s.discord_id]) counts[s.discord_id] = { username: s.username, count: 0 };
    counts[s.discord_id].count++;
  });

  const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const el = document.getElementById('suggestions-leaderboard');
  if (!sorted.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune donnée.</div>`;
    return;
  }

  el.innerHTML = sorted.map((u, i) => `
    <div class="birthday-row">
      <div class="birthday-info">
        <span style="font-size:1.1rem">${medals[i]}</span>
        <span class="birthday-name">${u.username}</span>
      </div>
      <span class="birthday-date">${u.count} suggestion${u.count > 1 ? 's' : ''}</span>
    </div>
  `).join('');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status) {
  const map = {
    pending    : '🟡 En attente',
    reviewing  : '🔵 En analyse',
    accepted   : '🟢 Acceptée',
    refused    : '🔴 Refusée',
    implemented: '⚫ Implémentée',
  };
  return map[status] || status;
}