// dashboard/js/sections/register.js

import { supabase } from '../supabaseClient.js';

const TRACKER_REGEX = /tracker\.gg\/bf6\/profile\/(\d+)/;

// =====================================================
// INIT
// =====================================================

async function init() {
  showState('loading');

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    await handleLoggedIn(session.user);
  } else {
    showState('discord');
    initDiscordBtn();
  }
}

// =====================================================
// BOUTON DISCORD
// =====================================================

function initDiscordBtn() {
  document.getElementById('btn-discord-login')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href }
    });
    if (error) console.error('OAuth error:', error.message);
  });
}

// =====================================================
// APRÈS CONNEXION DISCORD
// =====================================================

async function handleLoggedIn(user) {
  const discordId = user.id;
  const username  = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const avatar    = user.user_metadata?.avatar_url || null;

  // Vérifie si déjà enregistré
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (existing) {
    showAlready(existing, username, avatar);
    return;
  }

  showForm(user);
}

// =====================================================
// FORMULAIRE
// =====================================================

function showForm(user) {
  const discordId = user.id;
  const username  = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const avatar    = user.user_metadata?.avatar_url || null;

  // Banner user Discord
  document.getElementById('reg-user-banner').innerHTML = `
    <div class="reg-user-info">
      ${avatar ? `<img src="${avatar}" class="reg-avatar">` : '<div class="reg-avatar-placeholder"><i class="fab fa-discord"></i></div>'}
      <div>
        <div class="reg-username">${username}</div>
        <div class="reg-discord-tag">Discord connecté ✅</div>
      </div>
    </div>
  `;

  showState('form');

  const pseudoInput  = document.getElementById('reg-pseudo');
  const pseudoHint   = document.getElementById('reg-pseudo-hint');
  const trackerInput = document.getElementById('reg-tracker');
  const trackerHint  = document.getElementById('reg-tracker-hint');
  const btnRegister  = document.getElementById('btn-register');
  const platformBtns = document.querySelectorAll('.platform-btn');

  let selectedPlatform = null;
  let trackerId        = null;

  platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      platformBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkReady();
    });
  });

  pseudoInput.addEventListener('input', () => {
    const val = pseudoInput.value.trim();
    if (val.length >= 3) {
      pseudoHint.style.display = 'block';
      pseudoHint.className = 'hint ok';
      pseudoHint.textContent = `✓ Pseudo : ${val}`;
    } else {
      pseudoHint.style.display = 'none';
    }
    checkReady();
  });

  trackerInput.addEventListener('input', () => {
    const val   = trackerInput.value.trim();
    const match = val.match(TRACKER_REGEX);
    if (match) {
      trackerId = match[1];
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint ok';
      trackerHint.textContent = `✓ Tracker ID détecté : ${trackerId}`;
    } else if (val.length > 0) {
      trackerId = null;
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint err';
      trackerHint.textContent = '❌ URL invalide. Ex: https://tracker.gg/bf6/profile/1023163556057/overview';
    } else {
      trackerId = null;
      trackerHint.style.display = 'none';
    }
    checkReady();
  });

  function checkReady() {
    const ok = pseudoInput.value.trim().length >= 3 && !!selectedPlatform && !!trackerId;
    btnRegister.disabled = !ok;
  }

  btnRegister.addEventListener('click', async () => {
    const pseudo   = pseudoInput.value.trim();
    const platform = selectedPlatform;
    const url      = trackerInput.value.trim();

    if (!pseudo || !platform || !trackerId) return;

    btnRegister.disabled = true;
    btnRegister.innerHTML = '<span class="spinner"></span> Enregistrement...';

    const { error } = await supabase.from('players').insert({
      discord_id  : discordId,
      username,
      pseudo_bf6  : pseudo,
      platform,
      tracker_id  : trackerId,
      tracker_url : url,
      avatar_url  : avatar,
      created_at  : new Date().toISOString(),
    });

    if (error) {
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint err';
      trackerHint.textContent = '❌ Erreur : ' + error.message;
      btnRegister.disabled = false;
      btnRegister.innerHTML = '<i class="fas fa-link"></i> LIER MON COMPTE';
      return;
    }

    showSuccess({ pseudo, platform, username, avatar, trackerId });
  });
}

// =====================================================
// DÉJÀ ENREGISTRÉ
// =====================================================

function showAlready(player, username, avatar) {
  showState('already');

  const platformLabel = { psn: 'PlayStation', xbox: 'Xbox', pc: 'PC' }[player.platform] || player.platform || '—';

  document.getElementById('already-recap').innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:0.75rem;display:block">` : ''}
    Discord : <span>${username}</span><br>
    Pseudo BF6 : <span>${player.pseudo_bf6 || '—'}</span><br>
    Plateforme : <span>${platformLabel}</span><br>
    Tracker ID : <span>${player.tracker_id || '—'}</span>
  `;

  // Bouton mettre à jour → repasse sur le form
  document.getElementById('btn-update')?.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) showUpdateForm(session.user, player);
  });
}

// =====================================================
// MISE À JOUR
// =====================================================

function showUpdateForm(user, existing) {
  const discordId = user.id;
  const username  = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const avatar    = user.user_metadata?.avatar_url || null;

  document.getElementById('reg-user-banner').innerHTML = `
    <div class="reg-user-info">
      ${avatar ? `<img src="${avatar}" class="reg-avatar">` : '<div class="reg-avatar-placeholder"><i class="fab fa-discord"></i></div>'}
      <div>
        <div class="reg-username">${username}</div>
        <div class="reg-discord-tag">Discord connecté ✅</div>
      </div>
    </div>
  `;

  showState('form');

  // Pré-rempli avec les données existantes
  const pseudoInput  = document.getElementById('reg-pseudo');
  const trackerInput = document.getElementById('reg-tracker');
  const pseudoHint   = document.getElementById('reg-pseudo-hint');
  const trackerHint  = document.getElementById('reg-tracker-hint');
  const btnRegister  = document.getElementById('btn-register');
  const platformBtns = document.querySelectorAll('.platform-btn');

  pseudoInput.value  = existing.pseudo_bf6 || '';
  trackerInput.value = existing.tracker_url || '';

  if (pseudoInput.value.length >= 3) {
    pseudoHint.style.display = 'block';
    pseudoHint.className = 'hint ok';
    pseudoHint.textContent = `✓ Pseudo : ${pseudoInput.value}`;
  }

  let selectedPlatform = existing.platform || null;
  let trackerId        = existing.tracker_id || null;

  // Sélectionne la plateforme existante
  platformBtns.forEach(btn => {
    if (btn.dataset.platform === selectedPlatform) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      platformBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkReady();
    });
  });

  if (trackerId) {
    trackerHint.style.display = 'block';
    trackerHint.className = 'hint ok';
    trackerHint.textContent = `✓ Tracker ID : ${trackerId}`;
  }

  trackerInput.addEventListener('input', () => {
    const val   = trackerInput.value.trim();
    const match = val.match(TRACKER_REGEX);
    if (match) {
      trackerId = match[1];
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint ok';
      trackerHint.textContent = `✓ Tracker ID détecté : ${trackerId}`;
    } else if (val.length > 0) {
      trackerId = null;
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint err';
      trackerHint.textContent = '❌ URL invalide.';
    }
    checkReady();
  });

  pseudoInput.addEventListener('input', () => {
    const val = pseudoInput.value.trim();
    pseudoHint.style.display = val.length >= 3 ? 'block' : 'none';
    if (val.length >= 3) { pseudoHint.className = 'hint ok'; pseudoHint.textContent = `✓ Pseudo : ${val}`; }
    checkReady();
  });

  function checkReady() {
    btnRegister.disabled = !(pseudoInput.value.trim().length >= 3 && !!selectedPlatform && !!trackerId);
  }

  checkReady();

  btnRegister.innerHTML = '<i class="fas fa-save"></i> METTRE À JOUR';

  btnRegister.addEventListener('click', async () => {
    const pseudo   = pseudoInput.value.trim();
    const platform = selectedPlatform;
    const url      = trackerInput.value.trim();

    if (!pseudo || !platform || !trackerId) return;

    btnRegister.disabled = true;
    btnRegister.innerHTML = '<span class="spinner"></span> Mise à jour...';

    await supabase.from('players').update({
      pseudo_bf6  : pseudo,
      platform,
      tracker_id  : trackerId,
      tracker_url : url,
      avatar_url  : avatar,
    }).eq('discord_id', discordId);

    showSuccess({ pseudo, platform, username, avatar, trackerId });
  });
}

// =====================================================
// SUCCESS
// =====================================================

function showSuccess({ pseudo, platform, username, avatar, trackerId }) {
  showState('success');
  const platformLabel = { psn: 'PlayStation', xbox: 'Xbox', pc: 'PC' }[platform] || platform;
  document.getElementById('success-recap').innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:0.75rem;display:block">` : ''}
    Discord : <span>${username}</span><br>
    Pseudo BF6 : <span>${pseudo}</span><br>
    Plateforme : <span>${platformLabel}</span><br>
    Tracker ID : <span>${trackerId}</span>
  `;
}

// =====================================================
// HELPERS
// =====================================================

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

// =====================================================
// START
// =====================================================

document.addEventListener('DOMContentLoaded', () => init());

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    await handleLoggedIn(session.user);
  }
});