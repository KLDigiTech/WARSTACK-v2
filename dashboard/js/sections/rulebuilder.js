import { fetchSupabase, insertSupabase, deleteSupabase } from '../api.js';
import { showToast } from '../ui/toast.js';
import { GUILD_ID } from '../config.js';

let allRules   = [];
let editingId  = null;

const TRIGGER_LABELS = {
  member_join       : 'Un membre rejoint',
  member_leave      : 'Un membre quitte',
  member_warn       : 'Un membre reçoit un warn',
  member_warns_reach: 'Membre atteint X warns',
  suggestion_approved: 'Suggestion approuvée',
  suggestion_rejected: 'Suggestion rejetée',
  ticket_open       : 'Ticket ouvert',
  ticket_close      : 'Ticket fermé',
  message_contains  : 'Message contient un mot',
  message_spam      : 'Spam détecté',
};

const ACTION_LABELS = {
  send_dm      : 'Envoyer un DM',
  add_role     : 'Ajouter un rôle',
  remove_role  : 'Retirer un rôle',
  kick_member  : 'Kick le membre',
  ban_member   : 'Ban le membre',
  mute_member  : 'Mute le membre',
  send_message : 'Envoyer un message',
  delete_message: 'Supprimer le message',
  log_action   : 'Logger l\'action',
};

export async function initRuleBuilder() {
  await loadRules();
  initModal();
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────

async function loadRules() {
  const rules = await fetchSupabase(`automation_rules?guild_id=eq.${GUILD_ID}&order=created_at.desc`);
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
  renderActionConfig(null, rule?.action_config   || {});

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
  if (type === 'member_warns_reach') {
    return { count: parseInt(document.getElementById('tc-warns-count')?.value) || 3 };
  }
  if (type === 'message_contains') {
    return { word: document.getElementById('tc-word')?.value?.trim() || '' };
  }
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
  if (type === 'send_dm')       return { text: get('ac-dm-text') };
  if (type === 'send_message')  return { channel_id: get('ac-channel-id'), text: get('ac-msg-text') };
  if (type === 'add_role')      return { role_id: get('ac-role-id') };
  if (type === 'remove_role')   return { role_id: get('ac-role-id') };
  if (type === 'mute_member')   return { duration: parseInt(get('ac-mute-duration')) || 10 };
  if (type === 'kick_member')   return { reason: get('ac-reason') };
  if (type === 'ban_member')    return { reason: get('ac-reason') };
  if (type === 'log_action')    return { channel_id: get('ac-log-channel') };
  return {};
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

async function saveRule() {
  const name        = document.getElementById('rb-name').value.trim();
  const triggerType = document.getElementById('rb-trigger-type').value;
  const actionType  = document.getElementById('rb-action-type').value;
  const errorEl     = document.getElementById('rb-modal-error');

  errorEl.style.display = 'none';

  if (!name)        { showError('Donne un nom à la règle.'); return; }
  if (!triggerType) { showError('Choisis un déclencheur.'); return; }
  if (!actionType)  { showError('Choisis une action.'); return; }

  const btn = document.getElementById('rb-save-btn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

  const payload = {
    guild_id       : GUILD_ID,
    name           : name,
    enabled        : true,
    trigger_type   : triggerType,
    trigger_config : getTriggerConfig(),
    action_type    : actionType,
    action_config  : getActionConfig(),
    updated_at     : new Date().toISOString(),
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
    showError('Erreur : ' + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
  }

  function showError(msg) {
    errorEl.style.display  = 'block';
    errorEl.textContent    = '❌ ' + msg;
    btn.disabled           = false;
    btn.innerHTML          = '<i class="fas fa-save"></i> Enregistrer';
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