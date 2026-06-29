export async function initInscriptionEmbed() {
  const guildId = window.WARSTACK_GUILD_ID || sessionStorage.getItem('warstack_guild_id') || '';
  const container = document.getElementById('main-content');
  if (!container) return;

  const url = `/inscription.html?guild=${guildId}`;

  container.innerHTML = `
    <div class="embed-page-wrapper">
      <div class="embed-page-topbar">
        <span class="embed-page-label">🔗 Lien d'inscription membres</span>
        <div class="embed-page-link-copy">
          <input type="text" class="form-input" id="inscription-url-input" value="${window.location.origin}${url}" readonly>
          <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('inscription-url-input').value).then(()=>this.innerHTML='✅ Copié!')">
            <i class="fas fa-copy"></i> Copier
          </button>
        </div>
        <a href="${url}" target="_blank" class="btn btn-secondary btn-sm">
          <i class="fas fa-external-link-alt"></i> Aperçu
        </a>
      </div>
      <iframe src="${url}" class="embed-page-iframe" frameborder="0" allowfullscreen></iframe>
    </div>
  `;
}