export async function initProfilEmbed() {
  const discordId = window.WARSTACK_DISCORD_ID;
  const guildId   = window.WARSTACK_GUILD_ID || sessionStorage.getItem('warstack_guild_id') || '';
  const container = document.getElementById('section-content');
  if (!container) return;

  const url = discordId
    ? `profil.html?id=${discordId}&guild=${guildId}`
    : 'profil.html';

  container.innerHTML = `
    <div class="embed-page-wrapper">
      <div class="embed-page-topbar">
        <span class="embed-page-label">👤 Mon Profil</span>
        <a href="${url}" target="_blank" class="btn btn-secondary btn-sm">
          <i class="fas fa-external-link-alt"></i> Plein écran
        </a>
      </div>
      <iframe src="${url}" class="embed-page-iframe" frameborder="0" allowfullscreen></iframe>
    </div>
  `;
}