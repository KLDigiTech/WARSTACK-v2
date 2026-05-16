import { callBotAPI } from '../api.js';
import { showToast }  from '../ui/toast.js';

export async function initChannels() {
  await loadChannels();

  document.getElementById('btn-create-channel')?.addEventListener('click', () => {
    document.getElementById('create-channel-form').style.display = 'block';
  });

  document.getElementById('btn-cancel-channel')?.addEventListener('click', () => {
    document.getElementById('create-channel-form').style.display = 'none';
    document.getElementById('channel-name').value = '';
  });

  document.getElementById('btn-confirm-channel')?.addEventListener('click', createChannel);
}

async function loadChannels() {
  const container = document.getElementById('channels-list');
  container.innerHTML = '<div class="loading-state">Chargement...</div>';

  const data = await callBotAPI('channels');
  if (!data?.channels?.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-hashtag"></i>Aucun salon trouvé</div>';
    return;
  }

  // Grouper par catégorie
  const categories = {};
  for (const ch of data.channels) {
    const cat = ch.category || 'Sans catégorie';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  }

  container.innerHTML = Object.entries(categories).map(([cat, channels]) => `
    <div class="channels-category">
      <div class="channels-category-title">${cat}</div>
      <div class="channels-grid">
        ${channels.map(ch => `
          <div class="channel-card">
            <div class="channel-icon">
              <i class="fas fa-${ch.type === 'voice' ? 'volume-up' : 'hashtag'}"></i>
            </div>
            <div class="channel-info">
              <div class="channel-name">${ch.name}</div>
              <div class="channel-id">${ch.id}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="window.deleteChannel('${ch.id}', '${ch.name}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Remplir le select catégories
  const select = document.getElementById('channel-category');
  const cats   = data.channels.filter(c => c.type === 'category');
  cats.forEach(cat => {
    const opt   = document.createElement('option');
    opt.value   = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

async function createChannel() {
  const name     = document.getElementById('channel-name').value.trim();
  const category = document.getElementById('channel-category').value;

  if (!name) return showToast('❌ Nom du salon obligatoire', 'error');

  const result = await callBotAPI('channel/create', 'POST', {
    name,
    category: category || null
  });

  if (result?.success) {
    showToast(`✅ Salon #${result.channel_name} créé !`);
    document.getElementById('create-channel-form').style.display = 'none';
    document.getElementById('channel-name').value = '';
    await loadChannels();
  } else {
    showToast('❌ Erreur création salon', 'error');
  }
}

window.deleteChannel = async function(id, name) {
  if (!confirm(`Supprimer #${name} ?`)) return;
  const result = await callBotAPI(`channel/delete`, 'POST', { channel_id: id });
  if (result?.success) {
    showToast(`✅ Salon #${name} supprimé`);
    await loadChannels();
  } else {
    showToast('❌ Erreur suppression', 'error');
  }
};