export function showConfirm({ title = 'Confirmation', message = 'Continuer ?', confirmText = 'Confirmer', cancelText = 'Annuler', onConfirm = async () => {} }) {

  let modal = document.getElementById('global-confirm');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-confirm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${title}</div>
      <div class="confirm-message">${message}</div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel" id="confirm-cancel">${cancelText}</button>
        <button class="confirm-btn confirm" id="confirm-ok">${confirmText}</button>
      </div>
    </div>
  `;

  modal.classList.add('show');

  document.getElementById('confirm-cancel').onclick = () => {
    modal.classList.remove('show');
  };

  document.getElementById('confirm-ok').onclick = async () => {
    modal.classList.remove('show');
    await onConfirm();
  };
}