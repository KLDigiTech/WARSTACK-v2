export async function initPortailEmbed() {
  const guildId = window.WARSTACK_GUILD_ID || sessionStorage.getItem('warstack_guild_id') || '';
  const container = document.getElementById('section-content');
  if (!container) return;

  const url = `/portail.html?guild=${guildId}`;

  container.innerHTML = `
    <div class="embed-page-wrapper">
      <div class="embed-page-topbar">
        <span class="embed-page-label">🌍 Portail Public</span>
        <a href="${url}" target="_blank" class="btn btn-secondary btn-sm">
          <i class="fas fa-external-link-alt"></i> Ouvrir en plein écran
        </a>
      </div>
      <iframe src="${url}" class="embed-page-iframe" frameborder="0" allowfullscreen></iframe>
    </div>
  `;
}