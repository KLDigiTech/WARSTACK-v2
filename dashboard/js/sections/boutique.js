// dashboard/js/sections/boutique.js — FICHIER COMPLET

import { fetchSupabase } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/confirm.js';
import { getActiveGuildId } from '../services/guildService.js';

let currentTab = 'shop';
let currentCat = 'all';
let currentItem = null;
let allItems = [];

export async function initBoutique() {
  const isMember = window.WARSTACK_IS_MEMBER === true || window._memberViewActive === true;

  const staffPanel = document.getElementById('boutique-staff-panel');
  if (staffPanel) staffPanel.style.display = isMember ? 'none' : 'block';

  await loadCoins();

  document.querySelectorAll('.boutique-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.boutique-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      document.getElementById('boutique-shop-panel').style.display = currentTab === 'shop' ? 'block' : 'none';
      document.getElementById('boutique-inventory-panel').style.display = currentTab === 'inventory' ? 'block' : 'none';
      if (currentTab === 'inventory') loadInventory();
    });
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      renderShop();
    });
  });

  document.getElementById('btn-create-item')?.addEventListener('click', createItem);
  document.getElementById('modal-item-close')?.addEventListener('click', closeModal);

  await loadShop();
}

async function loadCoins() {
  const discordId = window.WARSTACK_DISCORD_ID;
  if (!discordId) return;
  const data = await fetchSupabase(`warstack_wallets?discord_id=eq.${discordId}&select=coins&limit=1`);
  const coins = data?.[0]?.coins ?? 0;
  const el = document.getElementById('boutique-coins');
  if (el) el.textContent = coins.toLocaleString('fr-FR');
}

async function loadShop() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`shop_items?guild_id=eq.${guildId}&available=eq.true&select=*&order=created_at.desc`);
  allItems = data || [];
  renderShop();
}

function renderShop() {
  const grid = document.getElementById('boutique-grid');
  if (!grid) return;

  const filtered = currentCat === 'all' ? allItems : allItems.filter(i => i.category === currentCat);

  if (!filtered.length) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;grid-column:1/-1">Aucun item disponible.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="boutique-card rarity-${item.rarity}" data-id="${item.id}">
      <div class="boutique-card-icon">${item.image_url
        ? `<img src="${item.image_url}" alt="${item.name}">`
        : `<span>${item.icon || '🎁'}</span>`
      }</div>
      <div class="boutique-card-info">
        <div class="boutique-card-name">${item.name}</div>
        <div class="boutique-card-cat">${categoryLabel(item.category)}</div>
      </div>
      <div class="boutique-card-footer">
        <span class="item-rarity-badge rarity-badge-${item.rarity}">${rarityLabel(item.rarity)}</span>
        <span class="boutique-card-price">🪙 ${item.price.toLocaleString('fr-FR')}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.boutique-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

async function loadInventory() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Chargement...</div>`;

  const guildId = await getActiveGuildId();
  const discordId = window.WARSTACK_DISCORD_ID;
  const data = await fetchSupabase(`player_items?discord_id=eq.${discordId}&guild_id=eq.${guildId}&select=*,shop_items(*)&order=obtained_at.desc`);
  const list = data || [];

  if (!list.length) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;grid-column:1/-1">Inventaire vide.</div>`;
    return;
  }

  grid.innerHTML = list.map(pi => {
    const item = pi.shop_items;
    if (!item) return '';
    return `
      <div class="boutique-card rarity-${item.rarity} ${pi.equipped ? 'equipped' : ''}" data-player-item-id="${pi.id}" data-item-id="${item.id}">
        ${pi.equipped ? '<div class="equipped-badge">✅ Équipé</div>' : ''}
        <div class="boutique-card-icon">${item.image_url
          ? `<img src="${item.image_url}" alt="${item.name}">`
          : `<span>${item.icon || '🎁'}</span>`
        }</div>
        <div class="boutique-card-info">
          <div class="boutique-card-name">${item.name}</div>
          <div class="boutique-card-cat">${categoryLabel(item.category)}</div>
        </div>
        <div class="boutique-card-footer">
          <button class="btn btn-sm ${pi.equipped ? 'btn-secondary' : 'btn-primary'} btn-equip" data-pi-id="${pi.id}" data-equipped="${pi.equipped}">
            ${pi.equipped ? 'Déséquiper' : 'Équiper'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-equip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const piId = btn.dataset.piId;
      const equipped = btn.dataset.equipped === 'true';
      await fetchSupabase(`player_items?id=eq.${piId}`, 'PATCH', { equipped: !equipped });
      showToast(equipped ? '✅ Déséquipé' : '✅ Équipé');
      await loadInventory();
    });
  });
}

function openModal(itemId) {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  currentItem = item;

  const isMember = window.WARSTACK_IS_MEMBER === true || window._memberViewActive === true;

  document.getElementById('modal-item-title').textContent = `${item.icon || '🎁'} ${item.name}`;
  document.getElementById('modal-item-desc').textContent = item.description || 'Aucune description.';
  document.getElementById('modal-item-rarity').textContent = rarityLabel(item.rarity);
  document.getElementById('modal-item-rarity').className = `item-rarity-badge rarity-badge-${item.rarity}`;
  document.getElementById('modal-item-price').textContent = `🪙 ${item.price.toLocaleString('fr-FR')} WAR Coins`;
  document.getElementById('modal-item-stock').textContent = item.stock === -1 ? 'Stock illimité' : `Stock : ${item.stock}`;

  const imgWrap = document.getElementById('modal-item-image-wrap');
  imgWrap.innerHTML = item.image_url
    ? `<img src="${item.image_url}" style="max-height:120px;border-radius:var(--radius)">`
    : `<span style="font-size:4rem">${item.icon || '🎁'}</span>`;

  const footer = document.getElementById('modal-item-footer');
  if (isMember) {
    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-buy-item">
        <i class="fas fa-shopping-cart"></i> Acheter
      </button>
      <button class="btn btn-secondary" id="modal-item-cancel">Annuler</button>
    `;
    document.getElementById('btn-buy-item')?.addEventListener('click', buyItem);
    document.getElementById('modal-item-cancel')?.addEventListener('click', closeModal);
  } else {
    footer.innerHTML = `
      <button class="btn btn-danger" id="btn-delete-item">
        <i class="fas fa-trash"></i> Supprimer
      </button>
      <button class="btn btn-secondary" id="modal-item-toggle">
        ${item.available ? '⏸️ Désactiver' : '▶️ Activer'}
      </button>
      <button class="btn btn-secondary" id="modal-item-cancel">Fermer</button>
    `;
    document.getElementById('btn-delete-item')?.addEventListener('click', deleteItem);
    document.getElementById('modal-item-toggle')?.addEventListener('click', toggleItem);
    document.getElementById('modal-item-cancel')?.addEventListener('click', closeModal);
  }

  document.getElementById('modal-item-detail').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-item-detail').style.display = 'none';
  currentItem = null;
}

async function buyItem() {
  if (!currentItem) return;
  const discordId = window.WARSTACK_DISCORD_ID;
  const guildId = await getActiveGuildId();

  const walletData = await fetchSupabase(`warstack_wallets?discord_id=eq.${discordId}&select=coins&limit=1`);
  const coins = walletData?.[0]?.coins ?? 0;

  if (coins < currentItem.price) {
    showToast('❌ WAR Coins insuffisants', 'error');
    return;
  }

  const owned = await fetchSupabase(`player_items?discord_id=eq.${discordId}&item_id=eq.${currentItem.id}&limit=1`);
  if (owned?.length > 0) {
    showToast('❌ Tu possèdes déjà cet item', 'error');
    return;
  }

  await fetchSupabase(`warstack_wallets?discord_id=eq.${discordId}`, 'PATCH', { coins: coins - currentItem.price });
  await fetchSupabase('player_items', 'POST', {
    discord_id: discordId,
    guild_id: guildId,
    item_id: currentItem.id,
    equipped: false,
  });
  await fetchSupabase('warstack_transactions', 'POST', {
    discord_id: discordId,
    guild_id: guildId,
    type: 'shop_purchase',
    amount: -currentItem.price,
    description: `Achat : ${currentItem.name}`,
  });

  if (currentItem.stock > 0) {
    await fetchSupabase(`shop_items?id=eq.${currentItem.id}`, 'PATCH', { stock: currentItem.stock - 1 });
  }

  closeModal();
  showToast(`✅ ${currentItem.name} acheté !`);
  await loadCoins();
  await loadShop();
}

async function deleteItem() {
  if (!currentItem) return;
  showConfirm({
    title: 'Supprimer l\'item',
    message: 'Cette action est irréversible.',
    confirmText: 'Supprimer',
    cancelText: 'Annuler',
    onConfirm: async () => {
      await fetchSupabase(`shop_items?id=eq.${currentItem.id}`, 'DELETE');
      closeModal();
      showToast('✅ Item supprimé');
      await loadShop();
    },
  });
}

async function toggleItem() {
  if (!currentItem) return;
  await fetchSupabase(`shop_items?id=eq.${currentItem.id}`, 'PATCH', { available: !currentItem.available });
  showToast(currentItem.available ? '⏸️ Item désactivé' : '▶️ Item activé');
  closeModal();
  await loadShop();
}

async function createItem() {
  const guildId = await getActiveGuildId();
  const name = document.getElementById('item-name').value.trim();
  const price = parseInt(document.getElementById('item-price').value) || 0;
  const category = document.getElementById('item-category').value;
  const rarity = document.getElementById('item-rarity').value;
  const icon = document.getElementById('item-icon').value.trim();
  const stock = parseInt(document.getElementById('item-stock').value) ?? -1;
  const description = document.getElementById('item-description').value.trim();
  const image_url = document.getElementById('item-image').value.trim();

  if (!name) { showToast('❌ Nom requis', 'error'); return; }

  await fetchSupabase('shop_items', 'POST', {
    guild_id: guildId,
    name,
    description,
    price,
    category,
    rarity,
    icon,
    stock,
    image_url: image_url || null,
    available: true,
    unlock_type: 'purchase',
  });

  document.getElementById('item-name').value = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-icon').value = '';
  document.getElementById('item-description').value = '';
  document.getElementById('item-image').value = '';
  document.getElementById('item-stock').value = '-1';

  showToast('✅ Item créé !');
  await loadShop();
}

function categoryLabel(cat) {
  const map = {
    badge: '🏅 Badge',
    title: '📛 Titre',
    profile_frame: '🖼️ Cadre profil',
    profile_background: '🎨 Fond profil',
    soldier_skin: '🎖️ Skin soldat',
    discord_role: '👑 Rôle Discord',
  };
  return map[cat] || cat;
}

function rarityLabel(rarity) {
  const map = {
    common: '⚪ Commun',
    rare: '🔵 Rare',
    epic: '🟣 Épique',
    legendary: '🟠 Légendaire',
    mythic: '🔴 Mythique',
  };
  return map[rarity] || rarity;
}