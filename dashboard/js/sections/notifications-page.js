import { fetchSupabase } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/confirm.js';
import { getActiveGuildId } from '../services/guildService.js';

const PAGE_SIZE = 20;
let allNotifs = [];
let filtered  = [];
let currentPage = 1;
let activeFilter = 'all';

export async function initNotificationsPage() {
  await loadPageNotifs();

  document.getElementById('notifs-mark-all-read')?.addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const unread = allNotifs.filter(n => !n.read);
    if (!unread.length) { showToast('Aucune notification non lue'); return; }
    await fetchSupabase(`notifications?guild_id=eq.${guildId}&read=eq.false`, 'PATCH', { read: true });
    showToast('✅ Tout marqué comme lu');
    await loadPageNotifs();
  });

  document.getElementById('notifs-clear-all')?.addEventListener('click', () => {
    showConfirm({
      title: 'Effacer toutes les notifications',
      message: 'Cette action supprime définitivement tout l\'historique.',
      confirmText: 'Effacer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        const guildId = await getActiveGuildId();
        await fetchSupabase(`notifications?guild_id=eq.${guildId}`, 'DELETE');
        showToast('✅ Historique effacé');
        await loadPageNotifs();
      },
    });
  });

  document.querySelectorAll('.notifs-page-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notifs-page-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      currentPage = 1;
      applyFilter();
    });
  });

  document.getElementById('notifs-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(); }
  });

  document.getElementById('notifs-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage < totalPages) { currentPage++; renderPage(); }
  });
}

async function loadPageNotifs() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`notifications?guild_id=eq.${guildId}&order=created_at.desc&limit=500`) || [];
  allNotifs = data;
  updateStats();
  applyFilter();
}

function updateStats() {
  const el = (id) => document.getElementById(id);
  if (el('nstat-total'))    el('nstat-total').textContent    = allNotifs.length;
  if (el('nstat-unread'))   el('nstat-unread').textContent   = allNotifs.filter(n => !n.read).length;
  if (el('nstat-security')) el('nstat-security').textContent = allNotifs.filter(n => n.type === 'security').length;
  if (el('nstat-tickets'))  el('nstat-tickets').textContent  = allNotifs.filter(n => n.type === 'ticket').length;
}

function applyFilter() {
  filtered = activeFilter === 'all'
    ? allNotifs
    : allNotifs.filter(n => n.type === activeFilter);
  currentPage = 1;
  renderPage();
}

function renderPage() {
  const list = document.getElementById('notifs-page-list');
  const pagination = document.getElementById('notifs-pagination');
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="notifs-page-empty">
        <i class="fas fa-bell-slash"></i>
        <div>${activeFilter === 'all' ? 'Aucune notification' : 'Aucune notification dans cette catégorie'}</div>
      </div>`;
    if (pagination) pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  const typeColors = {
    security   : 'var(--danger)',
    moderation : 'var(--danger)',
    ticket     : 'var(--warning)',
    suggestion : 'var(--info, #40c4ff)',
    onboarding : 'var(--success, var(--green))',
    event      : '#5865F2',
  };

  const typeBg = {
    security   : 'var(--danger-soft)',
    moderation : 'var(--danger-soft)',
    ticket     : 'var(--warning-soft)',
    suggestion : 'rgba(64,196,255,.1)',
    onboarding : 'rgba(0,255,100,.1)',
    event      : 'rgba(88,101,242,.12)',
  };

  list.innerHTML = page.map(n => `
    <div class="notifs-page-item ${n.read ? 'read' : ''}"
         data-id="${n.id}"
         data-section="${n.section || ''}"
         style="--notif-color:${typeColors[n.type] || 'var(--primary)'}">
      <div class="notifs-page-item-icon" style="background:${typeBg[n.type] || 'var(--surface-3)'}">
        ${n.icon || '🔔'}
      </div>
      <div class="notifs-page-item-body">
        <div class="notifs-page-item-title">${n.title}</div>
        <div class="notifs-page-item-text">${n.body || ''}</div>
        <div class="notifs-page-item-meta">
          <span class="notifs-page-item-time">${timeAgo(n.created_at)}</span>
          <span class="notifs-page-item-type">${n.type}</span>
        </div>
      </div>
      <div class="notifs-page-item-actions">
        ${!n.read ? `<button class="btn btn-sm btn-secondary btn-mark-read" data-id="${n.id}" title="Marquer lu"><i class="fas fa-check"></i></button>` : ''}
        <button class="btn btn-sm btn-danger btn-notif-delete" data-id="${n.id}" title="Supprimer"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.notifs-page-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.notifs-page-item-actions')) return;
      const id = item.dataset.id;
      const section = item.dataset.section;
      if (!item.classList.contains('read')) {
        await fetchSupabase(`notifications?id=eq.${id}`, 'PATCH', { read: true });
        item.classList.add('read');
        const n = allNotifs.find(x => x.id === id);
        if (n) n.read = true;
        updateStats();
      }
      if (section) document.querySelector(`[data-section="${section}"]`)?.click();
    });
  });

  list.querySelectorAll('.btn-mark-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await fetchSupabase(`notifications?id=eq.${id}`, 'PATCH', { read: true });
      const n = allNotifs.find(x => x.id === id);
      if (n) n.read = true;
      updateStats();
      renderPage();
    });
  });

  list.querySelectorAll('.btn-notif-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await fetchSupabase(`notifications?id=eq.${id}`, 'DELETE');
      allNotifs = allNotifs.filter(n => n.id !== id);
      updateStats();
      applyFilter();
      showToast('✅ Notification supprimée');
    });
  });

  if (pagination) {
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';
    const prevBtn  = document.getElementById('notifs-prev');
    const nextBtn  = document.getElementById('notifs-next');
    const pageInfo = document.getElementById('notifs-page-info');
    if (prevBtn)  prevBtn.disabled  = currentPage <= 1;
    if (nextBtn)  nextBtn.disabled  = currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  }
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}