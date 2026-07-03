import { fetchSupabase, callBotAPI } from '../api.js';
import { showSkeleton } from '../ui/skeleton.js';
import { getActiveGuildId } from '../services/guildService.js';

export async function initOverview() {
  const isMember = window.WARSTACK_IS_MEMBER === true || window._memberViewActive === true;

  const staffOv = document.getElementById('staff-overview');
  const memberOv = document.getElementById('member-overview');
  if (!staffOv || !memberOv) return;

  if (isMember) {
    staffOv.style.display = 'none';
    memberOv.style.display = 'block';
    await initMemberOverview();
    return;
  }

  staffOv.style.display = 'block';
  memberOv.style.display = 'none';

  // Bonjour
  const username = window.WARSTACK_USERNAME || '';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const greetEl = document.getElementById('ov-greeting-text');
  if (greetEl) greetEl.textContent = username ? `👋 ${greet}, ${username} !` : `👋 ${greet} !`;

  showSkeleton('ov-activity-list', 'activity', 7);
  showSkeleton('ov-tickets-list', 'panel-rows', 4);
  showSkeleton('ov-suggestions-list', 'panel-rows', 4);
  showSkeleton('ov-events-list', 'panel-rows', 3);

  document.querySelectorAll('.ov-kpi-value').forEach(el => {
    el.innerHTML = `<span class="skeleton sk-title" style="width:52px;display:inline-block"></span>`;
  });

  await Promise.all([
    loadServerStats(),
    loadBotHealth(),
    loadActivity(),
    loadTickets(),
    loadSuggestions(),
    loadEvents(),
  ]);

  document.querySelectorAll('.ov-kpi-card[data-section]').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      document.querySelector(`[data-section="${card.dataset.section}"]`)?.click();
    });
  });

  // ── Liens "Voir tout →" etc : gérés globalement par app.js (.nav-item-inline) ──
}

// Helper local — lit dans le tableau configs chargé par loadServerStats
let _overviewConfigs = [];
const getConf = (key) => _overviewConfigs?.find(c => c.key === key)?.value || null;

async function loadServerStats() {
  const guildId = await getActiveGuildId();
  const [guildData, tickets, suggestions, events, sanctions, automodLogs, xpRows, tournois, configs] = await Promise.all([
    callBotAPI('guild').catch(() => null),
    fetchSupabase(`tickets?guild_id=eq.${guildId}&status=eq.open&select=id`).catch(() => []),
    fetchSupabase(`suggestions?guild_id=eq.${guildId}&select=id`).catch(() => []),
    fetchSupabase(`events?guild_id=eq.${guildId}&select=id`).catch(() => []),
    fetchSupabase(`sanctions?guild_id=eq.${guildId}&created_at=gte.${weekAgo()}&select=id`).catch(() => []),
    fetchSupabase(`audit_logs?guild_id=eq.${guildId}&type=eq.moderation&created_at=gte.${weekAgo()}&select=id`).catch(() => []),
    fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=discord_id`).catch(() => []),
    fetchSupabase(`tournaments?guild_id=eq.${guildId}&status=eq.active&select=id`).catch(() => []),
    fetchSupabase(`config?guild_id=eq.${guildId}&select=key,value`).catch(() => []),
  ]);

  _overviewConfigs = Array.isArray(configs) ? configs : [];

  const members = guildData?.member_count || 0;
  const joueurs = xpRows?.length || 0;
  const ticketCount = Array.isArray(tickets) ? tickets.length : 0;
  const evtCount = Array.isArray(events) ? events.length : 0;
  const tourCount = Array.isArray(tournois) ? tournois.length : 0;

  setKPI('ov-members', members, members > 0 ? 'up' : 'flat');
  setKPI('ov-joueurs', joueurs, joueurs > 0 ? 'up' : 'flat');
  setKPI('ov-tickets', ticketCount, ticketCount > 5 ? 'down' : ticketCount > 0 ? 'flat' : 'up');
  setKPI('ov-tournois', tourCount, tourCount > 0 ? 'up' : 'flat');

  // Sous-titre dynamique
  const subEl = document.getElementById('ov-greeting-sub');
  if (subEl) {
    const serverName = guildData?.name || 'votre serveur';
    subEl.textContent = `${serverName} • ${members} membre${members !== 1 ? 's' : ''} • Bot ✅`;
  }

  // Barre de progression configuration
  const SETUP_CHECKS = [
    { key: 'welcome_channel', label: 'Message de bienvenue', section: 'welcome' },
    { key: 'ticket_category', label: 'Tickets', section: 'tickets' },
    { key: 'ob_channel', label: 'Onboarding membres', section: 'onboarding' },
    { key: 'automod_enabled', label: 'Protection auto', section: 'automod' },
    { key: 'log_channel', label: 'Historique actions', section: 'logs' },
  ];

  const done = SETUP_CHECKS.filter(c => getConf(c.key)).length;
  const total = SETUP_CHECKS.length;
  const pct = Math.round((done / total) * 100);
  const missing = SETUP_CHECKS.filter(c => !getConf(c.key));

  const progressEl = document.getElementById('ov-greeting-progress');
  const fillEl = document.getElementById('ov-progress-fill');
  const pctEl = document.getElementById('ov-progress-pct');
  const stepsEl = document.getElementById('ov-progress-steps');

  if (progressEl && pct < 100) {
    progressEl.style.display = '';
    pctEl.textContent = `${pct}%`;
    setTimeout(() => { if (fillEl) fillEl.style.width = `${pct}%`; }, 100);
    if (stepsEl) {
      stepsEl.innerHTML = missing.slice(0, 3).map(c =>
        `<span class="ov-progress-step" data-section="${c.section}">☐ ${c.label}</span>`
      ).join('');
      stepsEl.querySelectorAll('.ov-progress-step').forEach(el => {
        el.addEventListener('click', () => document.querySelector(`[data-section="${el.dataset.section}"]`)?.click());
      });
    }
  }

  // Actions recommandées en CARTES
  const ALL_ACTIONS = [
    { icon: '👋', label: 'Configurer le message de bienvenue', sub: 'Les nouveaux membres ne reçoivent aucun message.', section: 'welcome', cta: 'Configurer', check: !getConf('welcome_channel') },
    { icon: '🎫', label: 'Activer les tickets', sub: 'Permettez à vos membres de contacter l\'équipe.', section: 'tickets', cta: 'Activer', check: !getConf('ticket_category') },
    { icon: '🎮', label: 'Ajouter votre premier joueur', sub: 'Aucun joueur enregistré sur WARSTACK.', section: 'players', cta: 'Ajouter', check: joueurs === 0 },
    { icon: '📅', label: 'Créer votre premier événement', sub: 'Aucun événement planifié avec la communauté.', section: 'events', cta: 'Créer', check: evtCount === 0 },
    { icon: '🏆', label: 'Lancer un tournoi', sub: 'Organisez une compétition en 2 minutes.', section: 'tournament', cta: 'Lancer', check: tourCount === 0 },
    { icon: '🛡', label: 'Activer la protection automatique', sub: 'Le serveur n\'est pas protégé contre le spam.', section: 'automod', cta: 'Activer', check: !getConf('automod_enabled') },
  ];

  const visibleActions = ALL_ACTIONS.filter(a => a.check).slice(0, 4);
  const panel = document.getElementById('ov-actions-panel');
  const listEl = document.getElementById('ov-actions-list');

  if (panel && listEl && visibleActions.length > 0) {
    panel.style.display = '';
    listEl.innerHTML = visibleActions.map(a => `
      <div class="ov-action-card" data-section="${a.section}">
        <div class="ov-action-card-icon">${a.icon}</div>
        <div class="ov-action-card-body">
          <div class="ov-action-card-title">${a.label}</div>
          <div class="ov-action-card-sub">${a.sub}</div>
        </div>
        <button class="btn btn-primary btn-sm ov-action-card-btn">${a.cta} →</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.ov-action-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelector(`[data-section="${card.dataset.section}"]`)?.click();
      });
    });
  }
}

function setKPI(id, value, trend) {
  const valueEl = document.getElementById(id);
  const trendEl = document.getElementById(`${id}-trend`);
  if (valueEl) valueEl.textContent = value || '0';
  if (trendEl) {
    const labels = { up: '▲ Actif', down: '▼ Élevé', flat: '— Stable' };
    trendEl.textContent = labels[trend] || '';
    trendEl.className = `ov-kpi-trend ${trend}`;
  }
}

async function loadBotHealth() {
  const data = await callBotAPI('status').catch(() => null);
  const badge = document.getElementById('ov-bot-status');
  const uptime = document.getElementById('ov-uptime');
  if (!badge) return;
  if (data?.status === 'online') {
    badge.textContent = '🟢 Online';
    badge.className = 'ov-health-badge green';
  } else {
    badge.textContent = '🔴 Offline';
    badge.className = 'ov-health-badge red';
  }
  if (uptime && data?.uptime) {
    const mins = Math.floor(data.uptime / 60);
    const hrs = Math.floor(mins / 60);
    uptime.textContent = hrs > 0 ? `${hrs}h ${mins % 60}min` : `${mins}min`;
  }
}

async function loadActivity() {
  const guildId = await getActiveGuildId();
  const logs = await fetchSupabase(
    `audit_logs?guild_id=eq.${guildId}&order=created_at.desc&limit=12`
  ).catch(() => []) || [];

  const el = document.getElementById('ov-activity-list');
  if (!el) return;

  if (!logs.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-inbox"></i> Aucune activité récente.</div>`;
    return;
  }

  const iconMap = {
    message_delete: { i: '🗑', bg: 'rgba(255,68,68,.1)' },
    message_edit: { i: '✏️', bg: 'rgba(255,255,255,.06)' },
    member_join: { i: '➕', bg: 'rgba(0,230,118,.1)' },
    member_leave: { i: '➖', bg: 'rgba(255,107,53,.1)' },
    ticket_open: { i: '🎫', bg: 'rgba(255,189,46,.1)' },
    ticket_close: { i: '🔒', bg: 'rgba(255,255,255,.06)' },
    suggestion_post: { i: '💡', bg: 'rgba(64,196,255,.1)' },
    ban: { i: '🔨', bg: 'rgba(255,68,68,.15)' },
    kick: { i: '👢', bg: 'rgba(255,68,68,.12)' },
    warn: { i: '⚠️', bg: 'rgba(255,189,46,.12)' },
    mute: { i: '🔇', bg: 'rgba(255,107,53,.1)' },
    automod_kick: { i: '🤖', bg: 'rgba(0,255,100,.08)' },
    automod_ban: { i: '🤖', bg: 'rgba(255,68,68,.1)' },
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

async function loadTickets() {
  const guildId = await getActiveGuildId();
  const tickets = await fetchSupabase(
    `tickets?guild_id=eq.${guildId}&status=neq.closed&order=created_at.desc&limit=5`
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

async function loadSuggestions() {
  const guildId = await getActiveGuildId();
  const suggestions = await fetchSupabase(`suggestions?guild_id=eq.${guildId}&order=created_at.desc&limit=4`).catch(() => []) || [];
  const el = document.getElementById('ov-suggestions-list');
  if (!el) return;
  if (!suggestions.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-lightbulb"></i> Aucune suggestion.</div>`;
    return;
  }
  const statusMap = {
    pending: { cls: 'ov-status-pending', label: 'En attente' },
    reviewing: { cls: 'ov-status-progress', label: 'En cours' },
    accepted: { cls: 'ov-status-accepted', label: 'Acceptée' },
    refused: { cls: 'ov-status-refused', label: 'Refusée' },
    implemented: { cls: 'ov-status-past', label: 'Implémentée' },
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

async function loadEvents() {
  const guildId = await getActiveGuildId();
  const events = await fetchSupabase(`events?guild_id=eq.${guildId}&order=date.asc&limit=3`).catch(() => []) || [];
  const el = document.getElementById('ov-events-list');
  if (!el) return;
  if (!events.length) {
    el.innerHTML = `<div class="ov-empty"><i class="fas fa-calendar-times"></i> Aucun event à venir.</div>`;
    return;
  }
  el.innerHTML = events.map(e => {
    const d = new Date(e.date);
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

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

function actionLabel(a) {
  return ({
    message_delete: 'a supprimé un message',
    message_edit: 'a modifié un message',
    member_join: 'a rejoint le serveur',
    member_leave: 'a quitté le serveur',
    ticket_open: 'a ouvert un ticket',
    ticket_close: 'a fermé un ticket',
    suggestion_post: 'a posté une suggestion',
    ban: 'a été banni',
    kick: 'a été kick',
    warn: 'a reçu un warn',
    mute: 'a été mute',
    automod_kick: 'AutoMod — kick auto',
    automod_ban: 'AutoMod — ban auto',
  })[a] || a;
}

export async function initMemberOverview() {
  const isMember = window.WARSTACK_IS_MEMBER === true || window._memberViewActive === true;
  if (!isMember) return;

  const guildId = await getActiveGuildId();
  const discordId = window.WARSTACK_DISCORD_ID;

  const [discordData, xpRows, tournois, events, suggestions, myTickets, myPlayer] = await Promise.all([
    callBotAPI('guild').catch(() => null),
    fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=discord_id`),
    fetchSupabase(`tournaments?guild_id=eq.${guildId}&status=eq.active&select=id,name,start_date,end_date`),
    fetchSupabase(`events?guild_id=eq.${guildId}&status=eq.open&select=id,title,date,time&order=date.asc&limit=5`),
    fetchSupabase(`suggestions?guild_id=eq.${guildId}&select=id,content,status,username,created_at&order=created_at.desc&limit=5`),
    fetchSupabase(`tickets?guild_id=eq.${guildId}&discord_id=eq.${discordId}&select=id,subject,status,type,created_at&order=created_at.desc&limit=5`),
    fetchSupabase(`players?discord_id=eq.${discordId}&select=*&limit=1`),
  ]);

  const movMembers = document.getElementById('mov-members');
  if (!movMembers) return;

  movMembers.textContent = discordData?.member_count || '—';
  setText('mov-joueurs', xpRows?.length || '0');
  setText('mov-tournois', tournois?.length || '0');
  setText('mov-events', events?.length || '0');
  setText('mov-suggestions', suggestions?.length || '0');

  const p = myPlayer?.[0];
  setHtml('mov-profile', p ? `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
      <img src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--primary)">
      <div>
        <div style="font-weight:700;font-size:1.1rem">${p.username}</div>
        <div style="color:var(--text-muted);font-size:0.82rem">${p.pseudo_bf6 || 'Pseudo BF6 non renseigné'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:0.85rem">
      <div><span style="color:var(--text-muted)">K/D</span> <strong>${p.kd || '—'}</strong></div>
      <div><span style="color:var(--text-muted)">Win%</span> <strong>${p.winrate ? p.winrate + '%' : '—'}</strong></div>
      <div><span style="color:var(--text-muted)">XP</span> <strong style="color:var(--primary)">${p.xp || '0'}</strong></div>
      <div><span style="color:var(--text-muted)">Coins</span> <strong style="color:#FFD700">${p.coins || '0'}</strong></div>
    </div>
  ` : `<div style="color:var(--text-muted);font-size:0.85rem">Profil non trouvé.</div>`);

  setHtml('mov-tickets', myTickets?.length ? myTickets.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
      <span style="font-size:0.85rem">${t.subject || t.type}</span>
      <span class="ticket-status-badge status-${t.status}" style="font-size:0.75rem">${t.status}</span>
    </div>`).join('') : `<div style="color:var(--text-muted);font-size:0.85rem">Aucun ticket.</div>`);

  setHtml('mov-events-list', events?.length ? events.map(e => `
    <div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:600;font-size:0.9rem">${e.title}</div>
      <div style="color:var(--text-muted);font-size:0.78rem">📅 ${new Date(e.date).toLocaleDateString('fr-FR')} à ${e.time}</div>
    </div>`).join('') : `<div style="color:var(--text-muted);font-size:0.85rem">Aucun événement.</div>`);

  setHtml('mov-tournois-list', tournois?.length ? tournois.map(t => `
    <div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:600;font-size:0.9rem">🏆 ${t.name}</div>
      <div style="color:var(--text-muted);font-size:0.78rem">Du ${new Date(t.start_date).toLocaleDateString('fr-FR')} au ${new Date(t.end_date).toLocaleDateString('fr-FR')}</div>
    </div>`).join('') : `<div style="color:var(--text-muted);font-size:0.85rem">Aucun tournoi actif.</div>`);

  setHtml('mov-suggestions-list', suggestions?.length ? suggestions.map(s => `
    <div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
      <div style="font-size:0.85rem">${s.content?.slice(0, 80)}${s.content?.length > 80 ? '...' : ''}</div>
      <div style="color:var(--text-muted);font-size:0.75rem">${s.username} · ${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
    </div>`).join('') : `<div style="color:var(--text-muted);font-size:0.85rem">Aucune suggestion.</div>`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setHtml(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}