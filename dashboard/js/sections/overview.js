import { fetchSupabase, callBotAPI } from '../api.js';
import { showSkeleton } from '../ui/skeleton.js';

const GUILD_ID = '1501685144501620798';

export async function initOverview() {
  // Skeletons immédiats
  showSkeleton('ov-activity-list',    'activity',   7);
  showSkeleton('ov-tickets-list',     'panel-rows', 4);
  showSkeleton('ov-suggestions-list', 'panel-rows', 4);
  showSkeleton('ov-events-list',      'panel-rows', 3);

  // Skeleton KPI values
  document.querySelectorAll('.ov-kpi-value').forEach(el => {
    el.innerHTML = `<span class="skeleton sk-title" style="width:52px;display:inline-block"></span>`;
  });
  document.querySelectorAll('.ov-kpi-trend').forEach(el => {
    el.innerHTML = `<span class="skeleton" style="width:36px;height:16px;display:inline-block;border-radius:20px"></span>`;
  });

  await Promise.all([
    loadServerStats(),
    loadBotHealth(),
    loadActivity(),
    loadTickets(),
    loadSuggestions(),
    loadEvents(),
  ]);

  // Clicks KPI → section
  document.querySelectorAll('.ov-kpi-card[data-section]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelector(`[data-section="${card.dataset.section}"]`)?.click();
    });
  });

  // Clicks "Voir tout"
  document.querySelectorAll('.ov-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.getAttribute('href').replace('#', '');
      document.querySelector(`[data-section="${section}"]`)?.click();
    });
  });
}

// ── KPI STATS ──────────────────────────────────────────────────────────────────

async function loadServerStats() {
  const [guildData, tickets, suggestions, events, sanctions, automodLogs] = await Promise.all([
    callBotAPI('guild').catch(() => null),
    fetchSupabase(`tickets?guild_id=eq.${GUILD_ID}&status=eq.open&select=id`).catch(() => []),
    fetchSupabase(`suggestions?select=id`).catch(() => []),
    fetchSupabase(`events?select=id`).catch(() => []),
    fetchSupabase(`sanctions?guild_id=eq.${GUILD_ID}&created_at=gte.${weekAgo()}&select=id`).catch(() => []),
    fetchSupabase(`audit_logs?guild_id=eq.${GUILD_ID}&type=eq.moderation&created_at=gte.${weekAgo()}&select=id`).catch(() => []),
  ]);

  const members     = guildData?.member_count    || 0;
  const ticketCount = Array.isArray(tickets)     ? tickets.length     : 0;
  const suggCount   = Array.isArray(suggestions) ? suggestions.length : 0;
  const evtCount    = Array.isArray(events)      ? events.length      : 0;
  const warnCount   = Array.isArray(sanctions)   ? sanctions.length   : 0;
  const autoCount   = Array.isArray(automodLogs) ? automodLogs.length : 0;

  setKPI('ov-members',     members,     members > 0 ? 'up' : 'flat',   Math.min(members / 500 * 100, 100));
  setKPI('ov-tickets',     ticketCount, ticketCount > 5 ? 'down' : ticketCount > 0 ? 'flat' : 'up', Math.min(ticketCount / 20 * 100, 100));
  setKPI('ov-suggestions', suggCount,   suggCount > 0 ? 'up' : 'flat', Math.min(suggCount / 50 * 100, 100));
  setKPI('ov-events',      evtCount,    evtCount > 0  ? 'up' : 'flat', Math.min(evtCount / 10 * 100, 100));
  setKPI('ov-automod',     autoCount,   autoCount > 10 ? 'down' : 'flat', Math.min(autoCount / 30 * 100, 100));
  setKPI('ov-warns',       warnCount,   warnCount > 5  ? 'down' : 'flat', Math.min(warnCount / 20 * 100, 100));
}

function setKPI(id, value, trend, barPct) {
  const valueEl = document.getElementById(id);
  const trendEl = document.getElementById(`${id}-trend`);
  const barEl   = document.getElementById(`${id}-bar`);

  if (valueEl) valueEl.textContent = value || '0';

  if (trendEl) {
    const labels = { up: '▲ Actif', down: '▼ Élevé', flat: '— Stable' };
    trendEl.textContent  = labels[trend] || '—';
    trendEl.className    = `ov-kpi-trend ${trend}`;
  }

  if (barEl) {
    // Délai pour que l'animation CSS soit visible
    setTimeout(() => { barEl.style.width = `${barPct}%`; }, 100);
  }
}

// ── SANTÉ BOT ──────────────────────────────────────────────────────────────────

async function loadBotHealth() {
  const data   = await callBotAPI('status').catch(() => null);
  const badge  = document.getElementById('ov-bot-status');
  const uptime = document.getElementById('ov-uptime');

  if (!badge) return;

  if (data?.status === 'online') {
    badge.textContent = '🟢 Online';
    badge.className   = 'ov-health-badge green';
  } else {
    badge.textContent = '🔴 Offline';
    badge.className   = 'ov-health-badge red';
  }

  if (uptime && data?.uptime) {
    const mins = Math.floor(data.uptime / 60);
    const hrs  = Math.floor(mins / 60);
    uptime.textContent = hrs > 0 ? `${hrs}h ${mins % 60}min` : `${mins}min`;
  }
}

// ── ACTIVITY FEED ──────────────────────────────────────────────────────────────

async function loadActivity() {
  const logs = await fetchSupabase(
    `audit_logs?guild_id=eq.${GUILD_ID}&order=created_at.desc&limit=12`
  ).catch(() => []) || [];

  const el = document.getElementById('ov-activity-list');
  if (!el) return;

  if (!logs.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-inbox"></i> Aucune activité récente.</div>`;
    return;
  }

  const iconMap = {
    message_delete  : { i: '🗑', bg: 'rgba(255,68,68,.1)' },
    message_edit    : { i: '✏️', bg: 'rgba(255,255,255,.06)' },
    member_join     : { i: '➕', bg: 'rgba(0,230,118,.1)' },
    member_leave    : { i: '➖', bg: 'rgba(255,107,53,.1)' },
    ticket_open     : { i: '🎫', bg: 'rgba(255,189,46,.1)' },
    ticket_close    : { i: '🔒', bg: 'rgba(255,255,255,.06)' },
    suggestion_post : { i: '💡', bg: 'rgba(64,196,255,.1)' },
    ban             : { i: '🔨', bg: 'rgba(255,68,68,.15)' },
    kick            : { i: '👢', bg: 'rgba(255,68,68,.12)' },
    warn            : { i: '⚠️', bg: 'rgba(255,189,46,.12)' },
    mute            : { i: '🔇', bg: 'rgba(255,107,53,.1)' },
    automod_kick    : { i: '🤖', bg: 'rgba(0,255,100,.08)' },
    automod_ban     : { i: '🤖', bg: 'rgba(255,68,68,.1)' },
  };

  el.innerHTML = logs.map(l => {
    const ic = iconMap[l.action] || { i: '📋', bg: 'rgba(255,255,255,.05)' };
    return `
      <div class="ov-activity-row">
        <div class="ov-activity-icon-wrap" style="background:${ic.bg}">${ic.i}</div>
        <div class="ov-activity-body">
          <div class="ov-activity-text">
            ${l.author_name ? `<span class="ov-activity-author">${l.author_name}</span>` : ''}
            ${actionLabel(l.action)}
            ${l.target_name ? `<span style="color:var(--text-muted)"> → ${l.target_name}</span>` : ''}
          </div>
        </div>
        <span class="ov-activity-time">${timeAgo(l.created_at)}</span>
      </div>
    `;
  }).join('');
}

// ── TICKETS ────────────────────────────────────────────────────────────────────

async function loadTickets() {
  const tickets = await fetchSupabase(
    `tickets?guild_id=eq.${GUILD_ID}&status=neq.closed&order=created_at.desc&limit=5`
  ).catch(() => []) || [];

  const el = document.getElementById('ov-tickets-list');
  if (!el) return;

  if (!tickets.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-check-circle" style="color:var(--success)"></i> Aucun ticket ouvert.</div>`;
    return;
  }

  el.innerHTML = tickets.map(t => {
    const statusClass = t.status === 'open' ? 'ov-status-open' : 'ov-status-progress';
    const statusLabel = t.status === 'open' ? 'Ouvert' : 'En cours';
    return `
      <div class="ov-ticket-row">
        <div style="flex:1;min-width:0">
          <div class="ov-ticket-name">${t.username || '—'}</div>
          <div class="ov-ticket-meta">${t.type || 'ticket'} · ${timeAgo(t.created_at)}</div>
        </div>
        <span class="ov-status-pill ${statusClass}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

// ── SUGGESTIONS ────────────────────────────────────────────────────────────────

async function loadSuggestions() {
  const suggestions = await fetchSupabase(
    `suggestions?order=created_at.desc&limit=4`
  ).catch(() => []) || [];

  const el = document.getElementById('ov-suggestions-list');
  if (!el) return;

  if (!suggestions.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-lightbulb"></i> Aucune suggestion.</div>`;
    return;
  }

  const statusMap = {
    pending    : { cls: 'ov-status-pending',  label: 'En attente' },
    reviewing  : { cls: 'ov-status-progress', label: 'En cours' },
    accepted   : { cls: 'ov-status-accepted', label: 'Acceptée' },
    refused    : { cls: 'ov-status-refused',  label: 'Refusée' },
    implemented: { cls: 'ov-status-past',     label: 'Implémentée' },
  };

  el.innerHTML = suggestions.map(s => {
    const st = statusMap[s.status] || { cls: 'ov-status-pending', label: s.status || '—' };
    return `
      <div class="ov-ticket-row">
        <div style="flex:1;min-width:0">
          <div class="ov-ticket-name" style="font-weight:500">${s.content?.slice(0, 52) || '—'}…</div>
          <div class="ov-ticket-meta">${s.username || '—'} · ${timeAgo(s.created_at)}</div>
        </div>
        <span class="ov-status-pill ${st.cls}">${st.label}</span>
      </div>
    `;
  }).join('');
}

// ── EVENTS ─────────────────────────────────────────────────────────────────────

async function loadEvents() {
  const events = await fetchSupabase(
    `events?order=date.asc&limit=3`
  ).catch(() => []) || [];

  const el = document.getElementById('ov-events-list');
  if (!el) return;

  if (!events.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-calendar-times"></i> Aucun event à venir.</div>`;
    return;
  }

  el.innerHTML = events.map(e => {
    const d    = new Date(e.date);
    const past = d < new Date();
    return `
      <div class="ov-ticket-row">
        <div style="flex:1;min-width:0">
          <div class="ov-ticket-name" style="${past ? 'color:var(--text-muted)' : ''}">${e.title}</div>
          <div class="ov-ticket-meta">📅 ${d.toLocaleDateString('fr-FR')}${e.time ? ' · ' + e.time : ''}</div>
        </div>
        <span class="ov-status-pill ${past ? 'ov-status-past' : 'ov-status-future'}">
          ${past ? 'Terminé' : 'À venir'}
        </span>
      </div>
    `;
  }).join('');
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
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

function actionLabel(a) {
  return ({
    message_delete  : 'a supprimé un message',
    message_edit    : 'a modifié un message',
    member_join     : 'a rejoint le serveur',
    member_leave    : 'a quitté le serveur',
    ticket_open     : 'a ouvert un ticket',
    ticket_close    : 'a fermé un ticket',
    suggestion_post : 'a posté une suggestion',
    ban             : 'a été banni',
    kick            : 'a été kick',
    warn            : 'a reçu un warn',
    mute            : 'a été mute',
    automod_kick    : 'AutoMod — kick auto',
    automod_ban     : 'AutoMod — ban auto',
  })[a] || a;
}