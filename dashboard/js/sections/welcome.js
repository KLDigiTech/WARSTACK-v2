import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI }                          from '../api.js';
import { showToast }                           from '../ui/toast.js';

export async function initWelcome() {

  const [configs, channelsData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
  ]);

  // ── Salons ──────────────────────────────────────────────
  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('welcome-channel').innerHTML = chOpts;
  document.getElementById('leave-channel').innerHTML   = chOpts;

  // ── Config sauvegardée ──────────────────────────────────
  document.getElementById('welcome-channel').value = getConfig(configs, 'welcome_channel') || '';
  document.getElementById('leave-channel').value   = getConfig(configs, 'leave_channel')   || '';
  document.getElementById('welcome-message').value = getConfig(configs, 'welcome_message') || '';
  document.getElementById('leave-message').value   = getConfig(configs, 'leave_message')   || '';
  document.getElementById('dm-message').value      = getConfig(configs, 'dm_message')      || '';

  const dmEnabled = getConfig(configs, 'enable_dm') === 'true';
  document.getElementById('enable-dm').checked      = dmEnabled;
  document.getElementById('dm-group').style.display = dmEnabled ? 'block' : 'none';

  // ── Toggle réglages avancés ─────────────────────────────
  const toggle = document.getElementById('advanced-toggle');
  const body   = document.getElementById('advanced-body');
  if (toggle && body) {
    // Si un réglage avancé est déjà configuré, ouvrir par défaut
    const hasAdvanced = getConfig(configs, 'leave_channel')
                     || getConfig(configs, 'enable_dm') === 'true';
    if (hasAdvanced) {
      body.style.display = 'block';
      toggle.classList.add('open');
    }
    toggle.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      toggle.classList.toggle('open', !isOpen);
    });
  }

  // ── Toggle DM ───────────────────────────────────────────
  document.getElementById('enable-dm').addEventListener('change', e => {
    document.getElementById('dm-group').style.display = e.target.checked ? 'block' : 'none';
  });

  // ── Variables : gérées globalement par components/varDropdown.js ──
  // ── Lien vers la page Rôles : géré globalement par app.js (.nav-item-inline) ──

  // ── Switch preview bienvenue / départ ────────────────────
  const previewTabs = document.querySelectorAll('.panel-tabs .tab-btn[data-preview]');
  previewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      previewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.preview;
      document.getElementById('preview-content-welcome').classList.toggle('hidden', target !== 'welcome');
      document.getElementById('preview-content-leave').classList.toggle('hidden', target !== 'leave');
    });
  });

  // ── Preview live ────────────────────────────────────────
  document.getElementById('welcome-message').addEventListener('input', updatePreviews);
  document.getElementById('leave-message').addEventListener('input', updatePreviews);
  updatePreviews();
  updateClock();
  setInterval(updateClock, 1000);

  // ── Sauvegarder ─────────────────────────────────────────
  document.getElementById('save-welcome').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('welcome_channel', document.getElementById('welcome-channel').value),
      saveConfig('leave_channel',   document.getElementById('leave-channel').value),
      saveConfig('welcome_message', document.getElementById('welcome-message').value),
      saveConfig('leave_message',   document.getElementById('leave-message').value),
      saveConfig('enable_dm',       String(document.getElementById('enable-dm').checked)),
      saveConfig('dm_message',      document.getElementById('dm-message').value),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  // ── Tester ──────────────────────────────────────────────
  document.getElementById('btn-test-welcome').addEventListener('click', async () => {
    const channel_id = document.getElementById('welcome-channel').value;
    const message    = document.getElementById('welcome-message').value;
    const dm_enabled = document.getElementById('enable-dm').checked;
    const dm_message = dm_enabled ? document.getElementById('dm-message').value : null;

    if (!channel_id) return showToast('❌ Choisis un salon d\'abord', 'error');

    const result = await callBotAPI('welcome/test', 'POST', { channel_id, message, dm_message });
    if (result?.success) showToast('✅ Message de test envoyé !');
    else showToast('❌ Erreur lors du test', 'error');
  });
}

function fillVars(str) {
  return str
    .replace(/{mention}/g,     '<span class="dp-mention">@Kevin</span>')
    .replace(/{user}/g,        'Kevin')
    .replace(/{server}/g,      'WARSTACK')
    .replace(/{membercount}/g, '152');
}

function updatePreviews() {
  const welcomeMsg = document.getElementById('welcome-message')?.value || 'Bienvenue {mention} sur {server} ! 🎉';
  const leaveMsg   = document.getElementById('leave-message')?.value   || '**{user}** a quitté le serveur.';
  const wEl = document.getElementById('dp-welcome-text');
  const lEl = document.getElementById('dp-leave-text');
  if (wEl) wEl.innerHTML = fillVars(welcomeMsg);
  if (lEl) lEl.innerHTML = fillVars(leaveMsg);
}

function updateClock() {
  const now = new Date();
  const t   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const el1 = document.getElementById('dp-time-val');
  const el2 = document.getElementById('dp-time-val-2');
  if (el1) el1.textContent = t;
  if (el2) el2.textContent = t;
}