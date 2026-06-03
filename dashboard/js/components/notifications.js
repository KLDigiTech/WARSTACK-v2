import { fetchSupabase } from '../api.js';

const GUILD_ID = '1501685144501620798';
let notifications  = [];
let unreadCount    = 0;

// ── INIT ──────────────────────────────────────────────────────────────────────

export async function initNotifications() {
  const bell     = document.getElementById('notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  const clearBtn = document.getElementById('notif-clear');

  // Toggle dropdown
  bell.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.style.display === 'flex';
    dropdown.style.display = open ? 'none' : 'flex';
    if (!open) markAllRead();
  });

  // Fermer au clic extérieur
  document.addEventListener('click', e => {
    if (!document.getElementById('notif-wrapper').contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Tout marquer lu
  clearBtn.addEventListener('click', () => {
    notifications.forEach(n => n.read = true);
    unreadCount = 0;
    updateBadge();
    renderNotifications();
  });

  // Charger au démarrage
  await loadNotifications();

  // Rafraîchir toutes les 30 secondes
  setInterval(loadNotifications, 30000);
}

// ── CHARGER ───────────────────────────────────────────────────────────────────

async function loadNotifications() {
  const [tickets, suggestions, sanctions, auditLogs] = await Promise.all([
    fetchSupabase(`tickets?guild_id=eq.${GUILD_ID}&status=eq.open&order=created_at.desc&limit=5`),
    fetchSupabase(`suggestions?guild_id=eq.${GUILD_ID}&status=eq.pending&order=created_at.desc&limit=3`),
    fetchSupabase(`sanctions?guild_id=eq.${GUILD_ID}&active=eq.true&created_at=gte.${hoursAgo(24)}&order=created_at.desc&limit=3`),
    fetchSupabase(`audit_logs?guild_id=eq.${GUILD_ID}&type=eq.moderation&action=in.(automod_ban,automod_kick)&created_at=gte.${hoursAgo(1)}&order=created_at.desc&limit=3`),
  ]);

  const newNotifs = [];

  // Tickets ouverts critiques
  for (const t of tickets || []) {
    const id = `ticket_${t.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'ticket',
        icon   : '🎫',
        color  : 'var(--orange)',
        title  : `Ticket ouvert — ${t.username}`,
        text   : `Type : ${t.type}`,
        time   : t.created_at,
        section: 'tickets',
        read   : false,
      });
    }
  }

  // Suggestions en attente
  for (const s of suggestions || []) {
    const id = `sug_${s.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'suggestion',
        icon   : '💡',
        color  : '#ffbd2e',
        title  : `Nouvelle suggestion`,
        text   : s.content?.slice(0, 50) + '...',
        time   : s.created_at,
        section: 'suggestions',
        read   : false,
      });
    }
  }

  // Sanctions récentes
  for (const s of sanctions || []) {
    const id = `sanc_${s.id}`;
    if (!notifications.find(n => n.id === id)) {
      const icons = { ban: '🔨', kick: '👢', warn: '⚠️', mute: '🔇', timeout: '⏰' };
      newNotifs.push({
        id,
        type   : 'moderation',
        icon   : icons[s.type] || '🛡',
        color  : 'var(--red)',
        title  : `${s.type?.toUpperCase()} — ${s.username}`,
        text   : s.reason || 'Aucune raison',
        time   : s.created_at,
        section: 'moderation',
        read   : false,
      });
    }
  }

  // AutoMod raids
  for (const l of auditLogs || []) {
    const id = `automod_${l.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'security',
        icon   : '🚨',
        color  : 'var(--red)',
        title  : `AutoMod — ${l.action === 'automod_ban' ? 'Ban' : 'Kick'}`,
        text   : `${l.author_name || 'Inconnu'} — Raid détecté`,
        time   : l.created_at,
        section: 'automod',
        read   : false,
      });
    }
  }

  if (newNotifs.length) {
    notifications = [...newNotifs, ...notifications].slice(0, 30);
    unreadCount += newNotifs.length;
    updateBadge();
    renderNotifications();
  } else if (!notifications.length) {
    renderNotifications();
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderNotifications() {
  const el = document.getElementById('notif-list');

  if (!notifications.length) {
    el.innerHTML = `<div class="notif-empty">✅ Aucune notification</div>`;
    return;
  }

  el.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? 'read' : ''}" data-section="${n.section}">
      <div class="notif-item-icon" style="color:${n.color}">${n.icon}</div>
      <div class="notif-item-content">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-text">${n.text}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
      ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
    </div>
  `).join('');

  // Clic sur une notif → naviguer vers la section
  el.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) {
        document.getElementById('notif-dropdown').style.display = 'none';
        document.querySelector(`[data-section="${section}"]`)?.click();
      }
    });
  });
}

// ── BADGE ─────────────────────────────────────────────────────────────────────

function updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (unreadCount > 0) {
    badge.textContent   = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function markAllRead() {
  notifications.forEach(n => n.read = true);
  unreadCount = 0;
  updateBadge();
  renderNotifications();
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Il y a ${hrs}h`;
  return `Il y a ${Math.floor(hrs / 24)}j`;
}