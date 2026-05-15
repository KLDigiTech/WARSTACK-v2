export function showLoading(message = 'CHARGEMENT...') {

  let loader = document.getElementById('global-loading');

  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loading';
    document.body.appendChild(loader);
  }

  loader.innerHTML = `
    <div class="loading-box">
      <div class="loading-spinner"></div>
      <div class="loading-text">${message}</div>
    </div>
  `;

  loader.classList.add('show');
}

export function hideLoading() {
  const loader = document.getElementById('global-loading');
  if (!loader) return;
  loader.classList.remove('show');
}