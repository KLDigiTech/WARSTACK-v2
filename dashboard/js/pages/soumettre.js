// dashboard/js/pages/soumettre.js

import { supabase } from '../supabaseClient.js';

const OCR_URL = 'https://kldigitech-warstack-ocr.hf.space/ocr';
const BOT_URL = 'https://warstack-bot.onrender.com';

let _tournoi = null;
let _player  = null;

function showState(name) {
  document.querySelectorAll('.insc-state').forEach(el => el.classList.remove('visible'));
  document.getElementById(`state-${name}`)?.classList.add('visible');
}

function setCheck(id, ok, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.className = `check-item ${ok ? 'check-ok' : 'check-fail'}`; }
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }

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

  // Vérif membre serveur
  try {
    const res  = await fetch(`${BOT_URL}/api/member/${discordId}`);
    const data = await res.json();
    if (!data.isMember) { showState('not-member'); return; }
  } catch {}

  // Vérif tracker
  const { data: player } = await supabase.from('players').select('*').eq('discord_id', discordId).maybeSingle();
  if (!player?.tracker_id) { showState('no-register'); return; }
  _player = player;

  // Vérif tournoi
  const urlParams = new URLSearchParams(window.location.search);
  const guildId   = urlParams.get('guild');

  let tournoiQuery = supabase.from('tournaments').select('*').eq('status', 'active').limit(1);
  if (guildId) tournoiQuery = tournoiQuery.eq('guild_id', guildId);

  const { data: tournois } = await tournoiQuery;
  if (!tournois?.length) { showState('no-tournoi'); return; }
  _tournoi = tournois[0];

  // Vérif inscription
  const { data: entry } = await supabase.from('tournament_entries').select('id').eq('tournament_id', _tournoi.id).eq('discord_id', discordId).maybeSingle();
  if (!entry) { showState('not-inscrit'); return; }

  document.getElementById('tournoi-name').textContent  = _tournoi.name;
  document.getElementById('tournoi-dates').textContent = `${fmt(_tournoi.start_date)} → ${fmt(_tournoi.end_date)}`;
  document.getElementById('user-name').textContent     = user.user_metadata?.full_name || user.email;
  document.getElementById('user-tracker').textContent  = `Tracker : ${player.tracker_id}`;
  document.getElementById('user-avatar').src           = user.user_metadata?.avatar_url || '';

  showState('form');
  initForm(discordId);
}

function initForm(discordId) {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const sendBtn   = document.getElementById('send-btn');
  const btnText   = document.getElementById('send-btn-text');
  const previewImg= document.getElementById('preview-img');
  const checks    = document.getElementById('checks');
  const errorBox  = document.getElementById('error-box');
  let currentFile = null;

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadPreview(f);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadPreview(fileInput.files[0]); });

  function loadPreview(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src           = e.target.result;
      previewImg.style.display = 'block';
      sendBtn.style.display    = 'block';
      errorBox.style.display   = 'none';
      checks.style.display     = 'none';
    };
    reader.readAsDataURL(file);
  }

  sendBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    try {
      btnText.textContent    = '⏳ ANALYSE EN COURS...';
      sendBtn.disabled       = true;
      errorBox.style.display = 'none';
      checks.style.display   = 'block';

      // Résolution
      const img = new Image();
      img.src = URL.createObjectURL(currentFile);
      await new Promise(r => img.onload = r);
      const w = img.naturalWidth, h = img.naturalHeight;
      const validRes = [[1920,1080],[2560,1440],[3840,2160],[1280,720],[2560,1080]];
      const resOk = validRes.some(([rw,rh]) => rw===w && rh===h);
      setCheck('check-resolution', resOk, `Résolution ${w}x${h} ${resOk?'✅':'❌ non reconnue'}`);
      if (!resOk) throw new Error(`Résolution ${w}x${h} non reconnue.`);

      // Doublon
      const hashBuffer = await crypto.subtle.digest('SHA-256', await currentFile.arrayBuffer());
      const imageHash  = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const { data: existing } = await supabase.from('tournament_submissions').select('id').eq('tournament_id', _tournoi.id).eq('image_hash', imageHash).maybeSingle();
      setCheck('check-doublon', !existing, existing ? 'Doublon détecté ❌' : 'Aucun doublon ✅');
      if (existing) throw new Error('Ce screenshot a déjà été soumis.');

      // Upload Storage
      let imageUrl = null;
      const fileName = `${_tournoi.id}/${Date.now()}_${currentFile.name.replace(/\s/g,'_')}`;
      const { error: upErr } = await supabase.storage.from('screenshots').upload(fileName, currentFile, { contentType: currentFile.type });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl || null;
      }

      // OCR
      const fd = new FormData();
      fd.append('image', currentFile);
      const ocrRes = await fetch(OCR_URL, { method: 'POST', body: fd });
      if (!ocrRes.ok) throw new Error(`OCR HTTP ${ocrRes.status}`);
      const ocrData = await ocrRes.json();
      if (!ocrData.success) throw new Error('OCR échoué');

      const topPts    = [_tournoi.points_top1??10,_tournoi.points_top2??7,_tournoi.points_top3??5,_tournoi.points_top4??3,_tournoi.points_top5??1];
      const placement = ocrData.placement ?? 0;
      const kills     = ocrData.squad_kills ?? 0;
      const placePts  = placement>=1&&placement<=5 ? topPts[placement-1] : 0;
      const killsPts  = kills * (_tournoi.points_per_kill ?? 1);
      const score     = placePts + killsPts;
      const status    = placement===0 ? 'pending' : 'approved';

      await supabase.from('tournament_submissions').insert({
        tournament_id: _tournoi.id, discord_id: discordId,
        pseudo: _player.pseudo_bf6, kills, placement, score,
        kd: 0, image_hash: imageHash, image_url: imageUrl,
        status, submitted_at: new Date().toISOString(), created_at: new Date().toISOString(),
      });

      if (status === 'approved') {
        const { data: ex } = await supabase.from('tournament_scores').select('*').eq('tournament_id', _tournoi.id).eq('discord_id', discordId).maybeSingle();
        if (ex) {
          await supabase.from('tournament_scores').update({
            total_kills: (ex.total_kills||0)+kills, total_score: (ex.total_score||0)+score,
            games_played: (ex.games_played||0)+1, updated_at: new Date().toISOString(),
          }).eq('id', ex.id);
        } else {
          await supabase.from('tournament_scores').insert({
            tournament_id: _tournoi.id, discord_id: discordId,
            total_kills: kills, total_score: score, games_played: 1, updated_at: new Date().toISOString(),
          });
        }
      }

      document.getElementById('success-recap').innerHTML = `
        Placement : <span>#${placement||'?'}</span><br>
        Kills : <span>${kills}</span><br>
        Score : <span>${score} pts</span><br>
        ${status==='pending'?'<div style="color:var(--orange);margin-top:0.5rem">⚠️ En attente de validation admin</div>':''}
      `;
      showState('success');

    } catch (err) {
      errorBox.style.display = 'block';
      errorBox.textContent   = '❌ ' + err.message;
    } finally {
      btnText.textContent = '▶ ANALYSER ET SOUMETTRE';
      sendBtn.disabled    = false;
    }
  });
}

init();
supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') init(); });