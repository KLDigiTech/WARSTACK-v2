// ── TOOLTIP GLOBAL ────────────────────────────────────────────────────────────
// Usage : <label>Mon label <span class="tooltip-icon" data-tooltip="Explication ici">ⓘ</span></label>

let tooltipEl = null;

export function initTooltips() {
  // Créer l'élément tooltip global
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip-bubble';
  document.body.appendChild(tooltipEl);

  // Délégation d'événements — fonctionne même sur le contenu chargé dynamiquement
  document.addEventListener('mouseover', e => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    showTooltip(target);
  });

  document.addEventListener('mouseout', e => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    hideTooltip();
  });

  document.addEventListener('scroll', hideTooltip, true);
}

function showTooltip(el) {
  const text = el.dataset.tooltip;
  if (!text) return;

  tooltipEl.textContent = text;
  tooltipEl.classList.add('visible');

  const rect = el.getBoundingClientRect();
  let top  = rect.top + window.scrollY - tooltipEl.offsetHeight - 8;
  let left = rect.left + window.scrollX + rect.width / 2 - tooltipEl.offsetWidth / 2;

  // Éviter de sortir de l'écran
  if (left < 8) left = 8;
  if (left + tooltipEl.offsetWidth > window.innerWidth - 8) {
    left = window.innerWidth - tooltipEl.offsetWidth - 8;
  }
  if (top < 8) top = rect.bottom + window.scrollY + 8;

  tooltipEl.style.top  = top  + 'px';
  tooltipEl.style.left = left + 'px';
}

function hideTooltip() {
  tooltipEl?.classList.remove('visible');
}