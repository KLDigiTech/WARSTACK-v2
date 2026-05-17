// dashboard/js/sections/ocr-test.js

import { supabase } from '../supabaseClient.js';

const OCR_URL = 'https://kldigitech-warstack-ocr.hf.space/ocr';

export function initOcrTest() {

  const dropZone    = document.getElementById('ocr-drop-zone');
  const fileInput   = document.getElementById('ocr-file-input');
  const previewWrap = document.getElementById('ocr-preview-wrap');
  const previewImg  = document.getElementById('ocr-preview-img');
  const sendBtn     = document.getElementById('ocr-send-btn');
  const btnText     = document.getElementById('ocr-btn-text');
  const resultDiv   = document.getElementById('ocr-result');
  const statsGrid   = document.getElementById('ocr-stats-grid');
  const playersGrid = document.getElementById('ocr-players-grid');
  const rawText     = document.getElementById('ocr-raw-text');
  const errorDiv    = document.getElementById('ocr-error');

  let currentFile = null;

  // =====================================================
  // DRAG & DROP
  // =====================================================

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadPreview(file);
  });

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadPreview(fileInput.files[0]);
  });

  // =====================================================
  // LOAD PREVIEW
  // =====================================================

  function loadPreview(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.style.display = 'block';
      sendBtn.style.display = 'block';
      resultDiv.style.display = 'none';
      errorDiv.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  // =====================================================
  // MATCHING SUPABASE
  // =====================================================

  async function matchPlayer(pseudo) {
    if (!pseudo || pseudo.startsWith('JOUEUR')) return null;

    const { data, error } = await supabase
      .from('players')
      .select('pseudo_bf6, discord_id, username, avatar_url, tracker_id')
      .ilike('pseudo_bf6', pseudo)
      .limit(1)
      .single();

    if (error || !data) return null;

    return data;
  }

  // =====================================================
  // OCR ANALYZE
  // =====================================================

  sendBtn.addEventListener('click', async () => {

    if (!currentFile) return;

    try {

      btnText.textContent = '⏳ ANALYSE EN COURS...';
      sendBtn.disabled = true;
      resultDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      statsGrid.innerHTML = '';
      playersGrid.innerHTML = '';
      rawText.textContent = '';

      const formData = new FormData();
      formData.append('image', currentFile);

      const response = await fetch(OCR_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log('OCR RESPONSE:', data);

      if (!data || data.success === false) throw new Error('Réponse OCR invalide');

      resultDiv.style.display = 'block';

      // =========================================
      // PLACEMENT
      // =========================================

      const placementCard = document.createElement('div');
      placementCard.className = 'ocr-stat-card';
      const placement = data.placement > 0 ? `#${data.placement}` : '#?';
      placementCard.innerHTML = `
        <div class="ocr-stat-value">${placement}</div>
        <div class="ocr-stat-label">PLACEMENT</div>
      `;
      statsGrid.appendChild(placementCard);

      // =========================================
      // KILLS ESCOUADE
      // =========================================

      const killsCard = document.createElement('div');
      killsCard.className = 'ocr-stat-card';
      killsCard.innerHTML = `
        <div class="ocr-stat-value">${data.squad_kills ?? 0}</div>
        <div class="ocr-stat-label">KILLS ESCOUADE</div>
      `;
      statsGrid.appendChild(killsCard);

      // =========================================
      // PLAYERS + MATCHING
      // =========================================

      if (Array.isArray(data.players)) {

        for (const player of data.players) {

          const pseudo  = player.pseudo || 'JOUEUR';
          const kills   = player.kills ?? 0;
          const deaths  = player.deaths ?? 0;
          const kd      = player.kd ?? 0;
          const score   = player.score ?? 0;

          const matched = await matchPlayer(pseudo);

          const avatarHtml = matched?.avatar_url
            ? `<img class="ocr-player-avatar" src="${matched.avatar_url}" alt="${pseudo}">`
            : `<div class="ocr-player-avatar ocr-player-avatar-placeholder">?</div>`;

          const usernameHtml = matched
            ? `<div class="ocr-player-discord">${matched.username}</div>`
            : `<div class="ocr-player-discord ocr-player-unmatched">Non inscrit</div>`;

          const card = document.createElement('div');
          card.className = `ocr-player-card${matched ? ' ocr-player-matched' : ''}`;

          card.innerHTML = `
            ${avatarHtml}
            <div class="ocr-player-name">${pseudo}</div>
            ${usernameHtml}
            <div class="ocr-player-kills">${kills}</div>
            <div class="ocr-player-kills-label">KILLS</div>
            <div class="ocr-player-stats">
              <div class="ocr-player-stat">
                <span class="stat-val">${kd}</span>
                <span class="stat-lbl">K/D</span>
              </div>
              <div class="ocr-player-stat-sep"></div>
              <div class="ocr-player-stat">
                <span class="stat-val">${deaths}</span>
                <span class="stat-lbl">MORTS</span>
              </div>
              <div class="ocr-player-stat-sep"></div>
              <div class="ocr-player-stat">
                <span class="stat-val">${score}</span>
                <span class="stat-lbl">PTS</span>
              </div>
            </div>
          `;

          playersGrid.appendChild(card);
        }
      }

      // =========================================
      // RAW TEXT
      // =========================================

      if (Array.isArray(data.raw_text)) {
        rawText.textContent = data.raw_text.join('\n');
      } else {
        rawText.textContent = '(aucun texte détecté)';
      }

    } catch (err) {

      console.error(err);
      errorDiv.textContent = '❌ Erreur : ' + err.message;
      errorDiv.style.display = 'block';

    } finally {

      btnText.textContent = '▶ ANALYSER';
      sendBtn.disabled = false;

    }

  });

}