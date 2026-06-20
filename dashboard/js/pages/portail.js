import { fetchSupabase } from '../api.js';
import { BOT_URL }       from '../config.js';

const params  = new URLSearchParams(window.location.search);
const guildId = params.get('guild');

async function init() {
  if (!guildId) { showError('Lien invalide. Demande le bon lien à ton serveur Discord.'); return; }

  const [guildInfo, xpRows, teamRows, eventRows] = await Promise.all([
    fetch(`${BOT_URL}/api/guild?guild_id=${guildId}`).then(r => r.json()).catch(() => null),
    fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=*&order=xp.desc&limit=10`),
    fetchSupabase(`team_members?guild_id=eq.${guildId}&select=*&order=created_at.asc`),
    fetchSupabase(`events?guild_id=eq.${guildId}&status=eq.active&select=*&order=date.asc&limit=5`),
  ]);

  renderHeader(guildInfo);
  await renderLeaderboard(xpRows || []);
  renderTeam(teamRows || []);
  renderEvents(eventRows || []);

  document.getElementById('portail-loading').style.display = 'none';
  document.getElementById('portail-content').style.display = 'block';
}

function renderHeader(guildInfo) {
  document.getElementById('guild-name').textContent = guildInfo?.name || 'Communauté WARSTACK';
  if (guildInfo?.icon) document.getElementById('guild-icon').src = guildInfo.icon;
  document.getElementById('guild-members').textContent =
    guildInfo?.member_count ? `${guildInfo.member_count} membres` : '';

  const joinBtn = document.getElementById('btn-join');
  if (joinBtn) joinBtn.href = `inscription.html?guild=${guildId}`;
}

async function renderLeaderboard(xpRows) {
  const el = document.getElementById('leaderboard-list');

  if (!xpRows.length) {
    el.innerHTML = '<p class="portail-empty">Aucun joueur classé pour le moment.</p>';
    return;
  }

  const ids     = xpRows.map(x => x.discord_id);
  const players = await fetchSupabase(`players?discord_id=in.(${ids.join(',')})&select=discord_id,username,pseudo,avatar_url`);
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
      </div>
    `;
  }).join('');
}

function renderEvents(events) {
  const el = document.getElementById('events-list');

  if (!events.length) {
    el.innerHTML = '<p class="portail-empty">Aucun événement prévu pour le moment.</p>';
    return;
  }

  el.innerHTML = events.map(e => `
    <div class="portail-event-card">
      <div class="portail-event-date">📅 ${formatDate(e.date)}${e.time ? ' à ' + e.time : ''}</div>
      <div class="portail-event-title">${e.title}</div>
    </div>
  `).join('');
}

function renderTeam(members) {
  const el = document.getElementById('team-grid');

  if (!members.length) {
    el.innerHTML = '<p class="portail-empty">Équipe à compléter.</p>';
    return;
  }

  el.innerHTML = members.map(m => `
    <div class="portail-team-card">
      <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="portail-team-name">${m.username}</div>
      <div class="portail-team-role">${m.role}</div>
    </div>
  `).join('');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
}

function showError(msg) {
  document.getElementById('portail-loading').innerHTML = `<p>${msg}</p>`;
}

init();