// dashboard/js/sections/inscription.js

import { supabase } from '../supabaseClient.js';

// =====================================================
// INIT
// =====================================================

async function init() {
  showState('loading');

  // Récupère le tournoi actif
  const { data: tournois } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .limit(1);

  const tournoi = tournois?.[0];

  if (!tournoi) {
    showState('no-tournoi');
    return;
  }

  // Affiche infos tournoi
  document.getElementById('tournoi-name').textContent = tournoi.name;
  document.getElementById('tournoi-dates').textContent =
    `${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}`;

  // Vérifie si user déjà connecté Discord
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    await handleLoggedIn(session.user, tournoi);
  } else {
    showState('form');
    initForm(tournoi);
  }
}

// =====================================================
// FORM
// =====================================================

function initForm(tournoi) {

  const btnSubmit  = document.getElementById('btn-submit');
  const bfInput    = document.getElementById('psn-input');
  const bfHint     = document.getElementById('psn-hint');
  const platformBtns = document.querySelectorAll('.platform-btn');

  let selectedPlatform = null;

  // Plateforme
  platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      platformBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkReady();
    });
  });

  // Pseudo BF6
  bfInput.addEventListener('input', () => {
    const val = bfInput.value.trim();
    if (val.length >= 3) {
      bfHint.style.display = 'block';
      bfHint.className = 'hint ok';
      bfHint.textContent = `✓ Pseudo : ${val}`;
    } else {
      bfHint.style.display = 'none';
    }
    checkReady();
  });

  function checkReady() {
    const pseudoOk   = bfInput.value.trim().length >= 3;
    const platformOk = !!selectedPlatform;
    btnSubmit.disabled = !(pseudoOk && platformOk);
  }

  // Submit → Discord OAuth
  btnSubmit.addEventListener('click', async () => {
    const pseudo   = bfInput.value.trim();
    const platform = selectedPlatform;

    if (!pseudo || !platform) return;

    // Sauvegarde temporaire
    sessionStorage.setItem('ws_inscription', JSON.stringify({
      pseudo,
      platform,
      tournament_id: tournoi.id,
    }));

    // OAuth Discord
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.href,
      }
    });

    if (error) {
      bfHint.style.display = 'block';
      bfHint.className = 'hint err';
      bfHint.textContent = '❌ Erreur connexion Discord : ' + error.message;
    }
  });
}

// =====================================================
// APRÈS CONNEXION DISCORD
// =====================================================

async function handleLoggedIn(user, tournoi) {

  const saved = sessionStorage.getItem('ws_inscription');

  if (!saved) {
    // Déjà connecté mais pas de données → affiche le form pré-rempli
    showState('form');
    initForm(tournoi);
    return;
  }

  const { pseudo, platform, tournament_id } = JSON.parse(saved);

  // Vérifie si déjà inscrit
  const { data: existing } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournament_id)
    .eq('discord_id', user.id)
    .maybeSingle();

  if (existing) {
    showSuccess({
      pseudo,
      platform,
      username: user.user_metadata?.full_name || user.email,
      avatar: user.user_metadata?.avatar_url,
      already: true,
    });
    sessionStorage.removeItem('ws_inscription');
    return;
  }

  // Insertion tournament_entries
  await supabase.from('tournament_entries').insert({
    tournament_id : tournament_id,
    discord_id    : user.id,
    username      : user.user_metadata?.full_name || user.email,
    tracker_id    : null,
    status        : 'active',
    created_at    : new Date().toISOString(),
  });

  // Insertion / update players
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('discord_id', user.id)
    .maybeSingle();

  if (!existingPlayer) {
    await supabase.from('players').insert({
      discord_id  : user.id,
      pseudo_bf6  : pseudo,
      platform    : platform,
      username    : user.user_metadata?.full_name || user.email,
      avatar_url  : user.user_metadata?.avatar_url || null,
      created_at  : new Date().toISOString(),
    });
  } else {
    await supabase.from('players').update({
      pseudo_bf6 : pseudo,
      platform   : platform,
      avatar_url : user.user_metadata?.avatar_url || null,
    }).eq('discord_id', user.id);
  }

  sessionStorage.removeItem('ws_inscription');

  showSuccess({
    pseudo,
    platform,
    username: user.user_metadata?.full_name || user.email,
    avatar: user.user_metadata?.avatar_url,
    already: false,
  });
}

// =====================================================
// SUCCESS
// =====================================================

function showSuccess({ pseudo, platform, username, avatar, already }) {
  showState('success');

  const platformLabel = { psn: 'PlayStation', xbox: 'Xbox', pc: 'PC' }[platform] || platform;

  document.getElementById('success-recap').innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:0.75rem;display:block">` : ''}
    Discord : <span>${username}</span><br>
    Pseudo BF6 : <span>${pseudo}</span><br>
    Plateforme : <span>${platformLabel}</span><br>
    ${already ? '<span style="color:var(--yellow)">⚠ Tu étais déjà inscrit.</span>' : ''}
  `;
}

// =====================================================
// HELPERS
// =====================================================

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

// =====================================================
// START
// =====================================================

init();

// Écoute le retour OAuth
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    const saved = sessionStorage.getItem('ws_inscription');
    if (saved) {
      const { tournament_id } = JSON.parse(saved);
      const { data: tournois } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournament_id)
        .single();
      if (tournois) await handleLoggedIn(session.user, tournois);
    }
  }
});