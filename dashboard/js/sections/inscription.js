// dashboard/js/sections/inscription.js

import { supabase } from '../supabaseClient.js';

let _multipleTournois = false;
let _allTournois      = [];
let _currentTournoi   = null;
let _selectedTeamId   = null;
let _selectedTeamName = null;
let _teamMode         = 'join';

async function init() {
  showState('loading');

  const { data: tournois } = await supabase
    .from('tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false });

  if (!tournois?.length) { showState('no-tournoi'); return; }

  _allTournois      = tournois;
  _multipleTournois = tournois.length > 1;

  document.getElementById('btn-back-choose')?.addEventListener('click', () => window.close());

  if (tournois.length === 1) await setupTournoi(tournois[0]);
  else showChoose(tournois);
}

function showChoose(tournois) {
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
      const t = tournois.find(t => t.id === btn.dataset.id);
      if (t) setupTournoi(t);
    });
  });
}

async function setupTournoi(tournoi) {
  _currentTournoi = tournoi;
  document.getElementById('tournoi-name').textContent  = tournoi.name;
  document.getElementById('tournoi-dates').textContent = `${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await handleLoggedIn(session.user, tournoi);
  else { showState('form'); await loadTeams(tournoi.id); initForm(tournoi); }
}

async function loadTeams(tournamentId) {
  const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('created_at');
  const container = document.getElementById('teams-list');

  if (!teams?.length) {
    container.innerHTML = '<div class="hint">Aucune équipe — sois le premier à en créer une !</div>';
    switchTeamMode('create');
    return;
  }

  container.innerHTML = teams.map(t => `
    <button class="team-choice-btn" data-id="${t.id}" data-name="${t.name}">
      <i class="fas fa-shield-alt"></i> ${t.name}
    </button>
  `).join('');

  container.querySelectorAll('.team-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.team-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _selectedTeamId   = btn.dataset.id;
      _selectedTeamName = btn.dataset.name;
      checkReady();
    });
  });
}

function switchTeamMode(mode) {
  _teamMode         = mode;
  _selectedTeamId   = null;
  _selectedTeamName = null;

  document.querySelectorAll('.team-mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
  document.getElementById('team-join-section').style.display   = mode === 'join'   ? 'block' : 'none';
  document.getElementById('team-create-section').style.display = mode === 'create' ? 'block' : 'none';

  document.querySelectorAll('.team-choice-btn').forEach(b => b.classList.remove('selected'));
  const inp = document.getElementById('team-name-input');
  if (inp) inp.value = '';
  const hint = document.getElementById('team-name-hint');
  if (hint) hint.style.display = 'none';

  checkReady();
}

let _selectedPlatform = null;

function initForm(tournoi) {
  const bfInput       = document.getElementById('psn-input');
  const bfHint        = document.getElementById('psn-hint');
  const btnSubmit     = document.getElementById('btn-submit');
  const platformBtns  = document.querySelectorAll('.platform-btn');
  const teamNameInput = document.getElementById('team-name-input');
  const teamNameHint  = document.getElementById('team-name-hint');
  _selectedPlatform   = null;

  const btnBackOld = document.getElementById('btn-back');
  if (btnBackOld) {
    const btnBack = btnBackOld.cloneNode(true);
    btnBackOld.replaceWith(btnBack);
    btnBack.addEventListener('click', () => {
      if (_multipleTournois) showChoose(_allTournois);
      else window.close();
    });
  }

  document.getElementById('btn-join-team')?.addEventListener('click',   () => switchTeamMode('join'));
  document.getElementById('btn-create-team')?.addEventListener('click', () => switchTeamMode('create'));

  bfInput.value = '';
  bfHint.style.display = 'none';
  bfInput.addEventListener('input', () => {
    const val = bfInput.value.trim();
    bfHint.style.display = val.length >= 3 ? 'block' : 'none';
    if (val.length >= 3) { bfHint.className = 'hint ok'; bfHint.textContent = `✓ Pseudo : ${val}`; }
    checkReady();
  });

  platformBtns.forEach(b => b.classList.remove('selected'));
  platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      platformBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _selectedPlatform = btn.dataset.platform;
      checkReady();
    });
  });

  teamNameInput?.addEventListener('input', () => {
    const val = teamNameInput.value.trim();
    _selectedTeamName = val.length >= 2 ? val : null;
    if (teamNameHint) {
      teamNameHint.style.display = val.length >= 2 ? 'block' : 'none';
      teamNameHint.className = 'hint ok';
      teamNameHint.textContent = `✓ Équipe : ${val}`;
    }
    checkReady();
  });

  btnSubmit.disabled = true;

  btnSubmit.addEventListener('click', async () => {
    const pseudo   = bfInput.value.trim();
    const platform = _selectedPlatform;
    if (!pseudo || !platform) return;

    const teamData = _teamMode === 'create'
      ? { mode: 'create', name: _selectedTeamName }
      : { mode: 'join', id: _selectedTeamId, name: _selectedTeamName };

    sessionStorage.setItem('ws_inscription', JSON.stringify({
      pseudo, platform, tournament_id: tournoi.id, team: teamData
    }));

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href }
    });

    if (error) {
      bfHint.style.display = 'block';
      bfHint.className = 'hint err';
      bfHint.textContent = '❌ Erreur Discord : ' + error.message;
    }
  });
}

function checkReady() {
  const btnSubmit = document.getElementById('btn-submit');
  if (!btnSubmit) return;
  const pseudoOk  = document.getElementById('psn-input')?.value.trim().length >= 3;
  const teamOk    = _teamMode === 'join' ? !!_selectedTeamId : (_selectedTeamName?.length >= 2);
  btnSubmit.disabled = !(pseudoOk && !!_selectedPlatform && teamOk);
}

async function handleLoggedIn(user, tournoi) {
  // Vrai Discord ID
  const discordId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;

  const saved = sessionStorage.getItem('ws_inscription');
  if (!saved) { showState('form'); await loadTeams(tournoi.id); initForm(tournoi); return; }

  const { pseudo, platform, tournament_id, team } = JSON.parse(saved);

  const { data: existing } = await supabase.from('tournament_entries').select('id')
    .eq('tournament_id', tournament_id).eq('discord_id', discordId).maybeSingle();

  if (existing) {
    showSuccess({ pseudo, platform, username: user.user_metadata?.full_name || user.email, avatar: user.user_metadata?.avatar_url, already: true, teamName: team?.name });
    sessionStorage.removeItem('ws_inscription');
    return;
  }

  let teamId   = team?.id || null;
  let teamName = team?.name || null;

  if (team?.mode === 'create') {
    const { data: existingTeam } = await supabase.from('teams').select('id')
      .eq('tournament_id', tournament_id).ilike('name', team.name).maybeSingle();
    if (existingTeam) {
      teamId = existingTeam.id;
    } else {
      const { data: newTeam } = await supabase.from('teams').insert({
        tournament_id, name: team.name, created_by: discordId, created_at: new Date().toISOString()
      }).select().single();
      teamId = newTeam?.id;
    }
  }

  await supabase.from('tournament_entries').insert({
    tournament_id, discord_id: discordId,
    username  : user.user_metadata?.full_name || user.email,
    tracker_id: null, team_id: teamId, team_name: teamName,
    status    : 'active', created_at: new Date().toISOString(),
  });

  const { data: existingPlayer } = await supabase.from('players').select('id').eq('discord_id', discordId).maybeSingle();
  if (!existingPlayer) {
    await supabase.from('players').insert({
      discord_id: discordId, pseudo_bf6: pseudo, platform,
      username  : user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null, created_at: new Date().toISOString(),
    });
  } else {
    await supabase.from('players').update({
      pseudo_bf6: pseudo, platform, avatar_url: user.user_metadata?.avatar_url || null,
    }).eq('discord_id', discordId);
  }

  sessionStorage.removeItem('ws_inscription');
  showSuccess({ pseudo, platform, username: user.user_metadata?.full_name || user.email, avatar: user.user_metadata?.avatar_url, already: false, teamName });
}

function showSuccess({ pseudo, platform, username, avatar, already, teamName }) {
  showState('success');
  const platformLabel = { psn: 'PlayStation', xbox: 'Xbox', pc: 'PC' }[platform] || platform;
  document.getElementById('success-recap').innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:0.75rem;display:block">` : ''}
    Discord : <span>${username}</span><br>
    Pseudo BF6 : <span>${pseudo}</span><br>
    Plateforme : <span>${platformLabel}</span><br>
    Équipe : <span>${teamName || '—'}</span><br>
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