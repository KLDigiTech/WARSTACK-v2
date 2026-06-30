import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI }                          from '../api.js';
import { showToast }                           from '../ui/toast.js';

let allRoles      = [];
let selectedRoles = [];

export async function initRoles() {

  const [configs, rolesData, channelsData] = await Promise.all([
    loadConfigs(),
    callBotAPI('roles'),
    callBotAPI('channels'),
  ]);

  allRoles = rolesData?.roles || [];

  // ── Compteur membres — salons vocaux ────────────────────
  const voiceChannels = (channelsData?.channels || []).filter(c => c.type === 'voice');
  const vcOpts = `<option value="">Créer un nouveau salon</option>` +
    voiceChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('counter-channel').innerHTML = vcOpts;

  // ── Config sauvegardée ──────────────────────────────────
  const savedRoles = getConfig(configs, 'autoroles');
  selectedRoles    = savedRoles ? JSON.parse(savedRoles) : [];

  const ignoreBots    = getConfig(configs, 'autorole_ignore_bots') !== 'false';
  const delay         = getConfig(configs, 'autorole_delay') || '0';
  const dmEnabled     = getConfig(configs, 'autorole_dm') === 'true';
  const dmMsg         = getConfig(configs, 'autorole_dm_message') || '';
  const counterOn     = getConfig(configs, 'counter_enabled') === 'true';
  const counterFmt    = getConfig(configs, 'counter_format') || '👥 Membres : {count}';
  const counterCh     = getConfig(configs, 'counter_channel') || '';

  document.getElementById('ignore-bots').checked    = ignoreBots;
  document.getElementById('autorole-dm').checked    = dmEnabled;
  document.getElementById('autorole-dm-group').style.display = dmEnabled ? 'block' : 'none';
  document.getElementById('autorole-dm-message').value = dmMsg;
  document.getElementById('enable-counter').checked  = counterOn;
  document.getElementById('counter-group').style.display = counterOn ? 'block' : 'none';
  document.getElementById('counter-format').value    = counterFmt;

  // ── Réglages avancés ────────────────────────────────────
  const rolesToggle = document.getElementById('roles-advanced-toggle');
  const rolesBody   = document.getElementById('roles-advanced-body');
  if (rolesToggle && rolesBody) {
    const hasAdvanced = !ignoreBots || dmEnabled || getConfig(configs, 'autorole_delay');
    if (hasAdvanced) {
      rolesBody.style.display = 'block';
      rolesToggle.classList.add('open');
    }
    rolesToggle.addEventListener('click', () => {
      const isOpen = rolesBody.style.display !== 'none';
      rolesBody.style.display = isOpen ? 'none' : 'block';
      rolesToggle.classList.toggle('open', !isOpen);
    });
  }
  document.getElementById('counter-channel').value   = counterCh;

  // Délai radio
  const delayRadio = document.querySelector(`input[name="autorole-delay"][value="${delay}"]`);
  if (delayRadio) delayRadio.checked = true;

  // ── Render rôles sélectionnés ───────────────────────────
  renderSelectedRoles();

  // ── Ajouter un rôle ─────────────────────────────────────
  document.getElementById('btn-add-autorole').addEventListener('click', () => {
    const select = document.createElement('select');
    select.className = 'form-select autorole-select';
    select.innerHTML = `<option value="">Choisir un rôle...</option>` +
      allRoles.map(r => `<option value="${r.id}" style="color:${r.color}">${r.name}</option>`).join('');

    select.addEventListener('change', () => {
      const id   = select.value;
      const role = allRoles.find(r => r.id === id);
      if (!role) return;
      if (selectedRoles.find(r => r.id === id)) {
        showToast('Ce rôle est déjà dans la liste', 'error');
        return;
      }
      selectedRoles.push({ id: role.id, name: role.name, color: role.color });
      renderSelectedRoles();
      updatePreview();
    });

    document.getElementById('autoroles-list').appendChild(select);
  });

  // ── Toggles ─────────────────────────────────────────────
  document.getElementById('autorole-dm').addEventListener('change', e => {
    document.getElementById('autorole-dm-group').style.display = e.target.checked ? 'block' : 'none';
    updatePreview();
  });

  document.getElementById('enable-counter').addEventListener('change', e => {
    document.getElementById('counter-group').style.display = e.target.checked ? 'block' : 'none';
  });

  // ── Preview live ────────────────────────────────────────
  updatePreview();

  // ── Sauvegarder ─────────────────────────────────────────
  document.getElementById('btn-save-roles').addEventListener('click', async () => {
    const delay = document.querySelector('input[name="autorole-delay"]:checked')?.value || '0';

    await Promise.all([
      saveConfig('autoroles',              JSON.stringify(selectedRoles)),
      saveConfig('autorole_ignore_bots',   String(document.getElementById('ignore-bots').checked)),
      saveConfig('autorole_delay',         delay),
      saveConfig('autorole_dm',            String(document.getElementById('autorole-dm').checked)),
      saveConfig('autorole_dm_message',    document.getElementById('autorole-dm-message').value),
      saveConfig('counter_enabled',        String(document.getElementById('enable-counter').checked)),
      saveConfig('counter_format',         document.getElementById('counter-format').value),
      saveConfig('counter_channel',        document.getElementById('counter-channel').value),
    ]);

    showToast('✅ Configuration sauvegardée !');
  });

  // ── Tester ──────────────────────────────────────────────
  document.getElementById('btn-test-autorole').addEventListener('click', async () => {
    if (!selectedRoles.length) return showToast('❌ Aucun rôle configuré', 'error');
    const result = await callBotAPI('autorole/test', 'POST', {
      role_ids  : selectedRoles.map(r => r.id),
      dm_enabled: document.getElementById('autorole-dm').checked,
      dm_message: document.getElementById('autorole-dm-message').value,
    });
    if (result?.success) showToast('✅ Test effectué !');
    else showToast('❌ Erreur lors du test', 'error');
  });
}

// ── Render rôles sélectionnés ───────────────────────────────────────────────

function renderSelectedRoles() {
  const container = document.getElementById('autoroles-list');
  container.innerHTML = '';

  if (!selectedRoles.length) {
    container.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted)">Aucun rôle configuré.</div>`;
    return;
  }

  selectedRoles.forEach((role, i) => {
    const row = document.createElement('div');
    row.className = 'autorole-row';
    row.innerHTML = `
      <span class="autorole-dot" style="background:${role.color || '#888'}"></span>
      <span class="autorole-name">@${role.name}</span>
      <button class="btn btn-danger btn-sm" data-index="${i}">
        <i class="fas fa-times"></i>
      </button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      selectedRoles.splice(i, 1);
      renderSelectedRoles();
      updatePreview();
    });
    container.appendChild(row);
  });
}

// ── Preview ─────────────────────────────────────────────────────────────────

function updatePreview() {
  const stepsEl  = document.getElementById('rp-roles-steps');
  const dmStepEl = document.getElementById('rp-dm-step');

  stepsEl.innerHTML = selectedRoles.length
    ? selectedRoles.map(r => `
        <div class="rp-step">
          <div class="rp-icon">🎭</div>
          <div class="rp-text">Rôle <strong style="color:${r.color || 'var(--green)'}">@${r.name}</strong> attribué</div>
        </div>
        <div class="rp-arrow">↓</div>
      `).join('')
    : `<div class="rp-step"><div class="rp-icon">⚠️</div><div class="rp-text" style="color:var(--text-muted)">Aucun rôle configuré</div></div><div class="rp-arrow">↓</div>`;

  dmStepEl.style.display = document.getElementById('autorole-dm').checked ? 'flex' : 'none';
}