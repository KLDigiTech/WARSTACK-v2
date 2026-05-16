// dashboard/js/sections/ocr-test.js

const OCR_URL = 'https://warstack-ocr.onrender.com/ocr';

export function initOcrTest() {
  const dropZone   = document.getElementById('ocr-drop-zone');
  const fileInput  = document.getElementById('ocr-file-input');
  const previewWrap = document.getElementById('ocr-preview-wrap');
  const previewImg = document.getElementById('ocr-preview-img');
  const sendBtn    = document.getElementById('ocr-send-btn');
  const btnText    = document.getElementById('ocr-btn-text');
  const resultDiv  = document.getElementById('ocr-result');
  const statsGrid  = document.getElementById('ocr-stats-grid');
  const rawText    = document.getElementById('ocr-raw-text');
  const errorDiv   = document.getElementById('ocr-error');

  let currentFile = null;

  // Drag & drop events
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

  sendBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    btnText.textContent = '⏳ ANALYSE EN COURS...';
    sendBtn.disabled = true;
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
      // Convertit le fichier en base64
      const base64 = await fileToBase64(currentFile);

      const response = await fetch(OCR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64 })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Affichage des stats
      statsGrid.innerHTML = '';
      const stats = [
        { label: 'KILLS',  value: data.kills  ?? '—' },
        { label: 'DEATHS', value: data.deaths ?? '—' },
        { label: 'K/D',    value: data.kd     ?? '—' },
        { label: 'SCORE',  value: data.score  ?? '—' },
      ];
      stats.forEach(s => {
        const card = document.createElement('div');
        card.className = 'ocr-stat-card';
        card.innerHTML = `<div class="ocr-stat-value">${s.value}</div><div class="ocr-stat-label">${s.label}</div>`;
        statsGrid.appendChild(card);
      });

      rawText.textContent = data.raw_text || '(aucun texte détecté)';
      resultDiv.style.display = 'block';

    } catch (err) {
      errorDiv.textContent = '❌ Erreur : ' + err.message;
      errorDiv.style.display = 'block';
    } finally {
      btnText.textContent = '▶ ANALYSER';
      sendBtn.disabled = false;
    }
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}