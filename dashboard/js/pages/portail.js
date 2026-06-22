// dashboard/js/pages/portail.js

import { SUPABASE_URL, SUPABASE_KEY, BOT_URL } from '../config.js';

const params  = new URLSearchParams(window.location.search);
const guildId = params.get('guild');

// ── Fetch Supabase sans auth dashboard ───────────────────────────────────────
async function sb(endpoint) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: {
        apikey        : SUPABASE_KEY,
        Authorization : `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  if (!guildId) {
    showError('Lien invalide. Demande le bon lien à ton serveur Discord.');
    return;
  }

  // Charge config guild (sections activées + invite)
  const configs = await sb(`config?guild_id=eq.${guildId}&select=key,value`);
  const cfg     = Object.fromEntries((configs || []).map(c => [c.key, c.value]));

  let enabledSections = [];
  try { enabledSections = JSON.parse(cfg.portal_sections || '[]'); } catch { enabledSections = []; }
  if (!enabledSections.length) enabledSections = ['players', 'events', 'origine'];

  const inviteUrl = cfg.discord_invite || '#';

  // Bouton rejoindre
  const joinBtn = document.getElementById('btn-join');
  if (joinBtn) joinBtn.href = inviteUrl;

  // Affiche les sections actives
  document.querySelectorAll('.portail-section[data-section]').forEach(el => {
    if (enabledSections.includes(el.dataset.section)) el.style.display = '';
  });

  // Charge données en parallèle
  const [guildInfo, xpRows, teamRows, eventRows] = await Promise.all([
    fetch(`${BOT_URL}/api/guild?guild_id=${guildId}`).then(r => r.json()).catch(() => null),
    enabledSections.includes('players')
      ? sb(`warstack_xp?guild_id=eq.${guildId}&select=*&order=xp.desc&limit=10`)
      : Promise.resolve([]),
    sb(`team_members?guild_id=eq.${guildId}&select=*&order=created_at.asc`),
    enabledSections.includes('events')
      ? sb(`events?guild_id=eq.${guildId}&status=eq.active&select=*&order=date.asc&limit=5`)
      : Promise.resolve([]),
  ]);

  renderHeader(guildInfo);
  if (enabledSections.includes('players'))  await renderLeaderboard(xpRows || []);
  if (enabledSections.includes('events'))   renderEvents(eventRows || []);
  if (enabledSections.includes('overview')) await renderOverview();
  if (enabledSections.includes('tournament')) await renderTournaments();
  if (enabledSections.includes('birthdays'))  await renderBirthdays();
  if (enabledSections.includes('suggestions')) await renderSuggestions();
  if (enabledSections.includes('origine'))    await renderOrigine();
  if (enabledSections.includes('onboarding')) await renderOnboarding();
  renderTeam(teamRows || []);

  document.getElementById('portail-loading').style.display = 'none';
  document.getElementById('portail-content').style.display = 'block';
}

// ── Header ───────────────────────────────────────────────────────────────────
function renderHeader(guildInfo) {
  document.getElementById('guild-name').textContent = guildInfo?.name || 'Communauté WARSTACK';
  if (guildInfo?.icon) document.getElementById('guild-icon').src = guildInfo.icon;
  document.getElementById('guild-members').textContent =
    guildInfo?.member_count ? `${guildInfo.member_count} membres` : '';
}

// ── Overview ─────────────────────────────────────────────────────────────────
async function renderOverview() {
  const el = document.getElementById('overview-stats');
  if (!el) return;
  const [players, xp, tournaments] = await Promise.all([
    sb(`players?guild_id=eq.${guildId}&select=discord_id`),
    sb(`warstack_xp?guild_id=eq.${guildId}&select=xp`),
    sb(`tournaments?guild_id=eq.${guildId}&select=id`),
  ]);
  const totalXp = (xp || []).reduce((s, r) => s + (r.xp || 0), 0);
  el.innerHTML = `
    <div class="portail-kpi"><span class="portail-kpi-val">${(players || []).length}</span><span class="portail-kpi-label">Joueurs</span></div>
    <div class="portail-kpi"><span class="portail-kpi-val">${totalXp.toLocaleString('fr-FR')}</span><span class="portail-kpi-label">XP total</span></div>
    <div class="portail-kpi"><span class="portail-kpi-val">${(tournaments || []).length}</span><span class="portail-kpi-label">Tournois</span></div>
  `;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function renderLeaderboard(xpRows) {
  const el = document.getElementById('leaderboard-list');
  if (!xpRows.length) { el.innerHTML = '<p class="portail-empty">Aucun joueur classé pour le moment.</p>'; return; }

  const ids     = xpRows.map(x => x.discord_id);
  const players = await sb(`players?discord_id=in.(${ids.join(',')})&select=discord_id,username,pseudo,avatar_url`);
  const byId    = Object.fromEntries((players || []).map(p => [p.discord_id, p]));

  el.innerHTML = xpRows.map((x, i) => {
    const p      = byId[x.discord_id] || {};
    const name   = p.pseudo || p.username || 'Joueur';
    const avatar = p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    return `
      <div class="portail-row">
        <span class="portail-rank">${medal}</span>
        <img class="portail-avatar" src="${avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <span class="portail-name">${name}</span>
        <span class="portail-xp">${x.xp || 0} XP</span>
      </div>`;
  }).join('');
}

// ── Tournois ─────────────────────────────────────────────────────────────────
async function renderTournaments() {
  const el = document.getElementById('tournament-list');
  if (!el) return;
  const rows = await sb(`tournaments?guild_id=eq.${guildId}&status=eq.active&select=*&order=start_date.asc&limit=5`);
  if (!rows?.length) { el.innerHTML = '<p class="portail-empty">Aucun tournoi en cours.</p>'; return; }
  el.innerHTML = rows.map(t => `
    <div class="portail-event-card">
      <div class="portail-event-date">🎮 ${formatDate(t.start_date)}</div>
      <div class="portail-event-title">${t.name}</div>
    </div>`).join('');
}

// ── Événements ───────────────────────────────────────────────────────────────
function renderEvents(events) {
  const el = document.getElementById('events-list');
  if (!events.length) { el.innerHTML = '<p class="portail-empty">Aucun événement prévu.</p>'; return; }
  el.innerHTML = events.map(e => `
    <div class="portail-event-card">
      <div class="portail-event-date">📅 ${formatDate(e.date)}${e.time ? ' à ' + e.time : ''}</div>
      <div class="portail-event-title">${e.title}</div>
    </div>`).join('');
}

// ── Anniversaires ─────────────────────────────────────────────────────────────
async function renderBirthdays() {
  const el = document.getElementById('birthdays-list');
  if (!el) return;
  const now   = new Date();
  const month = now.getMonth() + 1;
  const rows  = await sb(`birthdays?guild_id=eq.${guildId}&select=discord_id,username,birth_date`);
  const thisMonth = (rows || []).filter(r => {
    if (!r.birth_date) return false;
    return new Date(r.birth_date).getMonth() + 1 === month;
  });
  if (!thisMonth.length) { el.innerHTML = '<p class="portail-empty">Aucun anniversaire ce mois-ci.</p>'; return; }
  el.innerHTML = thisMonth.map(r => `
    <div class="portail-row">
      <span class="portail-rank">🎂</span>
      <span class="portail-name">${r.username}</span>
      <span class="portail-xp">${formatDate(r.birth_date)}</span>
    </div>`).join('');
}

// ── Suggestions ───────────────────────────────────────────────────────────────
async function renderSuggestions() {
  const el = document.getElementById('suggestions-list');
  if (!el) return;
  const rows = await sb(`suggestions?guild_id=eq.${guildId}&select=*&order=created_at.desc&limit=5`);
  if (!rows?.length) { el.innerHTML = '<p class="portail-empty">Aucune suggestion pour le moment.</p>'; return; }
  el.innerHTML = rows.map(s => `
    <div class="portail-event-card">
      <div class="portail-event-date">${s.status === 'approved' ? '✅' : s.status === 'refused' ? '❌' : '⏳'} ${s.author_name || 'Anonyme'}</div>
      <div class="portail-event-title">${s.content?.slice(0, 120) || '—'}</div>
    </div>`).join('');
}

// ── Origine ───────────────────────────────────────────────────────────────────
async function renderOrigine() {
  const el = document.getElementById('origine-stats');
  if (!el) return;
  const rows = await sb(`member_locations?guild_id=eq.${guildId}&select=country&order=country.asc`);
  if (!rows?.length) { el.innerHTML = '<p class="portail-empty">Aucune donnée de localisation.</p>'; return; }
  const counts = {};
  rows.forEach(r => { if (r.country) counts[r.country] = (counts[r.country] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  el.innerHTML = sorted.map(([country, count]) => `
    <div class="portail-row">
      <span class="portail-rank">🌍</span>
      <span class="portail-name">${country}</span>
      <span class="portail-xp">${count} membre${count > 1 ? 's' : ''}</span>
    </div>`).join('');
}

// ── Onboarding récent ─────────────────────────────────────────────────────────
async function renderOnboarding() {
  const el = document.getElementById('onboarding-list');
  if (!el) return;
  const rows = await sb(`onboarding_logs?guild_id=eq.${guildId}&select=username,avatar_url,created_at&order=created_at.desc&limit=8`);
  if (!rows?.length) { el.innerHTML = '<p class="portail-empty">Aucun membre accueilli récemment.</p>'; return; }
  el.innerHTML = rows.map(r => `
    <div class="portail-row">
      <img class="portail-avatar" src="${r.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <span class="portail-name">${r.username}</span>
      <span class="portail-xp" style="font-size:.78rem;color:var(--text-muted)">${formatDate(r.created_at)}</span>
    </div>`).join('');
}

// ── Équipe ────────────────────────────────────────────────────────────────────
function renderTeam(members) {
  const el = document.getElementById('team-grid');
  if (!members.length) { el.innerHTML = '<p class="portail-empty">Équipe à compléter.</p>'; return; }
  el.innerHTML = members.map(m => `
    <div class="portail-team-card">
      <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="portail-team-name">${m.username}</div>
      <div class="portail-team-role">${m.role}</div>
    </div>`).join('');
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
}

function showError(msg) {
  document.getElementById('portail-loading').innerHTML = `<p>${msg}</p>`;
}

init();