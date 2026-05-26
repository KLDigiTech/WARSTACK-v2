// dashboard/js/pages/register-public.js

import { supabase } from '../supabaseClient.js';

const BOT_URL = 'https://warstack-bot.onrender.com';

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

async function init() {
  showState('loading');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showState('no-auth');
    document.getElementById('btn-login')?.addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.href } });
    });
    return;
  }

  const user      = session.user;
  const discordId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;

  // Vérif membre
  try {
    const res  = await fetch(`${BOT_URL}/api/member/${discordId}`);
    const data = await res.json();
    if (!data.isMember) { showState('not-member'); return; }
  } catch {}

  // Vérif tracker existant
  const { data: player } = await supabase.from('players').select('tracker_id').eq('discord_id', discordId).maybeSingle();

  document.getElementById('user-name').textContent   = user.user_metadata?.full_name || user.email;
  document.getElementById('user-avatar').src         = user.user_metadata?.avatar_url || '';
  document.getElementById('user-status').textContent = player?.tracker_id ? `Tracker lié : ${player.tracker_id}` : 'Aucun tracker lié';

  showState('form');
  initForm(user, discordId, player);
}

function initForm(user, discordId, existingPlayer) {
  const input    = document.getElementById('tracker-url');
  const hint     = document.getElementById('tracker-hint');
  const saveBtn  = document.getElementById('btn-save');
  const errorDiv = document.getElementById('save-error');
  let trackerId  = null;

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

  saveBtn.addEventListener('click', async () => {
    if (!trackerId) return;
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
    errorDiv.style.display = 'none';

    try {
      const payload = {
        tracker_id  : trackerId,
        tracker_url : input.value.trim(),
        username    : user.user_metadata?.full_name || user.email,
        avatar_url  : user.user_metadata?.avatar_url || null,
      };

      if (existingPlayer) {
        await supabase.from('players').update(payload).eq('discord_id', discordId);
      } else {
        await supabase.from('players').insert({ ...payload, discord_id: discordId, created_at: new Date().toISOString() });
      }

      showState('success');
    } catch (err) {
      errorDiv.style.display = 'block';
      errorDiv.textContent   = '❌ ' + err.message;
      saveBtn.disabled       = false;
      saveBtn.innerHTML      = '<i class="fas fa-link"></i> LIER MON TRACKER';
    }
  });
}

init();
supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') init(); });