import { fetchSupabase, insertSupabase, deleteSupabase } from '../api.js';
import { showToast } from '../ui/toast.js';
import { getActiveGuildId } from '../services/guildService.js';

let allRules  = [];
let editingId = null;

const TRIGGER_LABELS = {
  member_join        : 'Un membre rejoint',
  member_leave       : 'Un membre quitte',
  member_warn        : 'Un membre reçoit un warn',
  member_warns_reach : 'Membre atteint X warns',
  suggestion_approved: 'Suggestion approuvée',
  suggestion_rejected: 'Suggestion rejetée',
  ticket_open        : 'Ticket ouvert',
  ticket_close       : 'Ticket fermé',
  message_contains   : 'Message contient un mot',
  message_spam       : 'Spam détecté',
};

const ACTION_LABELS = {
  send_dm       : 'Envoyer un DM',
  add_role      : 'Ajouter un rôle',
  remove_role   : 'Retirer un rôle',
  kick_member   : 'Kick le membre',
  ban_member    : 'Ban le membre',
  mute_member   : 'Mute le membre',
  send_message  : 'Envoyer un message',
  delete_message: 'Supprimer le message',
  log_action    : 'Logger l\'action',
};

export async function initRuleBuilder() {
  await loadRules();
  initModal();
  initExport();
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────

async function loadRules() {
  const guildId = await getActiveGuildId();
  const rules = await fetchSupabase(`automation_rules?guild_id=eq.${guildId}&order=created_at.desc`);
  allRules = rules || [];
  renderRules();
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderRules() {
  const list = document.getElementById('rb-rules-list');
  if (!allRules.length) {
    list.innerHTML = `
      <div class="rb-empty">
        <i class="fas fa-robot"></i>
        <p>Aucune règle créée</p>
        <button class="btn btn-primary" onclick="document.getElementById('btn-new-rule').click()">
          <i class="fas fa-plus"></i> Créer ma première règle
        </button>
      </div>`;
    return;
  }

  list.innerHTML = allRules.map(rule => `
    <div class="rb-rule-card ${rule.enabled ? '' : 'disabled'}" id="rule-${rule.id}">
      <div class="rb-rule-icon"><i class="fas fa-bolt"></i></div>
      <div class="rb-rule-info">
        <div class="rb-rule-name">${rule.name}</div>
        <div class="rb-rule-desc">
          <span class="rb-chip trigger">${TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}</span>
          <i class="fas fa-arrow-right" style="font-size:9px;color:var(--text-muted)"></i>
          <span class="rb-chip action">${ACTION_LABELS[rule.action_type] || rule.action_type}</span>
        </div>
      </div>
      <div class="rb-rule-actions">
        <label class="rb-toggle" title="${rule.enabled ? 'Désactiver' : 'Activer'}">
          <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="toggleRule('${rule.id}', this.checked)">
          <span class="rb-toggle-slider"></span>
        </label>
        <button class="rb-btn-edit" onclick="editRule('${rule.id}')" title="Modifier">
          <i class="fas fa-pen"></i>
        </button>
        <button class="rb-btn-delete" onclick="deleteRule('${rule.id}', '${rule.name}')" title="Supprimer">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function initModal() {
  document.getElementById('btn-new-rule').addEventListener('click', () => openRuleModal(null));
  document.getElementById('rb-trigger-type').addEventListener('change', renderTriggerConfig);
  document.getElementById('rb-action-type').addEventListener('change', renderActionConfig);
  document.getElementById('rb-save-btn').addEventListener('click', saveRule);
}

window.openRuleModal = function(id) {
  editingId = id;
  const rule = id ? allRules.find(r => r.id === id) : null;

  document.getElementById('rb-modal-title').textContent = rule ? 'Modifier la règle' : 'Nouvelle règle';
  document.getElementById('rb-name').value = rule?.name || '';
  document.getElementById('rb-modal-error').style.display = 'none';

  const triggerSel = document.getElementById('rb-trigger-type');
  const actionSel  = document.getElementById('rb-action-type');
  triggerSel.value = rule?.trigger_type || '';
  actionSel.value  = rule?.action_type  || '';

  renderTriggerConfig(null, rule?.trigger_config || {});
  renderActionConfig(null,  rule?.action_config  || {});

  document.getElementById('rb-modal-overlay').style.display = 'block';
  document.getElementById('rb-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeRuleModal = function() {
  document.getElementById('rb-modal-overlay').style.display = 'none';
  document.getElementById('rb-modal').classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
};

window.editRule = function(id) { openRuleModal(id); };

// ─── TRIGGER CONFIG ───────────────────────────────────────────────────────────

function renderTriggerConfig(e, prefill = {}) {
  const type = document.getElementById('rb-trigger-type').value;
  const box  = document.getElementById('rb-trigger-config');

  const templates = {
    member_warns_reach: `
      <div class="form-group">
        <label class="form-label">NOMBRE DE WARNS</label>
        <input type="number" class="form-input" id="tc-warns-count" min="1" max="20" value="${prefill.count || 3}">
      </div>`,
    message_contains: `
      <div class="form-group">
        <label class="form-label">MOT OU PHRASE</label>
        <input type="text" class="form-input" id="tc-word" placeholder="ex: spam, discord.gg" value="${prefill.word || ''}">
      </div>`,
  };

  box.innerHTML = templates[type] || '';
}

function getTriggerConfig() {
  const type = document.getElementById('rb-trigger-type').value;
  if (type === 'member_warns_reach') return { count: parseInt(document.getElementById('tc-warns-count')?.value) || 3 };
  if (type === 'message_contains')   return { word: document.getElementById('tc-word')?.value?.trim() || '' };
  return {};
}

// ─── ACTION CONFIG ────────────────────────────────────────────────────────────

function renderActionConfig(e, prefill = {}) {
  const type = document.getElementById('rb-action-type').value;
  const box  = document.getElementById('rb-action-config');

  const templates = {
    send_dm: `
      <div class="form-group">
        <label class="form-label">MESSAGE DM</label>
        <textarea class="form-input" id="ac-dm-text" rows="3" placeholder="ex: Salut {username}, bienvenue !">${prefill.text || ''}</textarea>
        <div class="hint">Variables : {username} {server}</div>
      </div>`,
    send_message: `
      <div class="form-group">
        <label class="form-label">ID DU SALON</label>
        <input type="text" class="form-input" id="ac-channel-id" placeholder="ID du salon Discord" value="${prefill.channel_id || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">MESSAGE</label>
        <textarea class="form-input" id="ac-msg-text" rows="3" placeholder="ex: {username} vient de rejoindre !">${prefill.text || ''}</textarea>
        <div class="hint">Variables : {username} {server}</div>
      </div>`,
    add_role: `
      <div class="form-group">
        <label class="form-label">ID DU RÔLE</label>
        <input type="text" class="form-input" id="ac-role-id" placeholder="ID du rôle Discord" value="${prefill.role_id || ''}">
      </div>`,
    remove_role: `
      <div class="form-group">
        <label class="form-label">ID DU RÔLE</label>
        <input type="text" class="form-input" id="ac-role-id" placeholder="ID du rôle Discord" value="${prefill.role_id || ''}">
      </div>`,
    mute_member: `
      <div class="form-group">
        <label class="form-label">DURÉE (minutes)</label>
        <input type="number" class="form-input" id="ac-mute-duration" min="1" value="${prefill.duration || 10}">
      </div>`,
    kick_member: `
      <div class="form-group">
        <label class="form-label">RAISON</label>
        <input type="text" class="form-input" id="ac-reason" placeholder="ex: Règles violées" value="${prefill.reason || ''}">
      </div>`,
    ban_member: `
      <div class="form-group">
        <label class="form-label">RAISON</label>
        <input type="text" class="form-input" id="ac-reason" placeholder="ex: Règles violées" value="${prefill.reason || ''}">
      </div>`,
    log_action: `
      <div class="form-group">
        <label class="form-label">ID DU SALON LOGS</label>
        <input type="text" class="form-input" id="ac-log-channel" placeholder="ID du salon de logs" value="${prefill.channel_id || ''}">
      </div>`,
  };

  box.innerHTML = templates[type] || '';
}

function getActionConfig() {
  const type = document.getElementById('rb-action-type').value;
  const get  = id => document.getElementById(id)?.value?.trim() || '';
  if (type === 'send_dm')      return { text: get('ac-dm-text') };
  if (type === 'send_message') return { channel_id: get('ac-channel-id'), text: get('ac-msg-text') };
  if (type === 'add_role')     return { role_id: get('ac-role-id') };
  if (type === 'remove_role')  return { role_id: get('ac-role-id') };
  if (type === 'mute_member')  return { duration: parseInt(get('ac-mute-duration')) || 10 };
  if (type === 'kick_member')  return { reason: get('ac-reason') };
  if (type === 'ban_member')   return { reason: get('ac-reason') };
  if (type === 'log_action')   return { channel_id: get('ac-log-channel') };
  return {};
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

async function saveRule() {
  const guildId     = await getActiveGuildId();
  const name        = document.getElementById('rb-name').value.trim();
  const triggerType = document.getElementById('rb-trigger-type').value;
  const actionType  = document.getElementById('rb-action-type').value;
  const errorEl     = document.getElementById('rb-modal-error');
  const btn         = document.getElementById('rb-save-btn');

  errorEl.style.display = 'none';

  if (!name)        { showErr('Donne un nom à la règle.');  return; }
  if (!triggerType) { showErr('Choisis un déclencheur.');   return; }
  if (!actionType)  { showErr('Choisis une action.');       return; }

  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

  const payload = {
    guild_id      : guildId,
    name,
    enabled       : true,
    trigger_type  : triggerType,
    trigger_config: getTriggerConfig(),
    action_type   : actionType,
    action_config : getActionConfig(),
    updated_at    : new Date().toISOString(),
  };

  try {
    if (editingId) {
      await fetchSupabase(`automation_rules?id=eq.${editingId}`, 'PATCH', payload);
      showToast('✅ Règle mise à jour');
    } else {
      await insertSupabase('automation_rules', payload);
      showToast('✅ Règle créée');
    }
    closeRuleModal();
    await loadRules();
  } catch (err) {
    showErr('Erreur : ' + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
  }

  function showErr(msg) {
    errorEl.style.display = 'block';
    errorEl.textContent   = '❌ ' + msg;
    btn.disabled          = false;
    btn.innerHTML         = '<i class="fas fa-save"></i> Enregistrer';
  }
}

// ─── TOGGLE ───────────────────────────────────────────────────────────────────

window.toggleRule = async function(id, enabled) {
  await fetchSupabase(`automation_rules?id=eq.${id}`, 'PATCH', { enabled, updated_at: new Date().toISOString() });
  const rule = allRules.find(r => r.id === id);
  if (rule) {
    rule.enabled = enabled;
    document.getElementById(`rule-${id}`)?.classList.toggle('disabled', !enabled);
  }
  showToast(enabled ? '✅ Règle activée' : '⏸ Règle désactivée');
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

window.deleteRule = async function(id, name) {
  if (!confirm(`Supprimer la règle "${name}" ?`)) return;
  await deleteSupabase(`automation_rules?id=eq.${id}`);
  showToast('✅ Règle supprimée');
  await loadRules();
};

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────

function initExport() {

  document.getElementById('btn-export-rules').addEventListener('click', () => {
    if (!allRules.length) return showToast('❌ Aucune règle à exporter', 'error');
    const data = allRules.map(r => ({
      name          : r.name,
      enabled       : r.enabled,
      trigger_type  : r.trigger_type,
      trigger_config: r.trigger_config,
      action_type   : r.action_type,
      action_config : r.action_config,
    }));
    downloadJSON(data, `warstack-rules-${dateStamp()}.json`);
    showToast(`✅ ${data.length} règle(s) exportée(s)`);
  });

  document.getElementById('btn-import-rules').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const guildId = await getActiveGuildId();
    try {
      const text  = await file.text();
      const rules = JSON.parse(text);
      if (!Array.isArray(rules)) throw new Error('Format invalide');
      let imported = 0;
      for (const r of rules) {
        if (!r.name || !r.trigger_type || !r.action_type) continue;
        await insertSupabase('automation_rules', {
          guild_id      : guildId,
          name          : r.name,
          enabled       : r.enabled ?? true,
          trigger_type  : r.trigger_type,
          trigger_config: r.trigger_config || {},
          action_type   : r.action_type,
          action_config : r.action_config  || {},
          updated_at    : new Date().toISOString(),
        });
        imported++;
      }
      showToast(`✅ ${imported} règle(s) importée(s)`);
      await loadRules();
    } catch (err) {
      showToast('❌ Fichier invalide : ' + err.message, 'error');
    }
    e.target.value = '';
  });

  document.getElementById('btn-export-members').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const [players, xpRows] = await Promise.all([
      fetchSupabase('players?select=*&order=created_at.desc'),
      fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=discord_id`),
    ]);
    const memberIds = new Set((xpRows || []).map(x => x.discord_id));
    const data = (players || []).filter(p => memberIds.has(p.discord_id));
    if (!data?.length) return showToast('❌ Aucun membre', 'error');
    const rows = [
      ['Discord ID', 'Username', 'Pseudo BF6', 'Plateforme', 'Tracker ID', 'K/D', 'Kills', 'Wins', 'Win Rate', 'Date inscription'],
      ...data.map(p => [
        p.discord_id, p.username, p.pseudo_bf6 || '', p.platform || '',
        p.tracker_id || '', p.kd || '', p.kills || '', p.wins || '',
        p.winrate || '', fmtDate(p.created_at),
      ])
    ];
    downloadCSV(rows, `warstack-membres-${dateStamp()}.csv`);
    showToast(`✅ ${data.length} membres exportés`);
  });

  document.getElementById('btn-export-sanctions').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const data = await fetchSupabase(`sanctions?guild_id=eq.${guildId}&select=*&order=created_at.desc`);
    if (!data?.length) return showToast('❌ Aucune sanction', 'error');
    const rows = [
      ['Discord ID', 'Username', 'Type', 'Raison', 'Modérateur', 'Durée (min)', 'Active', 'Date'],
      ...data.map(s => [
        s.discord_id, s.username, s.type, s.reason || '',
        s.moderator_name || '', s.duration || '', s.active ? 'Oui' : 'Non', fmtDate(s.created_at),
      ])
    ];
    downloadCSV(rows, `warstack-sanctions-${dateStamp()}.csv`);
    showToast(`✅ ${data.length} sanctions exportées`);
  });

  document.getElementById('btn-export-suggestions').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const data = await fetchSupabase(`suggestions?guild_id=eq.${guildId}&select=*&order=created_at.desc`);
    if (!data?.length) return showToast('❌ Aucune suggestion', 'error');
    const rows = [
      ['ID', 'Username', 'Contenu', 'Statut', 'Votes +', 'Votes -', 'Note staff', 'Date'],
      ...data.map(s => [
        s.id, s.username, `"${(s.content || '').replace(/"/g, '""')}"`,
        s.status, s.votes_up || 0, s.votes_down || 0,
        `"${(s.staff_note || '').replace(/"/g, '""')}"`, fmtDate(s.created_at),
      ])
    ];
    downloadCSV(rows, `warstack-suggestions-${dateStamp()}.csv`);
    showToast(`✅ ${data.length} suggestions exportées`);
  });

  document.getElementById('btn-export-events').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const data = await fetchSupabase(`events?guild_id=eq.${guildId}&select=*&order=date.desc`);
    if (!data?.length) return showToast('❌ Aucun événement', 'error');
    const rows = [
      ['Titre', 'Description', 'Date', 'Heure', 'Places max', 'Statut', 'Check-in', 'Date création'],
      ...data.map(e => [
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.date, e.time, e.max_players || '',
        e.status, e.checkin_enabled ? 'Oui' : 'Non', fmtDate(e.created_at),
      ])
    ];
    downloadCSV(rows, `warstack-events-${dateStamp()}.csv`);
    showToast(`✅ ${data.length} événements exportés`);
  });

  document.getElementById('btn-export-tickets').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const data = await fetchSupabase(`tickets?guild_id=eq.${guildId}&select=*&order=created_at.desc`);
    if (!data?.length) return showToast('❌ Aucun ticket', 'error');
    const rows = [
      ['ID', 'Username', 'Type', 'Statut', 'Assigné à', 'Date ouverture', 'Date fermeture'],
      ...data.map(t => [
        t.id, t.username, t.type, t.status,
        t.assigned_to || '', fmtDate(t.created_at), fmtDate(t.closed_at),
      ])
    ];
    downloadCSV(rows, `warstack-tickets-${dateStamp()}.csv`);
    showToast(`✅ ${data.length} tickets exportés`);
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }

function fmtDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('fr-FR');
}