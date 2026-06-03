import { fetchSupabase, callBotAPI } from '../api.js';

const GUILD_ID = '1501685144501620798';

export async function initOverview() {
  await Promise.all([
    loadServerStats(),
    loadBotHealth(),
    loadActivity(),
    loadTickets(),
    loadSuggestions(),
    loadEvents(),
  ]);
    // Navigation au clic sur les stat cards
  document.querySelectorAll('.ov-stat-card').forEach(card => {
    const section = card.dataset.section;
    if (section) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        document.querySelector(`[data-section="${section}"]`)?.click();
      });
    }
  });

  // Liens "Voir tout"
  document.querySelectorAll('.ov-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.getAttribute('href').replace('#', '');
      document.querySelector(`[data-section="${section}"]`)?.click();
    });
  });
}

// ── STATS SERVEUR ─────────────────────────────────────────────────────────────

async function loadServerStats() {
  const [guildData, tickets, suggestions, events, sanctions, automodLogs] = await Promise.all([
    callBotAPI('guild'),
    fetchSupabase(`tickets?guild_id=eq.${GUILD_ID}&status=eq.open&select=id`),
    fetchSupabase(`suggestions?guild_id=eq.${GUILD_ID}&select=id`),
    fetchSupabase(`events?guild_id=eq.${GUILD_ID}&status=eq.active&select=id`),
    fetchSupabase(`sanctions?guild_id=eq.${GUILD_ID}&created_at=gte.${weekAgo()}&select=id`),
    fetchSupabase(`audit_logs?guild_id=eq.${GUILD_ID}&type=eq.moderation&created_at=gte.${weekAgo()}&select=id`),
  ]);

  document.getElementById('ov-members').textContent     = guildData?.member_count  || '—';
  document.getElementById('ov-tickets').textContent     = tickets?.length          || '0';
  document.getElementById('ov-suggestions').textContent = suggestions?.length      || '0';
  document.getElementById('ov-events').textContent      = events?.length           || '0';
  document.getElementById('ov-warns').textContent       = sanctions?.length        || '0';
  document.getElementById('ov-automod').textContent     = automodLogs?.length      || '0';

  // Couleur tickets si urgents
  const ticketEl = document.getElementById('ov-tickets');
  if ((tickets?.length || 0) > 5) ticketEl.style.color = 'var(--red)';
  else if ((tickets?.length || 0) > 0) ticketEl.style.color = 'var(--orange)';
}

// ── SANTÉ BOT ─────────────────────────────────────────────────────────────────

async function loadBotHealth() {
  const data   = await callBotAPI('status');
  const badge  = document.getElementById('ov-bot-status');
  const uptime = document.getElementById('ov-uptime');

  if (data?.status === 'online') {
    badge.textContent = '🟢 Online';
    badge.className   = 'ov-health-badge green';
  } else {
    badge.textContent = '🔴 Offline';
    badge.className   = 'ov-health-badge red';
  }

  if (data?.uptime) {
    const mins = Math.floor(data.uptime / 60);
    const hrs  = Math.floor(mins / 60);
    uptime.textContent = hrs > 0 ? `${hrs}h ${mins % 60}min` : `${mins}min`;
  }
}

// ── ACTIVITÉ RÉCENTE ──────────────────────────────────────────────────────────

async function loadActivity() {
  const logs = await fetchSupabase(
    `audit_logs?guild_id=eq.${GUILD_ID}&order=created_at.desc&limit=10`
  ) || [];

  const el = document.getElementById('ov-activity-list');

  if (!logs.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune activité récente.</div>`;
    return;
  }

  const icons = {
    message_delete  : '🗑',
    message_edit    : '✏️',
    member_join     : '➕',
    member_leave    : '➖',
    ticket_open     : '🎫',
    ticket_close    : '🔒',
    suggestion_post : '💡',
    ban             : '🔨',
    kick            : '👢',
    warn            : '⚠️',
    mute            : '🔇',
    automod_kick    : '🤖',
    automod_ban     : '🤖',
  };

  el.innerHTML = logs.map(l => `
    <div class="ov-activity-row">
      <span class="ov-activity-icon">${icons[l.action] || '📋'}</span>
      <div class="ov-activity-content">
        <span class="ov-activity-text">${actionLabel(l.action)}</span>
        ${l.author_name ? `<span class="ov-activity-author">${l.author_name}</span>` : ''}
      </div>
      <span class="ov-activity-time">${timeAgo(l.created_at)}</span>
    </div>
  `).join('');
}

// ── TICKETS ───────────────────────────────────────────────────────────────────

async function loadTickets() {
  const tickets = await fetchSupabase(
    `tickets?guild_id=eq.${GUILD_ID}&status=neq.closed&order=created_at.desc&limit=5`
  ) || [];

  const el = document.getElementById('ov-tickets-list');

  if (!tickets.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">✅ Aucun ticket ouvert.</div>`;
    return;
  }

  const priorityColors = { low: '#00ff66', normal: '#ffbd2e', high: '#ff6b35', critical: '#ff4444' };
  const statusColors   = { open: 'var(--green)', in_progress: '#5865f2' };

  el.innerHTML = tickets.map(t => `
    <div class="ov-ticket-row">
      <div>
        <div style="font-size:0.85rem;font-weight:600;color:var(--text)">${t.username}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${t.type} · ${timeAgo(t.created_at)}</div>
      </div>
      <div style="text-align:right">
        <span style="font-size:0.7rem;color:${statusColors[t.status] || 'var(--text-muted)'}">
          ${t.status === 'open' ? '🟢 Ouvert' : '🔵 En cours'}
        </span>
        ${t.priority ? `<div style="font-size:0.68rem;color:${priorityColors[t.priority]}">${t.priority}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── SUGGESTIONS ───────────────────────────────────────────────────────────────

async function loadSuggestions() {
  const suggestions = await fetchSupabase(
    `suggestions?guild_id=eq.${GUILD_ID}&order=created_at.desc&limit=4`
  ) || [];

  const el = document.getElementById('ov-suggestions-list');

  if (!suggestions.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune suggestion.</div>`;
    return;
  }

  const statusColors = {
    pending    : '#ffbd2e',
    reviewing  : '#5865f2',
    accepted   : 'var(--green)',
    refused    : 'var(--red)',
    implemented: '#ccc',
  };

  el.innerHTML = suggestions.map(s => `
    <div class="ov-ticket-row">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${s.content?.slice(0, 60) || '—'}...
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted)">${s.username} · ${timeAgo(s.created_at)}</div>
      </div>
      <span style="font-size:0.68rem;color:${statusColors[s.status] || 'var(--text-muted)'};flex-shrink:0;margin-left:0.5rem">
        ${s.status || 'pending'}
      </span>
    </div>
  `).join('');
}

// ── EVENTS ────────────────────────────────────────────────────────────────────

async function loadEvents() {
  const events = await fetchSupabase(
    `events?guild_id=eq.${GUILD_ID}&order=date.asc&limit=3`
  ) || [];

  const el = document.getElementById('ov-events-list');

  if (!events.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun event à venir.</div>`;
    return;
  }

  el.innerHTML = events.map(e => {
    const d    = new Date(e.date);
    const past = d < new Date();
    return `
      <div class="ov-ticket-row">
        <div>
          <div style="font-size:0.85rem;font-weight:600;color:${past ? 'var(--text-muted)' : 'var(--text)'}">
            ${e.title}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted)">
            📅 ${d.toLocaleDateString('fr-FR')} à ${e.time || '—'}
          </div>
        </div>
        <span style="font-size:0.7rem;color:${past ? 'var(--text-muted)' : 'var(--green)'}">
          ${past ? 'Terminé' : '🟢 À venir'}
        </span>
      </div>
    `;
  }).join('');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
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

function actionLabel(a) {
  return {
    message_delete  : 'Message supprimé',
    message_edit    : 'Message modifié',
    member_join     : 'Membre rejoint',
    member_leave    : 'Membre parti',
    ticket_open     : 'Ticket ouvert',
    ticket_close    : 'Ticket fermé',
    suggestion_post : 'Suggestion postée',
    ban             : 'Ban',
    kick            : 'Kick',
    warn            : 'Warn',
    mute            : 'Mute',
    automod_kick    : 'AutoMod Kick',
    automod_ban     : 'AutoMod Ban',
  }[a] || a;
}