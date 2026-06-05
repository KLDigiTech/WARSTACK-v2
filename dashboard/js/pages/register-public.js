import { supabase } from '../supabaseClient.js';

const BOT_URL = 'https://warstack-bot.onrender.com';

let currentUser      = null;
let currentDiscordId = null;
let selectedTeam     = null;
let selectedPlatform = null;

// ── HELPERS ───────────────────────────────────────────────

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

function setProgress(step, total = 4) {
  const pct    = Math.round(((step - 1) / (total - 1)) * 100);
  const labels = { 1: 'CONNEXION', 2: 'ÉQUIPE', 3: 'PLATEFORME', 4: 'TRACKER' };
  document.getElementById('reg-progress').style.display = 'block';
  document.getElementById('progress-bar').style.width   = `${pct}%`;
  document.getElementById('progress-label').textContent = labels[step] || '';
  document.getElementById('progress-pct').textContent   = `${pct}%`;
  document.getElementById('logo-sub').textContent       = `ÉTAPE ${step} / ${total}`;
}

// ── INIT ──────────────────────────────────────────────────

async function init() {
  showState('loading');

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    showState('discord');
    document.getElementById('btn-discord-login').addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options : { redirectTo: window.location.href }
      });
    });
    return;
  }

  currentUser      = session.user;
  currentDiscordId = currentUser.user_metadata?.provider_id
                  || currentUser.user_metadata?.sub
                  || currentUser.id;

  // Vérif membre serveur
  try {
    const res    = await fetch(`${BOT_URL}/api/member/${currentDiscordId}`);
    const member = await res.json();
    if (!member?.id) { showState('not-member'); return; }
  } catch {}

  // Déjà inscrit complet → dashboard
  const { data: existing } = await supabase
    .from('players').select('*').eq('discord_id', currentDiscordId).maybeSingle();

  if (existing?.tracker_id && existing?.team && existing?.platform) {
    window.location.href = '/dashboard/index.html';
    return;
  }

  // Charger équipes
  await loadTeams();

  // Afficher banner user
  renderUserBanner();

  setProgress(2);
  showState('team');
  initTeamStep();
}

// ── USER BANNER ───────────────────────────────────────────

function renderUserBanner() {
  const banner = document.getElementById('reg-user-banner');
  if (!banner) return;
  const name   = currentUser.user_metadata?.full_name
               || currentUser.user_metadata?.name
               || 'Joueur';
  const avatar = currentUser.user_metadata?.avatar_url || '';
  banner.innerHTML = `
    <img src="${avatar}" onerror="this.src=''" alt="avatar">
    <div>
      <div class="user-bar-name">${name}</div>
      <div class="user-bar-sub" style="color:var(--green)">✓ Discord connecté</div>
    </div>
  `;
}

// ── STEP 2 — ÉQUIPE ───────────────────────────────────────

async function loadTeams() {
  const { data: config } = await supabase
    .from('config').select('value').eq('key', 'ob_teams').maybeSingle();

  let teams = [];
  try { teams = JSON.parse(config?.value || '[]'); } catch {}

  if (!teams.length) {
    teams = [
      { emoji: '🔥', label: 'PÖF',     role_id: '' },
      { emoji: '👑', label: 'STAFF',    role_id: '' },
      { emoji: '👁️', label: 'VISITEUR', role_id: '' },
    ];
  }

  const list = document.getElementById('reg-teams-list');
  list.innerHTML = teams.map(t => `
    <button class="team-choice-btn" data-team="${t.label}" data-role="${t.role_id || ''}">
      ${t.emoji} ${t.label}
    </button>
  `).join('');
}

function initTeamStep() {
  document.querySelectorAll('.team-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.team-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTeam = btn.dataset.team;
      setTimeout(() => goToPlatform(), 350);
    });
  });

  document.getElementById('btn-skip-team')?.addEventListener('click', () => {
    selectedTeam = null;
    goToPlatform();
  });
}

// ── STEP 3 — PLATEFORME ───────────────────────────────────

function goToPlatform() {
  setProgress(3);
  showState('platform');

  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      setTimeout(() => goToTracker(), 350);
    });
  });

  document.getElementById('btn-skip-platform')?.addEventListener('click', () => {
    selectedPlatform = null;
    goToTracker();
  });
}

// ── STEP 4 — TRACKER ──────────────────────────────────────

function goToTracker() {
  setProgress(4);
  showState('tracker');

  const input   = document.getElementById('tracker-url');
  const hint    = document.getElementById('tracker-hint');
  const saveBtn = document.getElementById('btn-save-tracker');
  let trackerId = null;

  input.addEventListener('input', () => {
    const val   = input.value.trim();
    const match = val.match(/tracker\.gg\/bf6\/profile\/(\d+)/);
    if (match) {
      trackerId          = match[1];
      hint.style.display = 'block';
      hint.className     = 'hint ok';
      hint.textContent   = `✓ Tracker ID : ${trackerId}`;
      saveBtn.disabled   = false;
    } else if (val.length > 10) {
      trackerId          = null;
      hint.style.display = 'block';
      hint.className     = 'hint err';
      hint.textContent   = '❌ URL non reconnue';
      saveBtn.disabled   = true;
    } else {
      hint.style.display = 'none';
      saveBtn.disabled   = true;
    }
  });

  saveBtn.addEventListener('click', () => finalize(trackerId, input.value.trim()));
  document.getElementById('btn-skip-tracker')?.addEventListener('click', () => finalize(null, null));
}

// ── FINALISATION ──────────────────────────────────────────

async function finalize(trackerId, trackerUrl) {
  const saveBtn = document.getElementById('btn-save-tracker');
  if (saveBtn) {
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
  }

  try {
    const username  = currentUser.user_metadata?.full_name
                    || currentUser.user_metadata?.name
                    || 'Joueur';
    const avatarUrl = currentUser.user_metadata?.avatar_url || null;

    const payload = {
      username,
      avatar_url  : avatarUrl,
      team        : selectedTeam     || null,
      platform    : selectedPlatform || null,
      tracker_id  : trackerId        || null,
      tracker_url : trackerUrl       || null,
      updated_at  : new Date().toISOString(),
    };

    // Upsert player
    const { data: existing } = await supabase
      .from('players').select('id').eq('discord_id', currentDiscordId).maybeSingle();

    if (existing) {
      await supabase.from('players').update(payload).eq('discord_id', currentDiscordId);
    } else {
      await supabase.from('players').insert({
        ...payload,
        discord_id : currentDiscordId,
        created_at : new Date().toISOString(),
      });
    }

    // Attribuer rôles Discord via bot
    await fetch(`${BOT_URL}/api/member/${currentDiscordId}/role`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ team: selectedTeam, platform: selectedPlatform }),
    }).catch(() => {});

    // Log onboarding
    await supabase.from('onboarding_logs').insert({
      guild_id  : '1501685144501620798',
      discord_id: currentDiscordId,
      username,
      avatar_url: avatarUrl,
      team      : selectedTeam     || null,
      platform  : selectedPlatform || null,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    // Afficher succès
    document.getElementById('reg-success-recap').innerHTML = `
      ${selectedTeam     ? `⚔️ Équipe : <span>${selectedTeam}</span><br>`     : ''}
      ${selectedPlatform ? `🎮 Plateforme : <span>${selectedPlatform}</span><br>` : ''}
      ${trackerId        ? `📊 Tracker lié : <span>${trackerId}</span><br>`   : '⚠️ Tracker non lié — à faire depuis ton profil.<br>'}
    `;

    document.getElementById('reg-progress').style.display = 'none';
    document.getElementById('logo-sub').textContent       = 'PROFIL CRÉÉ !';
    showState('success');

  } catch (err) {
    console.error(err);
    if (saveBtn) {
      saveBtn.disabled  = false;
      saveBtn.innerHTML = '<i class="fas fa-link"></i> LIER MON PROFIL';
    }
  }
}

// ── START ─────────────────────────────────────────────────

init();
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') init();
});