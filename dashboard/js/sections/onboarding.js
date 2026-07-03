import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI }                          from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { fetchSupabase }                       from '../api.js';
import { getActiveGuildId }                    from '../services/guildService.js';
import { showSkeleton }                        from '../ui/skeleton.js';
import { showConfirm }                         from '../ui/confirm.js';
import { enableRoleCreation }                  from '../components/roleCreator.js';

let _teams     = [];
let _games     = [];
let _questions = [];
let _roles     = [];

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)
    ),
  ]);
}

export async function initOnboarding() {

  showSkeleton('ob-recent-list', 'row', 5);
  ['ob-stat-total', 'ob-stat-today', 'ob-stat-pending'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<span class="skeleton sk-title" style="width:40px;display:inline-block"></span>`;
  });

  const [configs, channelsData, rolesData] = await Promise.all([
    withTimeout(loadConfigs()).catch(() => []),
    withTimeout(callBotAPI('channels')).catch(() => ({ channels: [] })),
    withTimeout(callBotAPI('roles')).catch(() => ({ roles: [] })),
  ]);

  _roles = rolesData?.roles || [];

  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts  = `<option value="">Aucun</option>` + textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const roleOpts = `<option value="">Aucun rôle</option>` + _roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  document.getElementById('ob-channel').innerHTML        = chOpts;
  document.getElementById('ob-staff-channel').innerHTML  = chOpts;
  ['ob-role-unverified','ob-role-member','ob-pc-role','ob-psn-role','ob-xbox-role'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = roleOpts;
      enableRoleCreation(el, (newRole) => _roles.push(newRole));
    }
  });

  document.getElementById('ob-channel').value              = getConfig(configs, 'ob_channel')          || '';
  document.getElementById('ob-role-unverified').value      = getConfig(configs, 'ob_role_unverified')  || '';
  document.getElementById('ob-role-member').value          = getConfig(configs, 'ob_role_member')       || '';
  document.getElementById('ob-rules-enabled').checked      = getConfig(configs, 'ob_rules_enabled') !== 'false';
  document.getElementById('ob-rules-text').value           = getConfig(configs, 'ob_rules_text')        || '';
  document.getElementById('ob-confirm-msg').value          = getConfig(configs, 'ob_confirm_msg')       || '';
  document.getElementById('ob-dm-enabled').checked         = getConfig(configs, 'ob_dm_enabled') === 'true';
  document.getElementById('ob-dm-msg').value               = getConfig(configs, 'ob_dm_msg')            || '';
  document.getElementById('ob-pc-enabled').checked         = getConfig(configs, 'ob_pc_enabled')   !== 'false';
  document.getElementById('ob-psn-enabled').checked        = getConfig(configs, 'ob_psn_enabled')  !== 'false';
  document.getElementById('ob-xbox-enabled').checked       = getConfig(configs, 'ob_xbox_enabled') !== 'false';
  document.getElementById('ob-pc-role').value              = getConfig(configs, 'ob_pc_role')            || '';
  document.getElementById('ob-psn-role').value             = getConfig(configs, 'ob_psn_role')           || '';
  document.getElementById('ob-xbox-role').value            = getConfig(configs, 'ob_xbox_role')          || '';
  document.getElementById('ob-manual-validation').checked  = getConfig(configs, 'ob_manual_validation') === 'true';
  document.getElementById('ob-staff-channel').value        = getConfig(configs, 'ob_staff_channel')      || '';
  document.getElementById('ob-age-enabled').checked        = getConfig(configs, 'ob_age_enabled') === 'true';
  document.getElementById('ob-welcome-title').value        = getConfig(configs, 'ob_welcome_title')      || '';
  document.getElementById('ob-welcome-desc').value         = getConfig(configs, 'ob_welcome_desc')       || '';

  try { _teams     = JSON.parse(getConfig(configs, 'ob_teams')            || '[]'); } catch { _teams = []; }
  try { _games     = JSON.parse(getConfig(configs, 'ob_games')            || '[]'); } catch { _games = []; }
  try { _questions = JSON.parse(getConfig(configs, 'ob_custom_questions') || '[]'); } catch { _questions = []; }

  if (!_teams.length) _teams = [
    { emoji: '🔥', label: 'PÖF',     role_id: '', role_name: '' },
    { emoji: '👑', label: 'STAFF',    role_id: '', role_name: '' },
    { emoji: '👁️', label: 'VISITEUR', role_id: '', role_name: '' },
  ];
  if (!_games.length) _games = [
    { emoji: '🎖️', label: 'Battlefield 6', role_id: '', role_name: '' },
    { emoji: '💣', label: 'Call of Duty',   role_id: '', role_name: '' },
  ];

  renderTeams();
  renderGames();
  renderQuestions();
  updatePreviews();

  document.getElementById('ob-rules-group').style.display =
    document.getElementById('ob-rules-enabled').checked ? 'block' : 'none';
  document.getElementById('ob-rules-enabled').addEventListener('change', e => {
    document.getElementById('ob-rules-group').style.display = e.target.checked ? 'block' : 'none';
    updatePreviews();
  });

  document.getElementById('ob-dm-group').style.display =
    document.getElementById('ob-dm-enabled').checked ? 'block' : 'none';
  document.getElementById('ob-dm-enabled').addEventListener('change', e => {
    document.getElementById('ob-dm-group').style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('ob-rules-text').addEventListener('input', updatePreviews);

  // Variables : gérées globalement par components/varDropdown.js

  document.querySelectorAll('.ob-prev-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ob-prev-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ob-preview-step').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`prev-step-${btn.dataset.step}`)?.classList.add('active');
    });
  });

  // ── Accordéon onboarding ────────────────────────────────
  document.querySelectorAll('.ob-item').forEach(item => {
    const head = item.querySelector('.ob-head');
    if (!head) return;
    head.addEventListener('click', () => item.classList.toggle('open'));
  });

  // Ouvrir automatiquement les sections déjà configurées
  if (getConfig(configs, 'ob_rules_text'))      document.querySelector('[data-ob="rules"]')?.classList.add('open');
  if (getConfig(configs, 'ob_confirm_msg'))     document.querySelector('[data-ob="confirm"]')?.classList.add('open');
  if (getConfig(configs, 'ob_manual_validation') === 'true' ||
      getConfig(configs, 'ob_age_enabled') === 'true') {
    document.querySelector('[data-ob="advanced"]')?.classList.add('open');
  }

  document.getElementById('ob-add-team').addEventListener('click', () => {
    const form = document.getElementById('ob-team-add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const roleEl = document.getElementById('ob-new-team-role');
    roleEl.innerHTML = roleOpts;
    enableRoleCreation(roleEl, (newRole) => _roles.push(newRole));
  });

  document.getElementById('ob-confirm-team').addEventListener('click', () => {
    const emoji     = document.getElementById('ob-new-team-emoji').value.trim() || '🔥';
    const label     = document.getElementById('ob-new-team-label').value.trim();
    const roleEl    = document.getElementById('ob-new-team-role');
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

  document.getElementById('ob-add-game').addEventListener('click', () => {
    const form = document.getElementById('ob-game-add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const roleEl = document.getElementById('ob-new-game-role');
    roleEl.innerHTML = roleOpts;
    enableRoleCreation(roleEl, (newRole) => _roles.push(newRole));
  });

  document.getElementById('ob-confirm-game').addEventListener('click', () => {
    const emoji     = document.getElementById('ob-new-game-emoji').value.trim() || '🎮';
    const label     = document.getElementById('ob-new-game-label').value.trim();
    const roleEl    = document.getElementById('ob-new-game-role');
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

  document.getElementById('ob-add-question').addEventListener('click', () => {
    const form = document.getElementById('ob-question-add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('ob-confirm-question').addEventListener('click', () => {
    const label       = document.getElementById('ob-new-q-label').value.trim();
    const placeholder = document.getElementById('ob-new-q-placeholder').value.trim();
    const multiline   = document.getElementById('ob-new-q-multiline').checked;
    const required    = document.getElementById('ob-new-q-required').checked;
    if (!label) return showToast('❌ Libellé requis', 'error');
    _questions.push({ label, placeholder, multiline, required });
    document.getElementById('ob-question-add-form').style.display = 'none';
    document.getElementById('ob-new-q-label').value = '';
    document.getElementById('ob-new-q-placeholder').value = '';
    document.getElementById('ob-new-q-multiline').checked = false;
    document.getElementById('ob-new-q-required').checked = true;
    renderQuestions();
  });

  document.getElementById('ob-cancel-question').addEventListener('click', () => {
    document.getElementById('ob-question-add-form').style.display = 'none';
  });

  document.getElementById('ob-save').addEventListener('click', saveOnboarding);
  document.getElementById('ob-btn-post').addEventListener('click', postPanel);

  document.getElementById('ob-btn-test').addEventListener('click', async () => {
    const channelId = document.getElementById('ob-channel').value;
    if (!channelId) return showToast('❌ Configure d\'abord un salon d\'onboarding', 'error');
    const btn = document.getElementById('ob-btn-test');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
      const result = await callBotAPI('onboarding/test', 'POST', {});
      if (result?.success) showToast('✅ Message de test envoyé dans le salon !');
      else showToast('❌ ' + (result?.error || 'Erreur'), 'error');
    } catch {
      showToast('❌ Erreur réseau', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-flask"></i> Tester';
    }
  });

  loadStats();
}

function renderTeams() {
  const container = document.getElementById('ob-teams-list');
  if (!_teams.length) { container.innerHTML = '<div class="ob-empty">Aucune équipe configurée</div>'; return; }
  container.innerHTML = _teams.map((t, i) => `
    <div class="ob-team-item">
      <span class="ob-item-emoji">${t.emoji}</span>
      <span class="ob-item-name">${t.label}</span>
      <span class="ob-item-role">${t.role_name || 'Aucun rôle'}</span>
      <button class="ob-item-delete" data-index="${i}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
  container.querySelectorAll('.ob-item-delete').forEach(btn => {
    btn.addEventListener('click', () => { _teams.splice(parseInt(btn.dataset.index), 1); renderTeams(); updatePreviews(); });
  });
}
function renderGames() {
  const container = document.getElementById('ob-games-list');
  if (!_games.length) { container.innerHTML = '<div class="ob-empty">Aucun jeu configuré</div>'; return; }
  container.innerHTML = _games.map((g, i) => `
    <div class="ob-game-item">
      <span class="ob-item-emoji">${g.emoji}</span>
      <span class="ob-item-name">${g.label}</span>
      <span class="ob-item-role">${g.role_name || 'Aucun rôle'}</span>
      <button class="ob-item-delete" data-index="${i}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
  container.querySelectorAll('.ob-item-delete').forEach(btn => {
    btn.addEventListener('click', () => { _games.splice(parseInt(btn.dataset.index), 1); renderGames(); updatePreviews(); });
  });
}

function renderQuestions() {
  const container = document.getElementById('ob-questions-list');
  if (!container) return;
  if (!_questions.length) { container.innerHTML = '<div class="ob-empty">Aucune question personnalisée</div>'; return; }
  container.innerHTML = _questions.map((q, i) => `
    <div class="ob-team-item">
      <span class="ob-item-emoji">${q.required ? '❗' : '❓'}</span>
      <span class="ob-item-name" style="flex:1">${q.label}</span>
      <span class="ob-item-role">${q.multiline ? 'Long' : 'Court'}</span>
      <button class="ob-item-delete" data-index="${i}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
  container.querySelectorAll('.ob-item-delete').forEach(btn => {
    btn.addEventListener('click', () => { _questions.splice(parseInt(btn.dataset.index), 1); renderQuestions(); });
  });
}

function updatePreviews() {
  const txt = document.getElementById('ob-rules-text')?.value?.trim() || 'Lis et accepte le règlement pour continuer.';
  const prevRules = document.getElementById('prev-rules-text');
  if (prevRules) prevRules.textContent = txt.length > 200 ? txt.slice(0, 200) + '...' : txt;

  const teamsEl = document.getElementById('prev-teams-btns');
  if (teamsEl) teamsEl.innerHTML = _teams.length
    ? _teams.map(t => `<div class="ob-mock-btn-team">${t.emoji} ${t.label}</div>`).join('')
    : '<div class="ob-mock-btn-team">🔥 PÖF</div>';

  const platsEl = document.getElementById('prev-platforms-btns');
  if (platsEl) {
    const plats = [];
    if (document.getElementById('ob-pc-enabled')?.checked)   plats.push('<div class="ob-mock-btn-platform"><i class="fas fa-desktop"></i> PC</div>');
    if (document.getElementById('ob-psn-enabled')?.checked)  plats.push('<div class="ob-mock-btn-platform"><i class="fab fa-playstation"></i> PS</div>');
    if (document.getElementById('ob-xbox-enabled')?.checked) plats.push('<div class="ob-mock-btn-platform"><i class="fab fa-xbox"></i> Xbox</div>');
    platsEl.innerHTML = plats.join('') || '<div class="ob-mock-btn-platform">PC</div>';
  }

  const gamesEl = document.getElementById('prev-games-btns');
  if (gamesEl) gamesEl.innerHTML = _games.length
    ? _games.map(g => `<div class="ob-mock-btn-game">${g.emoji} ${g.label}</div>`).join('')
    : '<div class="ob-mock-btn-game">🎮 Jeu</div>';
}

async function saveOnboarding() {
  const btn = document.getElementById('ob-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
  try {
    await Promise.all([
      saveConfig('ob_channel',           document.getElementById('ob-channel').value),
      saveConfig('ob_role_unverified',   document.getElementById('ob-role-unverified').value),
      saveConfig('ob_role_member',       document.getElementById('ob-role-member').value),
      saveConfig('ob_rules_enabled',     String(document.getElementById('ob-rules-enabled').checked)),
      saveConfig('ob_rules_text',        document.getElementById('ob-rules-text').value),
      saveConfig('ob_confirm_msg',       document.getElementById('ob-confirm-msg').value),
      saveConfig('ob_dm_enabled',        String(document.getElementById('ob-dm-enabled').checked)),
      saveConfig('ob_dm_msg',            document.getElementById('ob-dm-msg').value),
      saveConfig('ob_pc_enabled',        String(document.getElementById('ob-pc-enabled').checked)),
      saveConfig('ob_psn_enabled',       String(document.getElementById('ob-psn-enabled').checked)),
      saveConfig('ob_xbox_enabled',      String(document.getElementById('ob-xbox-enabled').checked)),
      saveConfig('ob_pc_role',           document.getElementById('ob-pc-role').value),
      saveConfig('ob_psn_role',          document.getElementById('ob-psn-role').value),
      saveConfig('ob_xbox_role',         document.getElementById('ob-xbox-role').value),
      saveConfig('ob_teams',             JSON.stringify(_teams)),
      saveConfig('ob_games',             JSON.stringify(_games)),
      saveConfig('ob_custom_questions',  JSON.stringify(_questions)),
      saveConfig('ob_manual_validation', String(document.getElementById('ob-manual-validation').checked)),
      saveConfig('ob_staff_channel',     document.getElementById('ob-staff-channel').value),
      saveConfig('ob_age_enabled',       String(document.getElementById('ob-age-enabled').checked)),
      saveConfig('ob_welcome_title',     document.getElementById('ob-welcome-title').value),
      saveConfig('ob_welcome_desc',      document.getElementById('ob-welcome-desc').value),
    ]);
    showToast('✅ Configuration sauvegardée !');
  } catch {
    showToast('❌ Erreur lors de la sauvegarde', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
  }
}

async function postPanel() {
  const channelId = document.getElementById('ob-channel').value;
  if (!channelId) return showToast('❌ Choisis un salon d\'abord', 'error');
  const btn = document.getElementById('ob-btn-post');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
  try {
    const result = await callBotAPI('onboarding/post', 'POST', {
      channel_id       : channelId,
      rules_enabled    : document.getElementById('ob-rules-enabled').checked,
      rules_text       : document.getElementById('ob-rules-text').value,
      teams            : _teams,
      games            : _games,
      pc_enabled       : document.getElementById('ob-pc-enabled').checked,
      psn_enabled      : document.getElementById('ob-psn-enabled').checked,
      xbox_enabled     : document.getElementById('ob-xbox-enabled').checked,
      role_member      : document.getElementById('ob-role-member').value,
      role_unverified  : document.getElementById('ob-role-unverified').value,
      confirm_msg      : document.getElementById('ob-confirm-msg').value,
      dm_enabled       : document.getElementById('ob-dm-enabled').checked,
      dm_msg           : document.getElementById('ob-dm-msg').value,
      manual_validation: document.getElementById('ob-manual-validation').checked,
      staff_channel    : document.getElementById('ob-staff-channel').value,
      age_enabled      : document.getElementById('ob-age-enabled').checked,
      custom_questions : _questions,
      welcome_title    : document.getElementById('ob-welcome-title').value,
      welcome_desc     : document.getElementById('ob-welcome-desc').value,
    });
    if (result?.success) showToast('✅ Panel onboarding envoyé !');
    else showToast('❌ ' + (result?.error || 'Erreur'), 'error');
  } catch {
    showToast('❌ Erreur réseau', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Poster le panel';
  }
}

async function loadStats() {
  try {
    const guildId = await getActiveGuildId();
    const [logs, pending] = await Promise.all([
      fetchSupabase(`onboarding_logs?guild_id=eq.${guildId}&order=created_at.desc&limit=50`),
      fetchSupabase(`onboarding_sessions?guild_id=eq.${guildId}&manual_status=eq.pending&select=*&order=updated_at.desc`),
    ]);

    const list     = Array.isArray(logs)    ? logs    : [];
    const pendList = Array.isArray(pending) ? pending : [];
    const today    = new Date().toISOString().slice(0, 10);

    const totalEl = document.getElementById('ob-stat-total');
    const todayEl = document.getElementById('ob-stat-today');
    const pendEl  = document.getElementById('ob-stat-pending');
    if (totalEl) totalEl.textContent = list.length;
    if (todayEl) todayEl.textContent = list.filter(l => l.created_at?.startsWith(today)).length;
    if (pendEl)  pendEl.textContent  = pendList.length;

    const pendPanel = document.getElementById('ob-pending-panel');
    if (pendPanel) pendPanel.style.display = pendList.length ? 'block' : 'none';

    const pendingEl = document.getElementById('ob-pending-list');
    if (pendingEl) {
      if (!pendList.length) {
        pendingEl.innerHTML = '<div class="ob-empty">Aucune inscription en attente</div>';
      } else {
        pendingEl.innerHTML = pendList.map(s => `
          <div class="ob-recent-item">
            <img class="ob-recent-avatar" src="https://cdn.discordapp.com/embed/avatars/0.png" alt="">
            <div class="ob-recent-info">
              <div class="ob-recent-name">${s.username || s.discord_id}</div>
              <div class="ob-recent-meta">
                ${s.pseudo   ? `🪪 ${s.pseudo}`    : ''}
                ${s.team     ? `· ⚔️ ${s.team}`    : ''}
                ${s.platform ? `· 🎮 ${s.platform}` : ''}
              </div>
            </div>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-sm btn-primary btn-ob-approve" data-id="${s.discord_id}">✅</button>
              <button class="btn btn-sm btn-danger btn-ob-reject"   data-id="${s.discord_id}">❌</button>
            </div>
          </div>
        `).join('');

        pendingEl.querySelectorAll('.btn-ob-approve').forEach(btn => {
          btn.addEventListener('click', async () => {
            await callBotAPI('onboarding/approve', 'POST', { discord_id: btn.dataset.id });
            showToast('✅ Inscription approuvée');
            loadStats();
          });
        });

        pendingEl.querySelectorAll('.btn-ob-reject').forEach(btn => {
          btn.addEventListener('click', () => {
            showConfirm({
              title: 'Refuser l\'inscription',
              message: 'Le membre gardera son rôle "En attente".',
              confirmText: 'Refuser',
              cancelText: 'Annuler',
              onConfirm: async () => {
                await callBotAPI('onboarding/reject', 'POST', { discord_id: btn.dataset.id });
                showToast('❌ Inscription refusée');
                loadStats();
              },
            });
          });
        });
      }
    }

    const teamCounts = {};
    list.forEach(l => { if (l.team) teamCounts[l.team] = (teamCounts[l.team] || 0) + 1; });
    const teamStatsEl = document.getElementById('ob-team-stats');
    if (teamStatsEl && Object.keys(teamCounts).length) {
      const max = Math.max(...Object.values(teamCounts));
      teamStatsEl.innerHTML = Object.entries(teamCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([team, count]) => `
          <div class="ob-team-stat-row">
            <span class="ob-ts-label">${team}</span>
            <div class="ob-ts-bar-wrap"><div class="ob-ts-bar" style="width:${Math.round((count/max)*100)}%"></div></div>
            <span class="ob-ts-count">${count}</span>
          </div>
        `).join('');
    }

    const recentEl = document.getElementById('ob-recent-list');
    if (recentEl) {
      if (!list.length) { recentEl.innerHTML = '<div class="ob-empty">Aucune vérification enregistrée</div>'; return; }
      recentEl.innerHTML = list.slice(0, 10).map(l => `
        <div class="ob-recent-item">
          <img class="ob-recent-avatar"
            src="${l.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
            onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" alt="">
          <div class="ob-recent-info">
            <div class="ob-recent-name">${l.username || 'Inconnu'}</div>
            <div class="ob-recent-meta">
              ${l.team     ? `⚔️ ${l.team}`       : ''}
              ${l.platform ? `· 🎮 ${l.platform}` : ''}
              ${l.games    ? `· ${l.games}`        : ''}
            </div>
          </div>
          <span class="ob-recent-badge">✅ Vérifié</span>
        </div>
      `).join('');
    }

  } catch {
    ['ob-stat-total','ob-stat-today','ob-stat-pending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
  }
}