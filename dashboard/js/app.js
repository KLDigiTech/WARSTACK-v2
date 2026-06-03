// app.js — Router + init dashboard

import { initModal }          from './ui/modal.js';
import { $ }                  from './utils/dom.js';
import { getBotStatus }       from './services/botService.js';
import { getUserPermissions } from './services/permissionService.js';
import { loadEmojis, attachEmojiPicker } from './components/emojiPicker.js';
import { initTooltips } from './components/tooltip.js';

initModal();

// CLOCK
function updateClock() {
  const now = new Date();
  $('#current-time').textContent =
    `${now.toLocaleTimeString('fr-FR')} — ${now.toLocaleDateString('fr-FR')}`;
}
setInterval(updateClock, 1000);
updateClock();

// BOT STATUS
async function checkBotStatus() {
  try {
    const data = await getBotStatus();
    const dot   = $('#status-dot');
    const label = $('#status-label');
    if (data?.status === 'online') {
      dot?.classList.add('online');
      label.textContent = 'BOT ONLINE';
    } else {
      dot?.classList.remove('online');
      label.textContent = 'BOT OFFLINE';
    }
  } catch (err) {
    console.error('Bot status error:', err);
  }
}
checkBotStatus();
setInterval(checkBotStatus, 30000);

// SECTIONS
const sections = {
  overview:    () => import('./sections/overview.js').then(m => m.initOverview()),
  players:     () => import('./sections/players.js').then(m => m.initPlayers()),
  tournament:  () => import('./sections/tournament.js').then(m => m.initTournament()),
  welcome:     () => import('./sections/welcome.js').then(m => m.initWelcome()),
  roles:       () => import('./sections/roles.js').then(m => m.initRoles()),
  birthdays:   () => import('./sections/birthdays.js').then(m => m.initBirthdays()),
  suggestions: () => import('./sections/suggestions.js').then(m => m.initSuggestions()),
  events:      () => import('./sections/events.js').then(m => m.initEvents()),
  moderation:  () => import('./sections/moderation.js').then(m => m.initModeration()),
  automod:     () => import('./sections/automod.js').then(m => m.initAutomod()),
  tickets:     () => import('./sections/tickets.js').then(m => m.initTickets()),
  logs:        () => import('./sections/logs.js').then(m => m.initLogs()),
  messages:    () => import('./sections/messages.js').then(m => m.initMessages()),
  reactions:   () => import('./sections/reactions.js').then(m => m.initReactions()),
  channels:    () => import('./sections/channels.js').then(m => m.initChannels()),
  access:      () => import('./sections/access.js').then(m => m.initAccess()),
  settings:    () => import('./sections/settings.js').then(m => m.initSettings()),
  'ocr-test':  () => import('./sections/ocr-test.js').then(m => m.initOcrTest()),
  origine:     () => import('./sections/origine.js').then(m => m.initOrigine()),
};

const PUBLIC_SECTIONS = [
  'overview', 'players', 'tournament', 'welcome', 'roles',
  'birthdays', 'suggestions', 'events', 'origine',
  'messages', 'reactions', 'channels', 'ocr-test',
];

const RESTRICTED_SECTIONS = [
  'moderation', 'automod', 'tickets', 'logs', 'access', 'settings',
];

// ROUTER
async function navigate(section) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const item = document.querySelector(`[data-section="${section}"]`);
  if (!item) return;
  item.classList.add('active');
  $('#section-title').textContent = item.querySelector('span')?.textContent || '';

  const content = $('#section-content');
  content.innerHTML = '<div class="loading-screen">CHARGEMENT...</div>';

  try {
    const res  = await fetch(`/templates/${section}.html`);
    const html = await res.text();
    content.innerHTML = html;
  } catch {
    content.innerHTML = '';
  }

  if (sections[section]) await sections[section]();

  // Attacher emoji picker sur tous les textareas de la section
  attachAllEmojiPickers();

  window.location.hash = section;
}

// EMOJI PICKER — attacher sur tous les textareas visibles
function attachAllEmojiPickers() {
  document.querySelectorAll('textarea.form-textarea').forEach(ta => {
    if (ta.dataset.emojiAttached) return; // éviter les doublons
    ta.dataset.emojiAttached = '1';
    attachEmojiPicker(ta.id || generateId(ta));
  });
}

function generateId(el) {
  const id = 'ta-' + Math.random().toString(36).slice(2, 7);
  el.id = id;
  return id;
}

// PERMISSIONS
async function applyPermissions() {
  try {
    const permissions = await getUserPermissions();

    document.querySelectorAll('.nav-item').forEach(item => {
      const section = item.dataset.section;
      if (!section)                          { item.style.display = 'flex'; return; }
      if (PUBLIC_SECTIONS.includes(section)) { item.style.display = 'flex'; return; }
      if (!permissions || permissions.length === 0) {
        item.style.display = 'flex';
      } else {
        item.style.display = permissions.includes(section) ? 'flex' : 'none';
      }
    });
  } catch {
    document.querySelectorAll('.nav-item').forEach(i => i.style.display = 'flex');
  }
}

// NAV EVENTS
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    if (!item.dataset.section) return;
    e.preventDefault();
    await navigate(item.dataset.section);
  });
});

// INIT
async function initDashboard() {
  await applyPermissions();
  await loadEmojis(); // charger les emojis custom du serveur
  const initial = window.location.hash?.replace('#', '') || 'overview';
  await navigate(initial);
  initTooltips();
}

initDashboard();