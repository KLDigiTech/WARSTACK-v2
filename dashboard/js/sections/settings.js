import { BOT_URL }                             from '../config.js';
import { loadConfigs, saveConfig, getConfig }  from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';
import { PORTAL_ELIGIBLE_SECTIONS, getPortalSections, savePortalSections } from '../services/portalService.js';

const MODULES = [
  { id: 'welcome',     label: 'Welcome',            icon: '👋' },
  { id: 'tickets',     label: 'Tickets',             icon: '🎫' },
  { id: 'suggestions', label: 'Suggestions',         icon: '💡' },
  { id: 'events',      label: 'Événements',          icon: '📅' },
  { id: 'birthdays',   label: 'Anniversaires',       icon: '🎂' },
  { id: 'roles',       label: 'Rôles Auto',          icon: '🎭' },
  { id: 'moderation',  label: 'Modération',          icon: '🛡' },
  { id: 'automod',     label: 'AutoMod',             icon: '🤖' },
  { id: 'logs',        label: 'Logs',                icon: '📋' },
  { id: 'messages',    label: 'Messages récurrents', icon: '📢' },
];

const THEME_TOKENS = [
  { id: 'primary',  var: '--primary',  hex: '#00ff66', dot: 'dot-primary', hexEl: 'hex-primary' },
  { id: 'danger',   var: '--danger',   hex: '#ff4444', dot: 'dot-danger',  hexEl: 'hex-danger'  },
  { id: 'warning',  var: '--warning',  hex: '#ffbd2e', dot: 'dot-warning', hexEl: 'hex-warning' },
  { id: 'bg',       var: '--bg',       hex: '#050805', dot: 'dot-bg',      hexEl: 'hex-bg'      },
  { id: 'surface',  var: '--surface',  hex: '#0a0f0a', dot: 'dot-surface', hexEl: 'hex-surface' },
  { id: 'text',     var: '--text',     hex: '#f2fff2', dot: 'dot-text',    hexEl: 'hex-text'    },
];

// ── INIT ──────────────────────────────────────────────────────────────────────

export async function initSettings() {

  const configs = await loadConfigs();
  document.getElementById('settings-language').value = getConfig(configs, 'settings_language') || 'fr';
  document.getElementById('settings-prefix').value   = getConfig(configs, 'settings_prefix')   || '!';
  document.getElementById('settings-timezone').value = getConfig(configs, 'settings_timezone')  || 'Europe/Paris';

  await loadGuildInfo();
  await loadBotHealth();
  renderModules();
  await renderPortalSections();
  initThemeEditor(configs);

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('settings_language', document.getElementById('settings-language').value),
      saveConfig('settings_prefix',   document.getElementById('settings-prefix').value),
      saveConfig('settings_timezone', document.getElementById('settings-timezone').value),
    ]);
    showToast('✅ Paramètres sauvegardés');
  });

  // Export config
  document.getElementById('btn-export-config').addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const data = await fetchSupabase(`config?guild_id=eq.${guildId}`) || [];
    const json = JSON.stringify({ guild_id: guildId, exported_at: new Date().toISOString(), config: data }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `warstack-config-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Configuration exportée');
  });

  // Import config
  document.getElementById('btn-import-config').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const guildId = await getActiveGuildId();
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { return showToast('❌ Fichier JSON invalide', 'error'); }
    if (!parsed.config?.length) return showToast('❌ Configuration vide ou invalide', 'error');
    const status = document.getElementById('import-status');
    status.style.display = 'block';
    status.textContent   = '⏳ Import en cours...';
    for (const entry of parsed.config) {
      await fetchSupabase('config', 'POST', { guild_id: guildId, key: entry.key, value: entry.value })
        .catch(() => fetchSupabase(`config?guild_id=eq.${guildId}&key=eq.${entry.key}`, 'PATCH', { value: entry.value }));
    }
    status.textContent = `✅ ${parsed.config.length} paramètres importés`;
    showToast('✅ Configuration importée');
    e.target.value = '';
  });

  // Tester connexion
  document.getElementById('btn-test-connection').addEventListener('click', async () => {
    const status = document.getElementById('maintenance-status');
    status.style.display = 'block';
    status.style.color   = 'var(--text-muted)';
    status.textContent   = '⏳ Test en cours...';
    const data = await callBotAPI('status');
    if (data?.status === 'online') {
      status.style.color = 'var(--primary)';
      status.textContent = `✅ Bot connecté — ${data.bot}`;
    } else {
      status.style.color = 'var(--danger)';
      status.textContent = '❌ Bot hors ligne';
    }
  });

  // Resync Discord
  document.getElementById('btn-resync').addEventListener('click', async () => {
    const status = document.getElementById('maintenance-status');
    status.style.display = 'block';
    status.style.color   = 'var(--text-muted)';
    status.textContent   = '⏳ Resynchronisation...';
    const data = await callBotAPI('guild');
    if (data?.name) {
      status.style.color = 'var(--primary)';
      status.textContent = `✅ Synchro OK — ${data.name}`;
      await loadGuildInfo();
    } else {
      status.style.color = 'var(--danger)';
      status.textContent = '❌ Erreur de synchro';
    }
  });

  // Reset config
  document.getElementById('btn-reset-config').addEventListener('click', async () => {
    if (!confirm('⚠️ Réinitialiser TOUTE la configuration ? Cette action est irréversible.')) return;
    if (!confirm('Dernière confirmation — supprimer toute la config ?')) return;
    const guildId = await getActiveGuildId();
    await fetchSupabase(`config?guild_id=eq.${guildId}`, 'DELETE');
    showToast('🗑 Configuration réinitialisée');
  });
}

// ── THEME EDITOR ──────────────────────────────────────────────────────────────

function initThemeEditor(configs) {

  const saved = getConfig(configs, 'theme_tokens');
  if (saved) {
    try {
      const tokens = JSON.parse(saved);
      applyTheme(tokens);
      for (const [varName, value] of Object.entries(tokens)) {
        const token = THEME_TOKENS.find(t => t.var === varName);
        if (token) {
          const input = document.getElementById(`theme-${token.id}`);
          if (input) input.value = value;
        }
      }
    } catch {}
  }

  const savedFont = getConfig(configs, 'theme_font');
  if (savedFont) {
    const fontSel = document.getElementById('theme-font');
    if (fontSel) fontSel.value = savedFont;
    document.documentElement.style.setProperty('--font-base', savedFont);
    loadGoogleFont(savedFont);
  }

  const savedRadius = getConfig(configs, 'theme_radius');
  if (savedRadius) {
    const radiusInput = document.getElementById('theme-radius');
    const radiusVal   = document.getElementById('val-radius');
    if (radiusInput) radiusInput.value = parseInt(savedRadius);
    if (radiusVal)   radiusVal.textContent = savedRadius;
    document.documentElement.style.setProperty('--radius-card', savedRadius);
  }

  THEME_TOKENS.forEach(token => {
    const input  = document.getElementById(`theme-${token.id}`);
    const dotEl  = document.getElementById(token.dot);
    const hexEl  = document.getElementById(token.hexEl);
    if (!input) return;
    if (dotEl) dotEl.style.background = input.value;
    input.addEventListener('input', () => {
      const val = input.value;
      applyTokenLive(token.var, val);
      if (dotEl) dotEl.style.background = val;
      if (hexEl) hexEl.textContent = val;
    });
  });

  const fontSel = document.getElementById('theme-font');
  fontSel?.addEventListener('change', () => {
    const font = fontSel.value;
    document.documentElement.style.setProperty('--font-base', font);
    loadGoogleFont(font);
  });

  const radiusInput = document.getElementById('theme-radius');
  const radiusVal   = document.getElementById('val-radius');
  radiusInput?.addEventListener('input', () => {
    const val = `${radiusInput.value}px`;
    radiusVal.textContent = val;
    document.documentElement.style.setProperty('--radius-card', val);
  });

  document.getElementById('btn-reset-theme')?.addEventListener('click', () => {
    THEME_TOKENS.forEach(token => {
      document.documentElement.style.setProperty(token.var, token.hex);
      const input = document.getElementById(`theme-${token.id}`);
      const dotEl = document.getElementById(token.dot);
      const hexEl = document.getElementById(token.hexEl);
      if (input) input.value = token.hex;
      if (dotEl) dotEl.style.background = token.hex;
      if (hexEl) hexEl.textContent = token.hex;
    });
    document.documentElement.style.setProperty('--font-base', "'Rajdhani', sans-serif");
    document.documentElement.style.setProperty('--radius-card', '20px');
    const fontSel     = document.getElementById('theme-font');
    const radiusInput = document.getElementById('theme-radius');
    const radiusVal   = document.getElementById('val-radius');
    if (fontSel)     fontSel.value     = "'Rajdhani', sans-serif";
    if (radiusInput) radiusInput.value = 20;
    if (radiusVal)   radiusVal.textContent = '20px';
    showToast('🎨 Thème réinitialisé');
  });

  document.getElementById('btn-save-theme')?.addEventListener('click', async () => {
    const tokens = {};
    THEME_TOKENS.forEach(token => {
      const input = document.getElementById(`theme-${token.id}`);
      if (input) tokens[token.var] = input.value;
    });
    const font   = document.getElementById('theme-font')?.value || "'Rajdhani', sans-serif";
    const radius = `${document.getElementById('theme-radius')?.value || 20}px`;
    await Promise.all([
      saveConfig('theme_tokens', JSON.stringify(tokens)),
      saveConfig('theme_font',   font),
      saveConfig('theme_radius', radius),
    ]);
    showToast('✅ Thème sauvegardé !');
  });
}

function applyTokenLive(varName, value) {
  const root = document.documentElement;
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
    root.style.setProperty('--yellow',        value);
    root.style.setProperty('--warning-soft',  hexToRgba(value, .12));
    root.style.setProperty('--warning-glow',  hexToRgba(value, .25));
  }
  if (varName === '--surface') {
    root.style.setProperty('--surface-2', lightenHex(value, 5));
    root.style.setProperty('--surface-3', lightenHex(value, 10));
    root.style.setProperty('--surface-4', lightenHex(value, 15));
  }
  if (varName === '--bg') {
    root.style.setProperty('--bg', value);
  }
}

function applyTheme(tokens) {
  for (const [varName, value] of Object.entries(tokens)) {
    applyTokenLive(varName, value);
  }
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

// ── HELPERS COULEUR ───────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenHex(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── INFOS SERVEUR ─────────────────────────────────────────────────────────────

async function loadGuildInfo() {
  const guildId = await getActiveGuildId();
  const [guildData, channelsData, rolesData, emojisData] = await Promise.all([
    callBotAPI('guild'),
    callBotAPI('channels'),
    callBotAPI('roles'),
    callBotAPI('emojis'),
  ]);

  if (guildData?.name) {
    document.getElementById('settings-guild-name').textContent       = guildData.name;
    document.getElementById('settings-guild-id-display').textContent = guildId;

    if (guildData.icon) {
      const img = document.getElementById('settings-guild-icon');
      img.src = guildData.icon; img.style.display = 'block';
    } else {
      const av = document.getElementById('settings-guild-avatar');
      av.textContent = guildData.name[0].toUpperCase(); av.style.display = 'flex';
    }
  }

  document.getElementById('settings-member-count').textContent  = guildData?.member_count       || '—';
  document.getElementById('settings-channel-count').textContent = channelsData?.channels?.length || '—';
  document.getElementById('settings-role-count').textContent    = rolesData?.roles?.length       || '—';
  document.getElementById('settings-emoji-count').textContent   = emojisData?.emojis?.length     || '—';
}

// ── SANTÉ BOT ─────────────────────────────────────────────────────────────────

async function loadBotHealth() {
  const data  = await callBotAPI('status');
  const badge = document.getElementById('health-bot');
  if (data?.status === 'online') {
    badge.textContent = '🟢 Online';
    badge.className   = 'settings-health-badge green';
  } else {
    badge.textContent = '🔴 Offline';
    badge.className   = 'settings-health-badge red';
  }
  if (data?.uptime) {
    const mins = Math.floor(data.uptime / 60);
    const hrs  = Math.floor(mins / 60);
    document.getElementById('health-uptime').textContent =
      hrs > 0 ? `${hrs}h ${mins % 60}min` : `${mins}min`;
  }
  document.getElementById('health-sync').textContent = 'À l\'instant';
}

// ── MODULES ───────────────────────────────────────────────────────────────────

function renderModules() {
  const el = document.getElementById('settings-modules');
  el.innerHTML = MODULES.map(m => `
    <div class="settings-module-row">
      <span>${m.icon} ${m.label}</span>
      <span class="settings-health-badge green">✓ Actif</span>
    </div>
  `).join('');
}

// ── PORTAIL MEMBRE ────────────────────────────────────────────────────────────

async function renderPortalSections() {
  const el = document.getElementById('settings-portal-sections');
  if (!el) return;

  const enabled = await getPortalSections();

  el.innerHTML = PORTAL_ELIGIBLE_SECTIONS.map(s => `
    <label class="settings-portal-toggle">
      <input type="checkbox" data-portal-section="${s.id}" ${enabled.includes(s.id) ? 'checked' : ''}>
      <i class="fas ${s.icon}"></i>
      <span>${s.label}</span>
    </label>
  `).join('');

  document.getElementById('btn-save-portal')?.addEventListener('click', async () => {
    const checked = [...el.querySelectorAll('input[data-portal-section]:checked')]
      .map(input => input.dataset.portalSection);
    await savePortalSections(checked);
    showToast('✅ Portail membre sauvegardé');
  });
}