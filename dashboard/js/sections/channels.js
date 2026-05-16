import { callBotAPI } from '../api.js';
import { showToast }  from '../ui/toast.js';

const EMOJIS = [
  '🏆','⚔️','🎮','🔱','👻','💎','🎖️','🪖','🔥','💀',
  '📊','📈','🎯','🏅','⭐','🌟','💥','🛡️','🗡️','🔰',
  '📋','📢','📣','🔔','🔕','💬','🗨️','📁','📂','🗂️',
  '🎪','🎭','🎲','🎳','🏁','🚀','💫','✨','🌈','🎊',
  '👑','🦁','🐉','🦅','🐺','🦊','🐻','🦝','🐯','🦈',
  '🇫🇷','🏴','🚩','🎌','🏳️','⚡','🌊','🌪️','❄️','🔮',
];

let selectedEmoji = '';

export async function initChannels() {
  buildEmojiGrid();
  await loadChannels();

  document.getElementById('btn-create-channel')?.addEventListener('click', () => {
    document.getElementById('create-channel-form').style.display = 'block';
  });

  document.getElementById('btn-cancel-channel')?.addEventListener('click', () => {
    document.getElementById('create-channel-form').style.display = 'none';
    document.getElementById('channel-name').value = '';
    selectedEmoji = '';
    document.getElementById('emoji-selected').textContent = 'Aucun emoji sélectionné';
    document.getElementById('channel-name-emoji').textContent = '';
    document.querySelectorAll('.emoji-btn.active').forEach(b => b.classList.remove('active'));
  });

  document.getElementById('btn-confirm-channel')?.addEventListener('click', createChannel);
}

function buildEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn" data-emoji="${e}">${e}</button>
  `).join('');

  grid.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
      if (selectedEmoji === btn.dataset.emoji) {
        selectedEmoji = '';
        document.getElementById('emoji-selected').textContent = 'Aucun emoji sélectionné';
        document.getElementById('channel-name-emoji').textContent = '';
      } else {
        btn.classList.add('active');
        selectedEmoji = btn.dataset.emoji;
        document.getElementById('emoji-selected').textContent = `Sélectionné : ${selectedEmoji}`;
        document.getElementById('channel-name-emoji').textContent = selectedEmoji + ' ';
      }
    });
  });
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
    if (ch.type === 'category') continue;
    const cat = ch.category || 'Sans catégorie';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  }

  // Catégories dans le select
  const select = document.getElementById('channel-category');
  select.innerHTML = '<option value="">Aucune</option>';
  data.channels.filter(c => c.type === 'category').forEach(cat => {
    const opt     = document.createElement('option');
    opt.value     = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });

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
}

async function createChannel() {
  const name     = document.getElementById('channel-name').value.trim();
  const type     = parseInt(document.getElementById('channel-type').value);
  const category = document.getElementById('channel-category').value;
  const fullName = selectedEmoji ? `${selectedEmoji}${name}` : name;

  if (!name) return showToast('❌ Nom du salon obligatoire', 'error');

  const result = await callBotAPI('channel/create', 'POST', {
    name    : fullName,
    type,
    category: category || null
  });

  if (result?.success) {
    showToast(`✅ ${fullName} créé !`);
    document.getElementById('create-channel-form').style.display = 'none';
    document.getElementById('channel-name').value = '';
    selectedEmoji = '';
    document.getElementById('emoji-selected').textContent = 'Aucun emoji sélectionné';
    document.getElementById('channel-name-emoji').textContent = '';
    document.querySelectorAll('.emoji-btn.active').forEach(b => b.classList.remove('active'));
    await loadChannels();
  } else {
    showToast('❌ Erreur création salon', 'error');
  }
}

window.deleteChannel = async function(id, name) {
  if (!confirm(`Supprimer #${name} ?`)) return;
  const result = await callBotAPI('channel/delete', 'POST', { channel_id: id });
  if (result?.success) {
    showToast(`✅ Salon supprimé`);
    await loadChannels();
  } else {
    showToast('❌ Erreur suppression', 'error');
  }
};