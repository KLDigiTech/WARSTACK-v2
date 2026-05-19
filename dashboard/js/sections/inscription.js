// dashboard/js/sections/inscription.js

import { supabase } from '../supabaseClient.js';

let _multipleTournois = false;

async function init() {
  showState('loading');

  const { data: tournois } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!tournois?.length) {
    showState('no-tournoi');
    return;
  }

  _multipleTournois = tournois.length > 1;

  if (tournois.length === 1) {
    await setupTournoi(tournois[0]);
  } else {
    showState('choose');
    const list = document.getElementById('tournois-list');
    list.innerHTML = tournois.map(t => `
      <button class="tournoi-choice-btn" data-id="${t.id}">
        <div class="tc-name">${t.name}</div>
        <div class="tc-dates">${formatDate(t.start_date)} → ${formatDate(t.end_date)}</div>
        ${t.phase ? `<div class="tc-phase">${t.phase}</div>` : ''}
      </button>
    `).join('');

    list.querySelectorAll('.tournoi-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tournoi = tournois.find(t => t.id === btn.dataset.id);
        if (tournoi) setupTournoi(tournoi);
      });
    });
  }
}

async function setupTournoi(tournoi) {
  document.getElementById('tournoi-name').textContent = tournoi.name;
  document.getElementById('tournoi-dates').textContent =
    `${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}`;

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    await handleLoggedIn(session.user, tournoi);
  } else {
    showState('form');
    initForm(tournoi);
  }
}

function initForm(tournoi) {
  const bfInput = document.getElementById('psn-input');
  const bfHint = document.getElementById('psn-hint');
  const btnSubmit = document.getElementById('btn-submit');
  const platformBtns = document.querySelectorAll('.platform-btn');
  let selectedPlatform = null;

  // BOUTON RETOUR — clone d'abord, style après
  const btnBackOld = document.getElementById('btn-back');
  if (btnBackOld) {
    const btnBack = btnBackOld.cloneNode(true);
    btnBackOld.replaceWith(btnBack);
    btnBack.style.display = _multipleTournois ? 'inline-flex' : 'none';
    btnBack.addEventListener('click', () => {
      resetForm();
      showState('choose');
    });
  }

  // Reset
  bfInput.value = '';
  bfHint.style.display = 'none';
  btnSubmit.disabled = true;
  platformBtns.forEach(b => b.classList.remove('selected'));

  platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      platformBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkReady();
    });
  });

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
    btnSubmit.disabled = !(bfInput.value.trim().length >= 3 && !!selectedPlatform);
  }

  btnSubmit.addEventListener('click', async () => {
    const pseudo = bfInput.value.trim();
    const platform = selectedPlatform;
    if (!pseudo || !platform) return;

    sessionStorage.setItem('ws_inscription', JSON.stringify({
      pseudo,
      platform,
      tournament_id: tournoi.id,
    }));

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href }
    });

    if (error) {
      bfHint.style.display = 'block';
      bfHint.className = 'hint err';
      bfHint.textContent = '❌ Erreur connexion Discord : ' + error.message;
    }
  });
}

function resetForm() {
  document.getElementById('psn-input').value = '';
  document.getElementById('psn-hint').style.display = 'none';
  document.getElementById('btn-submit').disabled = true;
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('selected'));
}

async function handleLoggedIn(user, tournoi) {
  const saved = sessionStorage.getItem('ws_inscription');

  if (!saved) {
    showState('form');
    initForm(tournoi);
    return;
  }

  const { pseudo, platform, tournament_id } = JSON.parse(saved);

  const { data: existing } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournament_id)
    .eq('discord_id', user.id)
    .maybeSingle();

  if (existing) {
    showSuccess({ pseudo, platform, username: user.user_metadata?.full_name || user.email, avatar: user.user_metadata?.avatar_url, already: true });
    sessionStorage.removeItem('ws_inscription');
    return;
  }

  await supabase.from('tournament_entries').insert({
    tournament_id,
    discord_id: user.id,
    username: user.user_metadata?.full_name || user.email,
    tracker_id: null,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  const { data: existingPlayer } = await supabase
    .from('players').select('id').eq('discord_id', user.id).maybeSingle();

  if (!existingPlayer) {
    await supabase.from('players').insert({
      discord_id: user.id,
      pseudo_bf6: pseudo,
      platform,
      username: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: new Date().toISOString(),
    });
  } else {
    await supabase.from('players').update({
      pseudo_bf6: pseudo,
      platform,
      avatar_url: user.user_metadata?.avatar_url || null,
    }).eq('discord_id', user.id);
  }

  sessionStorage.removeItem('ws_inscription');
  showSuccess({ pseudo, platform, username: user.user_metadata?.full_name || user.email, avatar: user.user_metadata?.avatar_url, already: false });
}

function showSuccess({ pseudo, platform, username, avatar, already }) {
  showState('success');
  const platformLabel = { psn: 'PlayStation', xbox: 'Xbox', pc: 'PC' }[platform] || platform;
  document.getElementById('success-recap').innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:0.75rem;display:block">` : ''}
    Discord : <span>${username}</span><br>
    Pseudo BF6 : <span>${pseudo}</span><br>
    Plateforme : <span>${platformLabel}</span><br>
    ${already ? '<div class="pending-note">⚠ Tu étais déjà inscrit.</div>' : ''}
  `;
}

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

init();

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    const saved = sessionStorage.getItem('ws_inscription');
    if (saved) {
      const { tournament_id } = JSON.parse(saved);
      const { data: tournoi } = await supabase.from('tournaments').select('*').eq('id', tournament_id).single();
      if (tournoi) await handleLoggedIn(session.user, tournoi);
    }
  }
});