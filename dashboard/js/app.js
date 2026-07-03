import { initModal as initUIModal } from './ui/modal.js';
import { $ } from './utils/dom.js';
import { getBotStatus } from './services/botService.js';
import { getUserPermissions } from './services/permissionService.js';
import { loadEmojis, attachEmojiPicker } from './components/emojiPicker.js';
import { initTooltips } from './components/tooltip.js';
import { initNotifications } from './components/notifications.js';
import { loadConfigs, getConfig } from './services/configService.js';
import { initVarDropdowns } from './components/varDropdown.js';

initUIModal();
initVarDropdowns();

async function preloadTheme() {
  try {
    const configs = await loadConfigs();
    const root = document.documentElement;

    const savedTokens = getConfig(configs, 'theme_tokens');
    if (savedTokens) {
      const tokens = JSON.parse(savedTokens);
      for (const [varName, value] of Object.entries(tokens)) {
        root.style.setProperty(varName, value);
        if (varName === '--primary') {
          root.style.setProperty('--green', value);
          root.style.setProperty('--primary-glow', hexToRgba(value, .08));
          root.style.setProperty('--primary-glow-2', hexToRgba(value, .18));
          root.style.setProperty('--border', hexToRgba(value, .18));
          root.style.setProperty('--border-hover', hexToRgba(value, .45));
        }
        if (varName === '--danger') {
          root.style.setProperty('--red', value);
          root.style.setProperty('--danger-soft', hexToRgba(value, .12));
          root.style.setProperty('--danger-glow', hexToRgba(value, .25));
        }
        if (varName === '--warning') {
          root.style.setProperty('--yellow', value);
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
      root.style.setProperty('--radius', savedRadius);
      root.style.setProperty('--radius-xs', savedRadius);
    }
  } catch { }
}

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(0,255,100,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenHex(hex, amount) {
  if (!hex || hex.length < 7) return hex;
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function loadGoogleFont(fontFamily) {
  const name = fontFamily.replace(/'/g, '').split(',')[0].trim();
  const safe = ['Rajdhani', 'Inter'];
  if (safe.includes(name)) return;
  const id = `gfont-${name.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
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
    const data = await getBotStatus();
    const dot = $('#status-dot');
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

setInterval(checkBotStatus, 30000);

// ─── MODULE META — phrase + preview + avancé ─────────────────────────────────
const MODULE_META = {
  welcome     : { icon: '👋', title: 'Accueil des nouveaux membres',   desc: 'Configurez le message de bienvenue envoyé automatiquement quand un membre rejoint votre serveur.', preview: true,  advanced: false },
  onboarding  : { icon: '📋', title: 'Inscription des membres',        desc: 'Guidez chaque nouveau membre étape par étape jusqu\'à son accès complet au serveur.', preview: false, advanced: false },
  players     : { icon: '🪖', title: 'Base de joueurs WARSTACK',       desc: 'Gérez tous les joueurs inscrits, leurs stats Battlefield 6, leur XP et leurs récompenses.', preview: false, advanced: false },
  tournament  : { icon: '🏆', title: 'Tournois & Compétitions',        desc: 'Créez et gérez des tournois avec inscriptions, résultats et classements automatiques.', preview: true,  advanced: false },
  events      : { icon: '📅', title: 'Événements communautaires',      desc: 'Organisez des parties, sessions ou rencontres avec votre communauté.', preview: true,  advanced: false },
  tickets     : { icon: '🎫', title: 'Gestion des demandes',           desc: 'Permettez à vos membres de contacter votre équipe et suivez chaque demande jusqu\'à sa résolution.', preview: false, advanced: false },
  moderation  : { icon: '🛡️', title: 'Modération & Sanctions',        desc: 'Gérez les avertissements, mutes et bans de vos membres depuis un seul endroit.', preview: false, advanced: false },
  automod     : { icon: '🤖', title: 'Protection automatique',         desc: 'Détectez et bloquez automatiquement le spam, les liens indésirables et les comportements abusifs.', preview: false, advanced: false },
  suggestions : { icon: '💡', title: 'Boîte à idées',                  desc: 'Recueillez les suggestions de vos membres et votez pour les meilleures.', preview: false, advanced: false },
  boutique    : { icon: '🏪', title: 'Boutique & Cosmétiques',         desc: 'Créez des items que vos membres peuvent acheter avec leurs WAR Coins.', preview: false, advanced: false },
  team        : { icon: '⭐', title: 'Équipe & Permissions',            desc: 'Définissez votre équipe et contrôlez qui peut accéder à chaque section du dashboard.', preview: false, advanced: false },
  settings    : { icon: '⚙️', title: 'Paramètres du serveur',          desc: 'Configurez les options générales de WARSTACK pour votre serveur.', preview: false, advanced: false },
  analytics   : { icon: '📊', title: 'Statistiques & Activité',        desc: 'Suivez l\'activité de votre serveur, la croissance et l\'engagement de vos membres.', preview: false, advanced: false },
  logs        : { icon: '📋', title: 'Historique des actions',          desc: 'Consultez tout ce qui se passe sur votre serveur : messages, sanctions, connexions.', preview: false, advanced: false },
  roles       : { icon: '🏷️', title: 'Rôles par réaction',            desc: 'Laissez vos membres choisir leurs rôles en réagissant à un message avec un emoji.', preview: true,  advanced: false },
  messages    : { icon: '📢', title: 'Messages automatiques',           desc: 'Programmez des messages récurrents dans vos salons Discord.', preview: true,  advanced: false },
  birthdays   : { icon: '🎂', title: 'Anniversaires',                  desc: 'Célébrez automatiquement les anniversaires de vos membres.', preview: true,  advanced: false },
  channels    : { icon: '📡', title: 'Salons & Catégories',             desc: 'Configurez les salons utilisés par WARSTACK pour chaque fonctionnalité.', preview: false, advanced: false },
  rulebuilder : { icon: '⚡', title: 'Automatisations',                 desc: 'Créez des règles automatiques : si un événement se produit, WARSTACK agit à votre place.', preview: false, advanced: false },
  origine     : { icon: '🌍', title: 'Carte des membres',              desc: 'Visualisez d\'où viennent vos membres sur une carte interactive.', preview: false, advanced: false },
  overview    : { icon: null, title: null, desc: null },
};

function injectModuleHeader(section, container) {
  const meta = MODULE_META[section];
  if (!meta || !meta.title) return;

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML = `
    <div class="module-header-left">
      ${meta.icon ? `<div class="module-header-icon">${meta.icon}</div>` : ''}
      <div class="module-header-text">
        <div class="module-header-title">${meta.title}</div>
        <div class="module-header-desc">${meta.desc}</div>
      </div>
    </div>
    <div class="module-header-actions">
      ${meta.preview ? `<button class="btn btn-secondary btn-sm module-preview-btn" onclick="openModulePreview('${section}')"><i class="fas fa-eye"></i> Aperçu Discord</button>` : ''}
      ${meta.advanced ? `<button class="btn btn-ghost btn-sm module-advanced-btn" onclick="toggleModuleAdvanced('${section}')"><i class="fas fa-sliders-h"></i> Réglages avancés</button>` : ''}
    </div>
  `;
  container.insertBefore(header, container.firstChild);
}

window.toggleModuleAdvanced = function(section) {
  const advEls = document.querySelectorAll('.module-advanced-section');
  const btn    = document.querySelector('.module-advanced-btn');
  if (!advEls.length) return;
  const isHidden = advEls[0].style.display === 'none' || !advEls[0].style.display;
  advEls.forEach(el => el.style.display = isHidden ? '' : 'none');
  if (btn) btn.innerHTML = isHidden
    ? '<i class="fas fa-times"></i> Masquer'
    : '<i class="fas fa-sliders-h"></i> Réglages avancés';
};

window.openModulePreview = function(section) {
  // Preview Discord simulé — à enrichir par section
  const previews = {
    welcome    : { title: 'Message de bienvenue', content: '👋 **Bienvenue {user} !**\nNous sommes heureux de t\'accueillir.\n\n[Commencer l\'inscription]' },
    tournament : { title: 'Annonce de tournoi',   content: '🏆 **Tournoi REDSEC**\n📅 Date : à définir\n👥 Inscrits : 0\n\n[S\'inscrire]' },
    events     : { title: 'Événement communautaire', content: '📅 **Session Ranked**\n🎮 Battlefield 6\n⏰ 21h00\n\n[Participer] [Peut-être]' },
    roles      : { title: 'Rôles par réaction',   content: '🎮 Choisis ta plateforme :\n🎮 PlayStation\n🖥️ PC\n🎮 Xbox' },
    messages   : { title: 'Message automatique',  content: '📢 Rappel hebdomadaire\n⚔️ Tournoi ce soir à 21h !' },
    birthdays  : { title: 'Joyeux anniversaire',  content: '🎂 **Joyeux anniversaire {user} !**\nToute l\'équipe te souhaite un excellent anniversaire 🎉' },
  };
  const p = previews[section];
  if (!p) return;

  let modal = document.getElementById('module-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'module-preview-modal';
    modal.className = 'module-preview-modal';
    modal.innerHTML = `
      <div class="module-preview-overlay" onclick="document.getElementById('module-preview-modal').style.display='none'"></div>
      <div class="module-preview-box">
        <div class="module-preview-header">
          <span class="module-preview-tag">👁️ Aperçu Discord</span>
          <button onclick="document.getElementById('module-preview-modal').style.display='none'" class="module-preview-close">✕</button>
        </div>
        <div class="module-preview-discord">
          <div class="discord-mock">
            <div class="discord-mock-channel"># général</div>
            <div class="discord-mock-message">
              <img class="discord-mock-avatar" src="https://cdn.discordapp.com/embed/avatars/0.png">
              <div class="discord-mock-body">
                <div class="discord-mock-name">WARSTACK <span class="discord-bot-tag">BOT</span></div>
                <div class="discord-mock-embed">
                  <div class="discord-embed-bar"></div>
                  <div class="discord-embed-content" id="module-preview-content"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="module-preview-note"><i class="fas fa-info-circle"></i> L'aperçu est indicatif. Le rendu Discord peut varier selon vos paramètres.</div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('module-preview-content').innerHTML = p.content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  modal.style.display = 'flex';
};

const sections = {
  overview      : () => import('./sections/overview.js').then(m => m.initOverview()),
  players       : () => import('./sections/players.js').then(m => m.initPlayers()),
  analytics     : () => import('./sections/analytics.js').then(m => m.initAnalytics()),
  tournament    : () => import('./sections/tournament.js').then(m => m.initTournament()),
  welcome       : () => import('./sections/welcome.js').then(m => m.initWelcome()),
  onboarding    : () => import('./sections/onboarding.js').then(m => m.initOnboarding()),
  roles         : () => import('./sections/roles.js').then(m => m.initRoles()),
  birthdays     : () => import('./sections/birthdays.js').then(m => m.initBirthdays()),
  suggestions   : () => import('./sections/suggestions.js').then(m => m.initSuggestions()),
  events        : () => import('./sections/events.js').then(m => m.initEvents()),
  moderation    : () => import('./sections/moderation.js').then(m => m.initModeration()),
  automod       : () => import('./sections/automod.js').then(m => m.initAutomod()),
  tickets       : () => import('./sections/tickets.js').then(m => m.initTickets()),
  logs          : () => import('./sections/logs.js').then(m => m.initLogs()),
  messages      : () => import('./sections/messages.js').then(m => m.initMessages()),
  reactions     : () => import('./sections/reactions.js').then(m => m.initReactions()),
  channels      : () => import('./sections/channels.js').then(m => m.initChannels()),
  access        : () => import('./sections/access.js').then(m => m.initAccess()),
  settings      : () => import('./sections/settings.js').then(m => m.initSettings()),
  'ocr-test'    : () => import('./sections/ocr-test.js').then(m => m.initOcrTest()),
  origine       : () => import('./sections/origine.js').then(m => m.initOrigine()),
  rulebuilder   : () => import('./sections/rulebuilder.js').then(m => m.initRuleBuilder()),
  team          : () => import('./sections/team.js').then(m => m.initTeam()),
  boutique      : () => import('./sections/boutique.js').then(m => m.initBoutique()),
  notifications : () => import('./sections/notifications-page.js').then(m => m.initNotificationsPage()),
  profil        : () => import('./sections/profil-embed.js').then(m => m.initProfilEmbed()),
  portail       : () => import('./sections/portail-embed.js').then(m => m.initPortailEmbed()),
  inscription   : () => import('./sections/inscription-embed.js').then(m => m.initInscriptionEmbed()),
};

const PUBLIC_SECTIONS = [
  'overview', 'players', 'analytics', 'tournament', 'welcome', 'onboarding', 'roles',
  'birthdays', 'suggestions', 'events', 'origine', 'messages', 'reactions', 'channels',
  'ocr-test', 'rulebuilder', 'team', 'boutique', 'notifications',
  'profil', 'portail', 'inscription',
];

const MEMBER_SECTIONS = ['overview', 'players', 'tournament', 'tickets', 'suggestions', 'events', 'origine', 'boutique', 'profil', 'portail', 'inscription'];

window._memberViewActive = false;

let _navToken = 0;

async function navigate(section) {
  const myToken = ++_navToken;
  try {
    const ticketsMod = await import('./sections/tickets.js').catch(() => null);
    if (ticketsMod?.destroyTickets) ticketsMod.destroyTickets();
  } catch { }

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
    // Sections embed — pas de template HTML, le JS gère tout
    const EMBED_SECTIONS = ['profil', 'portail', 'inscription'];
    if (EMBED_SECTIONS.includes(section)) {
      if (_navToken !== myToken) return;
      content.innerHTML = '';
    } else {
      const res = await fetch(`/templates/${section}.html`);
      const html = await res.text();
      if (_navToken !== myToken) return;
      content.innerHTML = html;
      injectModuleHeader(section, content);
    }
  } catch {
    if (_navToken !== myToken) return;
    content.innerHTML = '';
  }

  if (_navToken !== myToken) return;
  await applyPermissions();

  if (_navToken !== myToken) return;
  if (sections[section]) await sections[section]();

  if (_navToken !== myToken) return;
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
    const isMember = window.WARSTACK_IS_MEMBER === true || window._memberViewActive;

    document.querySelectorAll('.nav-group').forEach(group => {
      const items = group.querySelectorAll('.nav-item[data-section]');
      let anyVisible = false;

      items.forEach(item => {
        const section = item.dataset.section;
        let visible = false;

        if (isMember) {
          visible = MEMBER_SECTIONS.includes(section);
        } else if (PUBLIC_SECTIONS.includes(section)) {
          visible = true;
        } else if (!permissions || permissions.length === 0) {
          visible = true;
        } else {
          visible = permissions.includes(section);
        }

        item.style.display = visible ? 'flex' : 'none';
        if (visible) anyVisible = true;
      });

      const title = group.querySelector('.nav-group-title');
      if (title) title.style.display = anyVisible ? '' : 'none';
      group.style.display = anyVisible ? '' : 'none';
    });

    document.querySelectorAll('.nav-item:not([data-section])').forEach(item => {
      const id = item.id;
      if (isMember) {
        if (id === 'nav-mon-profil' || id === 'nav-portail') {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      } else {
        item.style.display = 'flex';
      }
    });

  } catch {
    document.querySelectorAll('.nav-item').forEach(i => i.style.display = 'flex');
  }
}

function initToggleView() {
  const btn = document.getElementById('btn-toggle-view');
  const label = document.getElementById('toggle-view-label');
  const icon = btn?.querySelector('i');

  if (!btn) return;

  if (window.WARSTACK_IS_MEMBER) {
    window._memberViewActive = true;
    document.body.classList.add('member-view');
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';

  btn.addEventListener('click', async () => {
    window._memberViewActive = !window._memberViewActive;

    if (window._memberViewActive) {
      document.body.classList.add('member-view');
      label.textContent = 'Vue staff';
      icon.className = 'fas fa-shield-alt';
      btn.classList.add('active');
    } else {
      document.body.classList.remove('member-view');
      label.textContent = 'Vue membre';
      icon.className = 'fas fa-users';
      btn.classList.remove('active');
    }

    await applyPermissions();

    const firstVisible = document.querySelector('.nav-group:not([style*="display: none"]) .nav-item[data-section]:not([style*="display: none"]):not([style*="display:none"])');
    if (firstVisible) firstVisible.click();
  });
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
  initToggleView();

  const initial = window.location.hash?.replace('#', '') || 'overview';
  // Groupes collapsibles sidebar
  document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const group = toggle.closest('.nav-group-collapsible');
      if (group) group.classList.toggle('open');
    });
  });

  await navigate(initial);
  initTooltips();
  await initNotifications();
}

initDashboard();