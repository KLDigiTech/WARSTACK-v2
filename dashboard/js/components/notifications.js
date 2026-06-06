import { fetchSupabase } from '../api.js';
import { GUILD_ID }      from '../config.js';

let notifications = [];
let unreadCount   = 0;
let activeFilter  = 'all';

// ── INIT ──────────────────────────────────────────────────────────────────────

export async function initNotifications() {
  const bell     = document.getElementById('notif-bell');
  const bellMob  = document.getElementById('notif-bell-mobile');
  const dropdown = document.getElementById('notif-dropdown');

  // Remplacer le header basique par le header premium
  const header = dropdown.querySelector('.notif-header');
  if (header) {
    header.innerHTML = `
      <div class="notif-header-left">
        <span class="notif-header-title">Notifications</span>
        <span class="notif-count-badge" id="notif-count-badge" style="display:none">0</span>
      </div>
      <button class="notif-clear" id="notif-clear">Tout lire</button>
    `;
  }

  // Injecter les filtres après le header
  const filterBar = document.createElement('div');
  filterBar.className = 'notif-filters';
  filterBar.id = 'notif-filters';
  filterBar.innerHTML = `
    <button class="notif-filter-btn active" data-filter="all">Tout</button>
    <button class="notif-filter-btn" data-filter="security">🚨 Sécurité</button>
    <button class="notif-filter-btn" data-filter="ticket">🎫 Tickets</button>
    <button class="notif-filter-btn" data-filter="moderation">🛡 Modération</button>
    <button class="notif-filter-btn" data-filter="suggestion">💡 Suggestions</button>
    <button class="notif-filter-btn" data-filter="onboarding">✅ Membres</button>
    <button class="notif-filter-btn" data-filter="event">📅 Events</button>
  `;
  dropdown.insertBefore(filterBar, dropdown.querySelector('.notif-list'));

  // Ajouter footer
  const footer = document.createElement('div');
  footer.className = 'notif-footer';
  footer.innerHTML = `<button class="notif-footer-btn" id="notif-clear-all">🗑 Effacer tout l'historique</button>`;
  dropdown.appendChild(footer);

  // Events filtres
  filterBar.querySelectorAll('.notif-filter-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      filterBar.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderNotifications();
    });
  });

  // Toggle dropdown — desktop + mobile
  function toggleDropdown(e) {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'flex';
    dropdown.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) markAllRead();
  }

  bell?.addEventListener('click', toggleDropdown);
  bellMob?.addEventListener('click', toggleDropdown);

  // Fermer en cliquant ailleurs — le dropdown est hors des wrappers donc on vérifie les 3
  document.addEventListener('click', e => {
    if (dropdown.style.display !== 'flex') return;
    const inDropdown = dropdown.contains(e.target);
    const inDesktop  = document.getElementById('notif-wrapper')?.contains(e.target);
    const inMobile   = document.getElementById('notif-wrapper-mobile')?.contains(e.target);
    if (!inDropdown && !inDesktop && !inMobile) {
      dropdown.style.display = 'none';
    }
  });

  // Clear boutons
  dropdown.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.id === 'notif-clear' || e.target.closest('#notif-clear')) {
      markAllRead();
    }
    if (e.target.id === 'notif-clear-all' || e.target.closest('#notif-clear-all')) {
      notifications = [];
      unreadCount = 0;
      updateBadge();
      renderNotifications();
    }
  });

  await loadNotifications();
  setInterval(loadNotifications, 30000);
}

// ── CHARGER ───────────────────────────────────────────────────────────────────

async function loadNotifications() {
  const yesterday = hoursAgo(24);
  const oneHour   = hoursAgo(1);
  const now       = new Date().toISOString().split('T')[0];

  const [tickets, suggestions, sanctions, auditLogs, onboardingLogs, events] = await Promise.all([
    fetchSupabase(`tickets?guild_id=eq.${GUILD_ID}&status=eq.open&order=created_at.desc&limit=5`).catch(() => []),
    fetchSupabase(`suggestions?status=eq.pending&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`sanctions?guild_id=eq.${GUILD_ID}&active=eq.true&created_at=gte.${yesterday}&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`audit_logs?guild_id=eq.${GUILD_ID}&type=eq.moderation&action=in.(automod_ban,automod_kick)&created_at=gte.${oneHour}&order=created_at.desc&limit=3`).catch(() => []),
    fetchSupabase(`onboarding_logs?guild_id=eq.${GUILD_ID}&created_at=gte.${yesterday}&order=created_at.desc&limit=5`).catch(() => []),
    fetchSupabase(`events?date=gte.${now}&status=eq.open&order=date.asc&limit=3`).catch(() => []),
  ]);

  const newNotifs = [];

  const add = (id, notif) => {
    if (!notifications.find(n => n.id === id)) {
      newNotifs.push({ id, ...notif, read: false });
    }
  };

  for (const t of arr(tickets)) {
    add(`ticket_${t.id}`, {
      type: 'ticket', icon: '🎫',
      color: 'var(--warning)', bg: 'rgba(255,189,46,.12)',
      title: `Ticket — ${t.username}`,
      text: `Type : ${t.type || 'Général'}`,
      time: t.created_at, section: 'tickets',
    });
  }

  for (const s of arr(suggestions)) {
    add(`sug_${s.id}`, {
      type: 'suggestion', icon: '💡',
      color: 'var(--info)', bg: 'rgba(64,196,255,.1)',
      title: 'Nouvelle suggestion',
      text: (s.content || '').slice(0, 60) + (s.content?.length > 60 ? '…' : ''),
      time: s.created_at, section: 'suggestions',
    });
  }

  const sanctIcons = { ban: '🔨', kick: '👢', warn: '⚠️', mute: '🔇', timeout: '⏰' };
  for (const s of arr(sanctions)) {
    add(`sanc_${s.id}`, {
      type: 'moderation', icon: sanctIcons[s.type] || '🛡️',
      color: 'var(--danger)', bg: 'var(--danger-soft)',
      title: `${(s.type || 'SANCTION').toUpperCase()} — ${s.username}`,
      text: s.reason || 'Aucune raison',
      time: s.created_at, section: 'moderation',
    });
  }

  for (const l of arr(auditLogs)) {
    add(`automod_${l.id}`, {
      type: 'security', icon: '🚨',
      color: 'var(--danger)', bg: 'var(--danger-soft)',
      title: `AutoMod — ${l.action === 'automod_ban' ? 'Ban' : 'Kick'}`,
      text: `${l.author_name || 'Inconnu'} — Raid détecté`,
      time: l.created_at, section: 'automod',
    });
  }

  for (const o of arr(onboardingLogs)) {
    add(`ob_${o.id}`, {
      type: 'onboarding', icon: '✅',
      color: 'var(--success)', bg: 'var(--success-soft)',
      title: 'Nouveau membre vérifié',
      text: `${o.username}${o.team ? ` — ${o.team}` : ''}${o.platform ? ` · ${o.platform}` : ''}`,
      time: o.created_at, section: 'onboarding',
    });
  }

  for (const e of arr(events)) {
    add(`event_${e.id}`, {
      type: 'event', icon: '📅',
      color: '#5865F2', bg: 'rgba(88,101,242,.12)',
      title: `Event — ${e.title || 'Événement'}`,
      text: `📅 ${e.date || ''}${e.time ? ' à ' + e.time : ''}`,
      time: e.created_at || new Date().toISOString(), section: 'events',
    });
  }

  if (newNotifs.length) {
    notifications = [...newNotifs, ...notifications].slice(0, 50);
    unreadCount  += newNotifs.length;
    updateBadge();
    renderNotifications();
    document.getElementById('notif-bell')?.classList.add('has-unread');
    document.getElementById('notif-bell-mobile')?.classList.add('has-unread');
  } else if (!notifications.length) {
    renderNotifications();
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderNotifications() {
  const el = document.getElementById('notif-list');
  if (!el) return;

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  if (!filtered.length) {
    el.innerHTML = `
      <div class="notif-empty">
        <i class="fas fa-bell-slash"></i>
        ${activeFilter === 'all' ? 'Aucune notification' : 'Aucune notification dans cette catégorie'}
      </div>`;
    return;
  }

  const typeOrder = ['security', 'moderation', 'ticket', 'onboarding', 'event', 'suggestion'];
  const sorted = [...filtered].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    const ai = typeOrder.indexOf(a.type);
    const bi = typeOrder.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    return new Date(b.time) - new Date(a.time);
  });

  const groups = {};
  for (const n of sorted) {
    const label = dateGroupLabel(n.time);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  let html = '';
  for (const [label, items] of Object.entries(groups)) {
    html += `<div class="notif-group-label">${label}</div>`;
    html += items.map(n => `
      <div class="notif-item ${n.read ? 'read' : ''}"
           data-section="${n.section}"
           data-id="${n.id}"
           style="--notif-color:${n.color}">
        <div class="notif-item-icon" style="background:${n.bg || 'var(--surface-3)'}">
          ${n.icon}
        </div>
        <div class="notif-item-content">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-text">${n.text}</div>
          <div class="notif-item-time">${timeAgo(n.time)}</div>
        </div>
        ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
      </div>
    `).join('');
  }

  el.innerHTML = html;

  el.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const notif = notifications.find(n => n.id === item.dataset.id);
      if (notif && !notif.read) {
        notif.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
        item.classList.add('read');
        item.querySelector('.notif-unread-dot')?.remove();
      }
      document.getElementById('notif-dropdown').style.display = 'none';
      const section = item.dataset.section;
      if (section) document.querySelector(`[data-section="${section}"]`)?.click();
    });
  });
}

// ── BADGE ─────────────────────────────────────────────────────────────────────

function updateBadge() {
  const badge      = document.getElementById('notif-badge');
  const badgeMob   = document.getElementById('notif-badge-mobile');
  const countBadge = document.getElementById('notif-count-badge');
  const bell       = document.getElementById('notif-bell');
  const bellMob    = document.getElementById('notif-bell-mobile');

  if (unreadCount > 0) {
    const label = unreadCount > 9 ? '9+' : String(unreadCount);
    if (badge)      { badge.textContent = label;    badge.style.display = 'flex'; }
    if (badgeMob)   { badgeMob.textContent = label; badgeMob.style.display = 'flex'; }
    if (countBadge) { countBadge.textContent = `${unreadCount} non lues`; countBadge.style.display = 'inline-block'; }
    bell?.classList.add('has-unread');
    bellMob?.classList.add('has-unread');
  } else {
    if (badge)      badge.style.display = 'none';
    if (badgeMob)   badgeMob.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    bell?.classList.remove('has-unread');
    bellMob?.classList.remove('has-unread');
  }
}

function markAllRead() {
  notifications.forEach(n => n.read = true);
  unreadCount = 0;
  updateBadge();
  renderNotifications();
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function arr(v) { return Array.isArray(v) ? v : []; }

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

function dateGroupLabel(iso) {
  if (!iso) return 'Ancien';
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now - d;
  const day  = 86400000;
  if (diff < day)     return 'Aujourd\'hui';
  if (diff < 2 * day) return 'Hier';
  if (diff < 7 * day) return 'Cette semaine';
  return 'Plus ancien';
}