// ═══════════════════════════════════════
// VAR DROPDOWN — gestion globale déléguée
// Fonctionne pour toutes les pages, y compris
// celles chargées dynamiquement, sans init par page.
// ═══════════════════════════════════════

let initialized = false;

export function initVarDropdowns() {
  if (initialized) return; // évite les doubles listeners
  initialized = true;

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.var-dropdown-toggle');
    const item   = e.target.closest('.var-dropdown-menu .var-btn');

    // ── Clic sur le bouton "Insérer une variable" ──
    if (toggle) {
      const dropdown = toggle.closest('.var-dropdown');
      const wasOpen  = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dropdown.classList.add('open');
      return;
    }

    // ── Clic sur une variable de la liste ──
    if (item) {
      const dropdown = item.closest('.var-dropdown');
      const targetId = item.dataset.target || dropdown?.dataset.target;
      const textarea = targetId ? document.getElementById(targetId) : null;
      const value    = item.dataset.var;

      if (textarea && value) {
        const pos = textarea.selectionStart ?? textarea.value.length;
        textarea.value = textarea.value.slice(0, pos) + value + textarea.value.slice(pos);
        textarea.focus();
        textarea.setSelectionRange(pos + value.length, pos + value.length);
        // Déclenche les listeners 'input' existants (preview live, etc.)
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      closeAllDropdowns();
      return;
    }

    // ── Clic ailleurs : on ferme tout ──
    if (!e.target.closest('.var-dropdown')) {
      closeAllDropdowns();
    }
  });

  // Ferme le menu si on quitte la page/section (évite un menu ouvert orphelin)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.var-dropdown.open').forEach(d => d.classList.remove('open'));
}