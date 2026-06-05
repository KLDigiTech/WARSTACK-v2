import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI }                          from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { fetchSupabase }                       from '../api.js';
import { GUILD_ID }                            from '../config.js';
import { showSkeleton }                        from '../ui/skeleton.js';

let _teams = [];
let _games = [];
let _roles = [];

// ── TIMEOUT HELPER — évite le freeze si le bot Render est en cold start ───────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)
    ),
  ]);
}

export async function initOnboarding() {

  // Skeletons immédiats
  showSkeleton('ob-recent-list', 'row', 5);
  const statIds = ['ob-stat-total', 'ob-stat-today', 'ob-stat-pending'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<span class="skeleton sk-title" style="width:40px;display:inline-block"></span>`;
  });

  // FIX #2 — withTimeout + .catch individuel sur callBotAPI
  // Si le bot est en cold start, on ne bloque pas le chargement de la config
  const [configs, channelsData, rolesData] = await Promise.all([
    withTimeout(loadConfigs()).catch(() => []),
    withTimeout(callBotAPI('channels')).catch(() => ({ channels: [] })),
    withTimeout(callBotAPI('roles')).catch(() => ({ roles: [] })),
  ]);

  _roles = rolesData?.roles || [];

  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('ob-channel').innerHTML = chOpts;

  const roleOpts = `<option value="">Aucun rôle</option>` +
    _roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  ['ob-role-unverified', 'ob-role-member', 'ob-pc-role', 'ob-psn-role', 'ob-xbox-role'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = roleOpts;
  });

  document.getElementById('ob-channel').value         = getConfig(configs, 'ob_channel')        || '';
  document.getElementById('ob-role-unverified').value = getConfig(configs, 'ob_role_unverified') || '';
  document.getElementById('ob-role-member').value     = getConfig(configs, 'ob_role_member')     || '';
  document.getElementById('ob-rules-enabled').checked = getConfig(configs, 'ob_rules_enabled') !== 'false';
  document.getElementById('ob-rules-text').value      = getConfig(configs, 'ob_rules_text')      || '';
  document.getElementById('ob-confirm-msg').value     = getConfig(configs, 'ob_confirm_msg')     || '';
  document.getElementById('ob-dm-enabled').checked    = getConfig(configs, 'ob_dm_enabled') === 'true';
  document.getElementById('ob-dm-msg').value          = getConfig(configs, 'ob_dm_msg')          || '';
  document.getElementById('ob-pc-enabled').checked    = getConfig(configs, 'ob_pc_enabled')   !== 'false';
  document.getElementById('ob-psn-enabled').checked   = getConfig(configs, 'ob_psn_enabled')  !== 'false';
  document.getElementById('ob-xbox-enabled').checked  = getConfig(configs, 'ob_xbox_enabled') !== 'false';
  document.getElementById('ob-pc-role').value         = getConfig(configs, 'ob_pc_role')       || '';
  document.getElementById('ob-psn-role').value        = getConfig(configs, 'ob_psn_role')      || '';
  document.getElementById('ob-xbox-role').value       = getConfig(configs, 'ob_xbox_role')     || '';

  try { _teams = JSON.parse(getConfig(configs, 'ob_teams') || '[]'); } catch { _teams = []; }
  try { _games = JSON.parse(getConfig(configs, 'ob_games') || '[]'); } catch { _games = []; }

  if (!_teams.length) {
    _teams = [
      { emoji: '🔥', label: 'PÖF',     role_id: '', role_name: '' },
      { emoji: '👑', label: 'STAFF',    role_id: '', role_name: '' },
      { emoji: '👁️', label: 'VISITEUR', role_id: '', role_name: '' },
    ];
  }
  if (!_games.length) {
    _games = [
      { emoji: '🎖️', label: 'Battlefield 6', role_id: '', role_name: '' },
      { emoji: '💣', label: 'Call of Duty',   role_id: '', role_name: '' },
    ];
  }

  renderTeams();
  renderGames();
  updatePreviews();

  // Toggle règlement
  document.getElementById('ob-rules-enabled').addEventListener('change', e => {
    document.getElementById('ob-rules-group').style.display = e.target.checked ? 'block' : 'none';
    updatePreviews();
  });
  document.getElementById('ob-rules-group').style.display =
    document.getElementById('ob-rules-enabled').checked ? 'block' : 'none';

  // Toggle DM
  document.getElementById('ob-dm-enabled').addEventListener('change', e => {
    document.getElementById('ob-dm-group').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('ob-dm-group').style.display =
    document.getElementById('ob-dm-enabled').checked ? 'block' : 'none';

  // Variables cliquables
  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById(btn.dataset.target);
      if (!textarea) return;
      const pos = textarea.selectionStart ?? textarea.value.length;
      const ins = btn.dataset.var;
      textarea.value = textarea.value.slice(0, pos) + ins + textarea.value.slice(pos);
      textarea.focus();
      textarea.setSelectionRange(pos + ins.length, pos + ins.length);
    });
  });

  // Live preview règlement
  document.getElementById('ob-rules-text').addEventListener('input', updatePreviews);

  // Navigation aperçu
  document.querySelectorAll('.ob-prev-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      document.querySelectorAll('.ob-prev-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ob-preview-step').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`prev-step-${step}`)?.classList.add('active');
    });
  });

  // Ajouter équipe
  document.getElementById('ob-add-team').addEventListener('click', () => {
    const form = document.getElementById('ob-team-add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const sel = document.getElementById('ob-new-team-role');
    sel.innerHTML = `<option value="">Aucun rôle</option>` +
      _roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  });

  document.getElementById('ob-confirm-team').addEventListener('click', () => {
    const emoji   = document.getElementById('ob-new-team-emoji').value.trim() || '🔥';
    const label   = document.getElementById('ob-new-team-label').value.trim();
    const roleEl  = document.getElementById('ob-new-team-role');
    const role_id   = roleEl.value;
    const role_name = roleEl.options[roleEl.selectedIndex]?.text || '';
    if (!label) return showToast('❌ Nom de l\'équipe requis', 'error');
    _teams.push({ emoji, label, role_id, role_name });
    document.getElementById('ob-team-add-form').style.display = 'none';
    document.getElementById('ob-new-team-emoji').value = '';
    document.getElementById('ob-new-team-label').value = '';
    renderTeams();
    updatePreviews();
  });

  document.getElementById('ob-cancel-team').addEventListener('click', () => {
    document.getElementById('ob-team-add-form').style.display = 'none';
  });

  // Ajouter jeu
  document.getElementById('ob-add-game').addEventListener('click', () => {
    const form = document.getElementById('ob-game-add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const sel = document.getElementById('ob-new-game-role');
    sel.innerHTML = `<option value="">Aucun rôle</option>` +
      _roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  });

  document.getElementById('ob-confirm-game').addEventListener('click', () => {
    const emoji   = document.getElementById('ob-new-game-emoji').value.trim() || '🎮';
    const label   = document.getElementById('ob-new-game-label').value.trim();
    const roleEl  = document.getElementById('ob-new-game-role');
    const role_id   = roleEl.value;
    const role_name = roleEl.options[roleEl.selectedIndex]?.text || '';
    if (!label) return showToast('❌ Nom du jeu requis', 'error');
    _games.push({ emoji, label, role_id, role_name });
    document.getElementById('ob-game-add-form').style.display = 'none';
    document.getElementById('ob-new-game-emoji').value = '';
    document.getElementById('ob-new-game-label').value = '';
    renderGames();
    updatePreviews();
  });

  document.getElementById('ob-cancel-game').addEventListener('click', () => {
    document.getElementById('ob-game-add-form').style.display = 'none';
  });

  // Sauvegarder
  document.getElementById('ob-save').addEventListener('click', saveOnboarding);

  // Poster le panel
  document.getElementById('ob-btn-post').addEventListener('click', postPanel);

  // Stats
  loadStats();
}

// ── RENDER LISTES ─────────────────────────────────────────────────────────────

function renderTeams() {
  const container = document.getElementById('ob-teams-list');
  if (!_teams.length) {
    container.innerHTML = '<div class="ob-empty">Aucune équipe configurée</div>';
    return;
  }
  container.innerHTML = _teams.map((t, i) => `
    <div class="ob-team-item" data-index="${i}">
      <span class="ob-item-emoji">${t.emoji}</span>
      <span class="ob-item-name">${t.label}</span>
      <span class="ob-item-role">${t.role_name || 'Aucun rôle'}</span>
      <button class="ob-item-delete" data-type="team" data-index="${i}" title="Supprimer">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.ob-item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      _teams.splice(parseInt(btn.dataset.index), 1);
      renderTeams();
      updatePreviews();
    });
  });
}

function renderGames() {
  const container = document.getElementById('ob-games-list');
  if (!_games.length) {
    container.innerHTML = '<div class="ob-empty">Aucun jeu configuré</div>';
    return;
  }
  container.innerHTML = _games.map((g, i) => `
    <div class="ob-game-item" data-index="${i}">
      <span class="ob-item-emoji">${g.emoji}</span>
      <span class="ob-item-name">${g.label}</span>
      <span class="ob-item-role">${g.role_name || 'Aucun rôle'}</span>
      <button class="ob-item-delete" data-type="game" data-index="${i}" title="Supprimer">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.ob-item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      _games.splice(parseInt(btn.dataset.index), 1);
      renderGames();
      updatePreviews();
    });
  });
}

// ── PREVIEW LIVE ──────────────────────────────────────────────────────────────

function updatePreviews() {
  const rulesEl   = document.getElementById('ob-rules-text');
  const prevRules = document.getElementById('prev-rules-text');
  if (prevRules) {
    const txt = rulesEl?.value?.trim() || 'Lis et accepte le règlement pour continuer.';
    prevRules.textContent = txt.length > 200 ? txt.slice(0, 200) + '...' : txt;
  }

  const teamsContainer = document.getElementById('prev-teams-btns');
  if (teamsContainer) {
    teamsContainer.innerHTML = _teams.length
      ? _teams.map(t => `<div class="ob-mock-btn-team">${t.emoji} ${t.label}</div>`).join('')
      : '<div class="ob-mock-btn-team">🔥 PÖF</div>';
  }

  const platsContainer = document.getElementById('prev-platforms-btns');
  if (platsContainer) {
    const plats = [];
    if (document.getElementById('ob-pc-enabled')?.checked)   plats.push('<div class="ob-mock-btn-platform"><i class="fas fa-desktop"></i> PC</div>');
    if (document.getElementById('ob-psn-enabled')?.checked)  plats.push('<div class="ob-mock-btn-platform"><i class="fab fa-playstation"></i> PS</div>');
    if (document.getElementById('ob-xbox-enabled')?.checked) plats.push('<div class="ob-mock-btn-platform"><i class="fab fa-xbox"></i> Xbox</div>');
    platsContainer.innerHTML = plats.join('') || '<div class="ob-mock-btn-platform">PC</div>';
  }

  const gamesContainer = document.getElementById('prev-games-btns');
  if (gamesContainer) {
    gamesContainer.innerHTML = _games.length
      ? _games.map(g => `<div class="ob-mock-btn-game">${g.emoji} ${g.label}</div>`).join('')
      : '<div class="ob-mock-btn-game">🎮 Jeu</div>';
  }
}

// ── SAUVEGARDER ───────────────────────────────────────────────────────────────

async function saveOnboarding() {
  const btn = document.getElementById('ob-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';

  try {
    await Promise.all([
      saveConfig('ob_channel',         document.getElementById('ob-channel').value),
      saveConfig('ob_role_unverified',  document.getElementById('ob-role-unverified').value),
      saveConfig('ob_role_member',      document.getElementById('ob-role-member').value),
      saveConfig('ob_rules_enabled',    String(document.getElementById('ob-rules-enabled').checked)),
      saveConfig('ob_rules_text',       document.getElementById('ob-rules-text').value),
      saveConfig('ob_confirm_msg',      document.getElementById('ob-confirm-msg').value),
      saveConfig('ob_dm_enabled',       String(document.getElementById('ob-dm-enabled').checked)),
      saveConfig('ob_dm_msg',           document.getElementById('ob-dm-msg').value),
      saveConfig('ob_pc_enabled',       String(document.getElementById('ob-pc-enabled').checked)),
      saveConfig('ob_psn_enabled',      String(document.getElementById('ob-psn-enabled').checked)),  // FIX #1 — tiret → underscore
      saveConfig('ob_xbox_enabled',     String(document.getElementById('ob-xbox-enabled').checked)),
      saveConfig('ob_pc_role',          document.getElementById('ob-pc-role').value),
      saveConfig('ob_psn_role',         document.getElementById('ob-psn-role').value),
      saveConfig('ob_xbox_role',        document.getElementById('ob-xbox-role').value),
      saveConfig('ob_teams',            JSON.stringify(_teams)),
      saveConfig('ob_games',            JSON.stringify(_games)),
    ]);
    showToast('✅ Configuration onboarding sauvegardée !');
  } catch (e) {
    showToast('❌ Erreur lors de la sauvegarde', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
  }
}

// ── POSTER LE PANEL ───────────────────────────────────────────────────────────

async function postPanel() {
  const channelId = document.getElementById('ob-channel').value;
  if (!channelId) return showToast('❌ Choisis un salon d\'abord', 'error');

  const btn = document.getElementById('ob-btn-post');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

  const payload = {
    channel_id      : channelId,
    rules_enabled   : document.getElementById('ob-rules-enabled').checked,
    rules_text      : document.getElementById('ob-rules-text').value,
    teams           : _teams,
    games           : _games,
    pc_enabled      : document.getElementById('ob-pc-enabled').checked,
    psn_enabled     : document.getElementById('ob-psn-enabled').checked,
    xbox_enabled    : document.getElementById('ob-xbox-enabled').checked,
    role_member     : document.getElementById('ob-role-member').value,
    role_unverified : document.getElementById('ob-role-unverified').value,
    confirm_msg     : document.getElementById('ob-confirm-msg').value,
    dm_enabled      : document.getElementById('ob-dm-enabled').checked,
    dm_msg          : document.getElementById('ob-dm-msg').value,
  };

  try {
    const result = await callBotAPI('onboarding/post', 'POST', payload);
    if (result?.success) {
      showToast('✅ Panel onboarding envoyé dans le salon !');
    } else {
      showToast('❌ ' + (result?.error || 'Erreur lors de l\'envoi'), 'error');
    }
  } catch (e) {
    showToast('❌ Erreur réseau', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Poster le panel';
  }
}

// ── STATS ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await fetchSupabase(
      `onboarding_logs?guild_id=eq.${GUILD_ID}&order=created_at.desc&limit=50`
    );
    const logs = Array.isArray(data) ? data : [];

    const today     = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter(l => l.created_at?.startsWith(today));

    const totalEl   = document.getElementById('ob-stat-total');
    const todayEl   = document.getElementById('ob-stat-today');
    const pendEl    = document.getElementById('ob-stat-pending');
    if (totalEl) totalEl.textContent = logs.length;
    if (todayEl) todayEl.textContent = todayLogs.length;
    if (pendEl)  pendEl.textContent  = '0';

    // Stats par équipe
    const teamCounts = {};
    logs.forEach(l => {
      if (l.team) teamCounts[l.team] = (teamCounts[l.team] || 0) + 1;
    });

    const teamStatsEl = document.getElementById('ob-team-stats');
    if (teamStatsEl && Object.keys(teamCounts).length) {
      const max = Math.max(...Object.values(teamCounts));
      teamStatsEl.innerHTML = Object.entries(teamCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([team, count]) => `
          <div class="ob-team-stat-row">
            <span class="ob-ts-label">${team}</span>
            <div class="ob-ts-bar-wrap">
              <div class="ob-ts-bar" style="width:${Math.round((count / max) * 100)}%"></div>
            </div>
            <span class="ob-ts-count">${count}</span>
          </div>
        `).join('');
    }

    // Dernières vérifications
    const recentEl = document.getElementById('ob-recent-list');
    if (recentEl) {
      if (!logs.length) {
        recentEl.innerHTML = '<div class="ob-empty">Aucune vérification enregistrée</div>';
        return;
      }
      recentEl.innerHTML = logs.slice(0, 10).map(l => `
        <div class="ob-recent-item">
          <img class="ob-recent-avatar"
            src="${l.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
            onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
            alt="avatar">
          <div class="ob-recent-info">
            <div class="ob-recent-name">${l.username || 'Inconnu'}</div>
            <div class="ob-recent-meta">
              ${l.team     ? `⚔️ ${l.team}`          : ''}
              ${l.platform ? `· 🎮 ${l.platform}`    : ''}
              ${l.games?.length ? `· ${l.games.join(', ')}` : ''}
            </div>
          </div>
          <span class="ob-recent-badge">✅ Vérifié</span>
        </div>
      `).join('');
    }

  } catch (e) {
    ['ob-stat-total', 'ob-stat-today', 'ob-stat-pending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
    const recentEl = document.getElementById('ob-recent-list');
    if (recentEl) recentEl.innerHTML = '<div class="ob-empty">Aucune vérification enregistrée</div>';
  }
}