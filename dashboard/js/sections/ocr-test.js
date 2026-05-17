// dashboard/js/sections/ocr-test.js

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
  const rawText     = document.getElementById('ocr-raw-text');
  const errorDiv    = document.getElementById('ocr-error');

  let currentFile = null;

  // =====================================================
  // DRAG OVER
  // =====================================================

  dropZone.addEventListener('dragover', (e) => {

    e.preventDefault();
    dropZone.classList.add('drag-over');

  });

  // =====================================================
  // DRAG LEAVE
  // =====================================================

  dropZone.addEventListener('dragleave', () => {

    dropZone.classList.remove('drag-over');

  });

  // =====================================================
  // DROP
  // =====================================================

  dropZone.addEventListener('drop', (e) => {

    e.preventDefault();

    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];

    if (file && file.type.startsWith('image/')) {

      loadPreview(file);

    }

  });

  // =====================================================
  // CLICK
  // =====================================================

  dropZone.addEventListener('click', () => {

    fileInput.click();

  });

  // =====================================================
  // INPUT CHANGE
  // =====================================================

  fileInput.addEventListener('change', () => {

    if (fileInput.files[0]) {

      loadPreview(fileInput.files[0]);

    }

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

      rawText.textContent = '';

      // =========================================
      // FORM DATA
      // =========================================

      const formData = new FormData();

      formData.append('image', currentFile);

      // =========================================
      // FETCH OCR
      // =========================================

      const response = await fetch(OCR_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {

        throw new Error(`HTTP ${response.status}`);

      }

      const data = await response.json();

      console.log('OCR RESPONSE:', data);

      // =========================================
      // VALIDATION
      // =========================================

      if (!data || data.success === false) {

        throw new Error('Réponse OCR invalide');

      }

      // =========================================
      // SHOW RESULT
      // =========================================

      resultDiv.style.display = 'block';

      // =========================================
      // PLACEMENT
      // =========================================

      if (data.placement !== null && data.placement !== undefined) {

        const placementCard = document.createElement('div');

        placementCard.className = 'ocr-stat-card';

        placementCard.innerHTML = `
          <div class="ocr-stat-value">
            #${data.placement}
          </div>

          <div class="ocr-stat-label">
            PLACEMENT
          </div>
        `;

        statsGrid.appendChild(placementCard);

      }

      // =========================================
      // KILLS TOTAL
      // =========================================

      if (data.squad_kills !== null && data.squad_kills !== undefined) {

        const killsCard = document.createElement('div');

        killsCard.className = 'ocr-stat-card';

        killsCard.innerHTML = `
          <div class="ocr-stat-value">
            ${data.squad_kills}
          </div>

          <div class="ocr-stat-label">
            KILLS ESCOUADE
          </div>
        `;

        statsGrid.appendChild(killsCard);

      }

      // =========================================
      // PLAYERS
      // =========================================

      if (Array.isArray(data.players)) {

        data.players.forEach(player => {

          const pseudo = player.pseudo || 'JOUEUR';
          const kills  = player.kills ?? '?';
          const deaths = player.deaths ?? '?';
          const kd      = player.kd ?? '?';
          const score   = player.score ?? '?';

          const card = document.createElement('div');

          card.className = 'ocr-stat-card';

          card.innerHTML = `
            <div class="ocr-stat-value" style="font-size:1rem">
              ${pseudo}
            </div>

            <div class="ocr-stat-label">
              ${kills}K ·
              ${deaths}D ·
              KD ${kd} ·
              ${score}pts
            </div>
          `;

          statsGrid.appendChild(card);

        });

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