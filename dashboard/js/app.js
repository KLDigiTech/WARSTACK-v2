// dashboard/js/app.js — FICHIER COMPLET

import { initModal }          from './ui/modal.js';
import { $ }                  from './utils/dom.js';
import { getBotStatus }       from './services/botService.js';
import { getUserPermissions } from './services/permissionService.js';
import { loadEmojis, attachEmojiPicker } from './components/emojiPicker.js';
import { initTooltips }       from './components/tooltip.js';
import { initNotifications }  from './components/notifications.js';
import { loadConfigs, getConfig } from './services/configService.js';

initModal();

async function preloadTheme() {
  try {
    const configs = await loadConfigs();
    const root    = document.documentElement;

    const savedTokens = getConfig(configs, 'theme_tokens');
    if (savedTokens) {
      const tokens = JSON.parse(savedTokens);
      for (const [varName, value] of Object.entries(tokens)) {
        root.style.setProperty(varName, value);
        if (varName === '--primary') {
          root.style.setProperty('--green',          value);
          root.style.setProperty('--primary-glow',   hexToRgba(value, .08));
          root.style.setProperty('--primary-glow-2', hexToRgba(value, .18));
          root.style.setProperty('--border',         hexToRgba(value, .18));
          root.style.setProperty('--border-hover',   hexToRgba(value, .45));
        }
        if (varName === '--danger') {
          root.style.setProperty('--red',         value);
          root.style.setProperty('--danger-soft', hexToRgba(value, .12));
          root.style.setProperty('--danger-glow', hexToRgba(value, .25));
        }
        if (varName === '--warning') {
          root.style.setProperty('--yellow',       value);
          root.style.setProperty('--warning-soft', hexToRgba(value, .12));
          root.style.setProperty('--warning-glow', hexToRgba(value, .25));
        }
        if (varName === '--surface') {
          root.style.setProperty('--surface-2', lightenHex(value, 5));
          root.style.setProperty('--surface-3', lightenHex(value, 10));
          root.style.setProperty('--surface-4', lightenHex(value, 15));
        }
      }
    }

    const savedFont = getConfig(configs, 'theme_font');
    if (savedFont) {
      root.style.setProperty('--font-base', savedFont);
      loadGoogleFont(savedFont);
    }

    const savedRadius = getConfig(configs, 'theme_radius');
    if (savedRadius) {
      root.style.setProperty('--radius',    savedRadius);
      root.style.setProperty('--radius-xs', savedRadius);
    }
  } catch {}
}

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(0,255,100,${alpha})`;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenHex(hex, amount) {
  if (!hex || hex.length < 7) return hex;
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function loadGoogleFont(fontFamily) {
  const name = fontFamily.replace(/'/g, '').split(',')[0].trim();
  const safe = ['Rajdhani', 'Inter'];
  if (safe.includes(name)) return;
  const id = `gfont-${name.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/\s/g, '+')}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

function updateClock() {
  const now = new Date();
  $('#current-time').textContent =
    `${now.toLocaleTimeString('fr-FR')} — ${now.toLocaleDateString('fr-FR')}`;
}
setInterval(updateClock, 1000);
updateClock();

async function checkBotStatus() {
  try {
    const data  = await getBotStatus();
    const dot   = $('#status-dot');
    const label = $('#status-label');
    if (data?.status === 'online') {
      dot?.classList.add('online');
      if (label) label.textContent = 'BOT ONLINE';
    } else {
      dot?.classList.remove('online');
      if (label) label.textContent = 'BOT OFFLINE';
    }
  } catch (err) {
    console.error('Bot status error:', err);
  }
}
checkBotStatus();
setInterval(checkBotStatus, 30000);

const sections = {
  overview:    () => import('./sections/overview.js').then(m => m.initOverview()),
  players:     () => import('./sections/players.js').then(m => m.initPlayers()),
  analytics:   () => import('./sections/analytics.js').then(m => m.initAnalytics()),
  tournament:  () => import('./sections/tournament.js').then(m => m.initTournament()),
  welcome:     () => import('./sections/welcome.js').then(m => m.initWelcome()),
  onboarding:  () => import('./sections/onboarding.js').then(m => m.initOnboarding()),
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
  rulebuilder: () => import('./sections/rulebuilder.js').then(m => m.initRuleBuilder()),
  team:        () => import('./sections/team.js').then(m => m.initTeam()),
};

const PUBLIC_SECTIONS = [
  'overview', 'players', 'analytics', 'tournament', 'welcome', 'onboarding', 'roles',
  'birthdays', 'suggestions', 'events', 'origine', 'messages', 'reactions', 'channels',
  'ocr-test', 'rulebuilder', 'team',
];

const MEMBER_SECTIONS = ['players', 'tournament', 'tickets', 'suggestions', 'events', 'origine'];

async function navigate(section) {
  try {
    const ticketsMod = await import('./sections/tickets.js').catch(() => null);
    if (ticketsMod?.destroyTickets) ticketsMod.destroyTickets();
  } catch {}

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const item = document.querySelector(`[data-section="${section}"]`);
  if (!item) return;
  item.classList.add('active');

  const titleEl = $('#section-title');
  if (titleEl) titleEl.textContent = item.querySelector('span')?.textContent || '';

  const content = $('#section-content');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
        ${Array(4).fill('<div class="skeleton" style="height:90px;border-radius:10px"></div>').join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:14px">
        <div class="skeleton" style="height:300px;border-radius:10px"></div>
        <div class="skeleton" style="height:300px;border-radius:10px"></div>
      </div>
    </div>
  `;

  try {
    const res  = await fetch(`/templates/${section}.html`);
    const html = await res.text();
    content.innerHTML = html;
  } catch {
    content.innerHTML = '';
  }

  if (sections[section]) await sections[section]();

  attachAllEmojiPickers();
  window.location.hash = section;
}

function attachAllEmojiPickers() {
  document.querySelectorAll('textarea.form-textarea').forEach(ta => {
    if (ta.dataset.emojiAttached) return;
    ta.dataset.emojiAttached = '1';
    attachEmojiPicker(ta.id || generateId(ta));
  });
}

function generateId(el) {
  const id = 'ta-' + Math.random().toString(36).slice(2, 7);
  el.id = id;
  return id;
}

async function applyPermissions() {
  try {
    const permissions = await getUserPermissions();
    const isMember    = window.WARSTACK_IS_MEMBER === true;

    document.querySelectorAll('.nav-item').forEach(item => {
      const section = item.dataset.section;
      if (!section) { item.style.display = 'flex'; return; }

      if (isMember) {
        item.style.display = MEMBER_SECTIONS.includes(section) ? 'flex' : 'none';
        return;
      }

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

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    if (!item.dataset.section) return;
    e.preventDefault();
    await navigate(item.dataset.section);
  });
});

async function initDashboard() {
  await preloadTheme();
  await applyPermissions();
  await loadEmojis();
  const initial = window.location.hash?.replace('#', '') || 'overview';
  await navigate(initial);
  initTooltips();
  await initNotifications();
}

initDashboard();