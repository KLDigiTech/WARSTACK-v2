import { fetchSupabase } from '../api.js';
import { GUILD_ID }      from '../config.js';

let notifications = [];
let unreadCount   = 0;

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════

export async function initNotifications() {
  const bell     = document.getElementById('notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  const clearBtn = document.getElementById('notif-clear');

  bell.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.style.display === 'flex';
    dropdown.style.display = open ? 'none' : 'flex';
    if (!open) markAllRead();
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('notif-wrapper').contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  clearBtn.addEventListener('click', () => {
    notifications.forEach(n => n.read = true);
    unreadCount = 0;
    updateBadge();
    renderNotifications();
  });

  await loadNotifications();
  setInterval(loadNotifications, 30000);
}

// ════════════════════════════════════════════════════════
// CHARGER
// ════════════════════════════════════════════════════════

async function loadNotifications() {
  const yesterday = hoursAgo(24);
  const oneHour   = hoursAgo(1);
  const tomorrow  = dayFromNow(1);

  const [tickets, suggestions, sanctions, auditLogs, onboardingLogs, events] = await Promise.all([
    fetchSupabase(`tickets?guild_id=eq.${GUILD_ID}&status=eq.open&order=created_at.desc&limit=5`).catch(() => []),
    fetchSupabase(`suggestions?guild_id=eq.${GUILD_ID}&status=eq.pending&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`sanctions?guild_id=eq.${GUILD_ID}&active=eq.true&created_at=gte.${yesterday}&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`audit_logs?guild_id=eq.${GUILD_ID}&type=eq.moderation&action=in.(automod_ban,automod_kick)&created_at=gte.${oneHour}&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`onboarding_logs?guild_id=eq.${GUILD_ID}&created_at=gte.${yesterday}&order=created_at.desc&limit=5`).catch(() => []),
    fetchSupabase(`events?guild_id=eq.${GUILD_ID}&start_date=lte.${tomorrow}&start_date=gte.${new Date().toISOString()}&status=eq.active&order=start_date.asc&limit=3`).catch(() => []),
  ]);

  const newNotifs = [];

  // 🎫 Tickets ouverts
  for (const t of (Array.isArray(tickets) ? tickets : [])) {
    const id = `ticket_${t.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'ticket',
        icon   : '🎫',
        color  : 'var(--orange)',
        title  : `Ticket ouvert — ${t.username}`,
        text   : `Type : ${t.type || 'Général'}`,
        time   : t.created_at,
        section: 'tickets',
        read   : false,
      });
    }
  }

  // 💡 Suggestions en attente
  for (const s of (Array.isArray(suggestions) ? suggestions : [])) {
    const id = `sug_${s.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'suggestion',
        icon   : '💡',
        color  : 'var(--yellow)',
        title  : `Nouvelle suggestion`,
        text   : (s.content || '').slice(0, 60) + (s.content?.length > 60 ? '...' : ''),
        time   : s.created_at,
        section: 'suggestions',
        read   : false,
      });
    }
  }

  // 🛡 Sanctions récentes
  const sanctIcons = { ban: '🔨', kick: '👢', warn: '⚠️', mute: '🔇', timeout: '⏰' };
  for (const s of (Array.isArray(sanctions) ? sanctions : [])) {
    const id = `sanc_${s.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'moderation',
        icon   : sanctIcons[s.type] || '🛡️',
        color  : 'var(--red)',
        title  : `${(s.type || 'SANCTION').toUpperCase()} — ${s.username}`,
        text   : s.reason || 'Aucune raison',
        time   : s.created_at,
        section: 'moderation',
        read   : false,
      });
    }
  }

  // 🚨 AutoMod raids
  for (const l of (Array.isArray(auditLogs) ? auditLogs : [])) {
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

  // ✅ Nouveaux membres vérifiés (onboarding)
  for (const o of (Array.isArray(onboardingLogs) ? onboardingLogs : [])) {
    const id = `ob_${o.id}`;
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({
        id,
        type   : 'onboarding',
        icon   : '✅',
        color  : 'var(--green)',
        title  : `Nouveau membre vérifié`,
        text   : `${o.username}${o.team ? ` — ${o.team}` : ''}${o.platform ? ` • ${o.platform}` : ''}`,
        time   : o.created_at,
        section: 'onboarding',
        read   : false,
      });
    }
  }

  // 📅 Events à venir (dans les 24h)
  for (const e of (Array.isArray(events) ? events : [])) {
    const id = `event_${e.id}`;
    if (!notifications.find(n => n.id === id)) {
      const diffH = Math.round((new Date(e.start_date) - Date.now()) / 3600000);
      newNotifs.push({
        id,
        type   : 'event',
        icon   : '📅',
        color  : '#5865F2',
        title  : `Event dans ${diffH}h — ${e.name || 'Événement'}`,
        text   : e.description ? e.description.slice(0, 60) + '...' : 'Pense à prévenir les participants.',
        time   : e.created_at || new Date().toISOString(),
        section: 'events',
        read   : false,
      });
    }
  }

  if (newNotifs.length) {
    notifications = [...newNotifs, ...notifications].slice(0, 30);
    unreadCount  += newNotifs.length;
    updateBadge();
    renderNotifications();
  } else if (!notifications.length) {
    renderNotifications();
  }
}

// ════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════

function renderNotifications() {
  const el = document.getElementById('notif-list');
  if (!el) return;

  if (!notifications.length) {
    el.innerHTML = `<div class="notif-empty">✅ Aucune notification</div>`;
    return;
  }

  const typeOrder = ['security', 'ticket', 'moderation', 'onboarding', 'event', 'suggestion'];
  const sorted = [...notifications].sort((a, b) => {
    const ai = typeOrder.indexOf(a.type);
    const bi = typeOrder.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    return new Date(b.time) - new Date(a.time);
  });

  el.innerHTML = sorted.map(n => `
    <div class="notif-item ${n.read ? 'read' : ''}" data-section="${n.section}" data-id="${n.id}">
      <div class="notif-item-icon" style="color:${n.color}">${n.icon}</div>
      <div class="notif-item-content">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-text">${n.text}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
      ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
    </div>
  `).join('');

  el.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      const id      = item.dataset.id;
      const notif = notifications.find(n => n.id === id);
      if (notif && !notif.read) {
        notif.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
      }
      document.getElementById('notif-dropdown').style.display = 'none';
      if (section) document.querySelector(`[data-section="${section}"]`)?.click();
    });
  });
}

// ════════════════════════════════════════════════════════
// BADGE
// ════════════════════════════════════════════════════════

function updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
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

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function dayFromNow(d) {
  return new Date(Date.now() + d * 86400000).toISOString();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Il y a ${hrs}h`;
  return `Il y a ${Math.floor(hrs / 24)}j`;
}