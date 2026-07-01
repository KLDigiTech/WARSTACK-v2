export function showModal({ title = 'Modal', body = '' }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body;
  document.getElementById('modal').classList.add('open');
}

export function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// Exposées en global car de nombreux blocs HTML injectés via innerHTML
// utilisent onclick="closeModal()" / onclick="showModal(...)" en inline —
// ces attributs cherchent une fonction sur window, pas l'export du module.
window.showModal  = showModal;
window.closeModal = closeModal;

export function initModal() {
  const modal = document.getElementById('modal');
  const close = document.getElementById('modal-close');
  close?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}