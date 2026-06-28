import { fetchSupabase, deleteSupabase, insertSupabase, callBotAPI } from '../api.js';
import { showToast } from '../ui/toast.js';
import { getActiveGuildId } from '../services/guildService.js';

let allPlayers = [];
let allXP = [];
let allWallets = [];
let allBadgeDefs = [];
let currentTab = 'tracker';
let currentFilter = 'all';
let currentDiscordId = null;
let activeGuildId = null;

const GRADES = [
  { level: 1, xp: 0, name: 'Recrue', emoji: '🪖' },
  { level: 2, xp: 100, name: 'Soldat', emoji: '🎖️' },
  { level: 3, xp: 250, name: 'Caporal', emoji: '🎖️' },
  { level: 4, xp: 500, name: 'Sergent', emoji: '🎖️' },
  { level: 5, xp: 900, name: 'Sergent-Chef', emoji: '🎖️' },
  { level: 6, xp: 1400, name: 'Adjudant', emoji: '⭐' },
  { level: 7, xp: 2000, name: 'Adjudant-Chef', emoji: '⭐' },
  { level: 8, xp: 2800, name: 'Lieutenant', emoji: '⭐⭐' },
  { level: 9, xp: 3800, name: 'Capitaine', emoji: '⭐⭐' },
  { level: 10, xp: 5000, name: 'Commandant', emoji: '⭐⭐⭐' },
  { level: 11, xp: 7000, name: 'Colonel', emoji: '⭐⭐⭐' },
  { level: 12, xp: 10000, name: 'Général', emoji: '🏅' },
  { level: 13, xp: 15000, name: 'Maréchal WARSTACK', emoji: '🏆' },
];

const BR_RANK_SCORES = {
  'bronze i': 1,   'bronze ii': 2,   'bronze iii': 3,   'bronze iv': 4,   'bronze v': 5,
  'silver i': 6,   'silver ii': 7,   'silver iii': 8,   'silver iv': 9,   'silver v': 10,
  'gold i': 11,    'gold ii': 12,    'gold iii': 13,    'gold iv': 14,    'gold v': 15,
  'platinum i': 16,'platinum ii': 17,'platinum iii': 18,'platinum iv': 19,'platinum v': 20,
  'diamond i': 21, 'diamond ii': 22, 'diamond iii': 23, 'diamond iv': 24, 'diamond v': 25,
  'master i': 26,  'master ii': 27,  'master iii': 28,  'master iv': 29,  'master v': 30,
  'masters': 30,
};

function calcScore(s) {
  if (!s) return 0;
  const kd      = parseFloat(s.kd)      || 0;
  const winrate = parseFloat(s.winrate) || 0;
  const kills   = parseInt(s.kills)     || 0;
  const games   = parseInt(s.games)     || 1;
  const kpm     = kills / games;

  const brKey   = (s.br_rank || '').toLowerCase().trim();
  const brVal   = BR_RANK_SCORES[brKey] ?? 0;
  const brScore = (brVal / 30) * 100;

  return (
    (Math.min(winrate / 60, 1) * 100 * 0.30) +
    (Math.min(kd / 5, 1)       * 100 * 0.25) +
    (Math.min(kpm / 20, 1)     * 100 * 0.15) +
    (Math.min(games / 500, 1)  * 100 * 0.10) +
    (brScore                         * 0.25)
  );
}

function getGrade(xp = 0) {
  let grade = GRADES[0];
  for (const g of GRADES) {
    if (xp >= g.xp) grade = g;
  }
  return grade;
}

function getDivision(score) {
  const s = parseFloat(score);
  if (s >= 65) return 'WARSTACK 🔱';
  if (s >= 55) return 'Phantom 👻';
  if (s >= 45) return 'Elite 💎';
  if (s >= 35) return 'Veteran 🎖️';
  if (s >= 25) return 'Soldat ⚔️';
  return 'Recruit 🪖';
}

export async function initPlayers() {
  const guildId = await getActiveGuildId();
  activeGuildId = guildId;

  const [players, xpRows, walletRows, guildTournois, badgeDefs] = await Promise.all([
    fetchSupabase('players?select=*&order=created_at.desc'),
    fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=*&order=xp.desc`),
    fetchSupabase(`warstack_wallets?guild_id=eq.${guildId}&select=*&order=total_earned.desc`),
    fetchSupabase(`tournaments?guild_id=eq.${guildId}&select=id`),
    fetchSupabase(`badge_definitions?guild_id=eq.${guildId}&select=*&order=created_at.desc`),
  ]);

  allXP = xpRows || [];
  allWallets = walletRows || [];
  allBadgeDefs = badgeDefs || [];
  const guildTournoiIds = new Set((guildTournois || []).map(t => t.id));

  // Ne garder que les joueurs membres de CE serveur (présents dans warstack_xp pour ce guild_id)
  const memberIds = new Set(allXP.map(x => x.discord_id));
  allPlayers = (players || []).filter(p => memberIds.has(p.discord_id));

  for (const player of allPlayers) {
    if (player.tracker_id) {
      const snaps = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
      player.snapshot = snaps?.[0] || null;
    }
    // Dernière entrée de tournoi UNIQUEMENT parmi les tournois de ce serveur
    const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${player.discord_id}&order=created_at.desc`);
    player.lastEntry = (entries || []).find(e => guildTournoiIds.has(e.tournament_id)) || null;
    if (player.lastEntry) {
      const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${player.lastEntry.tournament_id}&discord_id=eq.${player.discord_id}&order=submitted_at.desc&limit=1`);
      player.lastSub = subs?.[0] || null;
      const tournois = await fetchSupabase(`tournaments?id=eq.${player.lastEntry.tournament_id}&select=name,phase`);
      player.lastTournoi = tournois?.[0] || null;
    }
    player.xpData = allXP.find(x => x.discord_id === player.discord_id) || null;
    player.walletData = allWallets.find(w => w.discord_id === player.discord_id) || null;
  }

  initTabs();
  renderTab(currentTab);

  const searchInput = document.getElementById('search-player');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderTab(currentTab, e.target.value.toLowerCase());
    });
  }

  initAddPlayerModal();
  initTimelineFilters();
  initSeasons();
  initGrantBadgeModal();
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.players-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.players-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      document.getElementById('search-player').value = '';
      renderTab(currentTab);
    });
  });
}

function renderTab(tab, search = '') {
  const grid = document.getElementById('players-grid');
  const seasonsPanel = document.getElementById('players-seasons-panel');
  const toolbar = document.querySelector('.players-toolbar');
  if (tab === 'seasons') {
    if (grid) grid.style.display = 'none';
    if (seasonsPanel) seasonsPanel.style.display = 'block';
    if (toolbar) toolbar.style.display = 'none';
    renderSeasons();
    return;
  }
  if (grid) grid.style.display = '';
  if (seasonsPanel) seasonsPanel.style.display = 'none';
  if (toolbar) toolbar.style.display = '';
  switch (tab) {
    case 'xp': renderXPLeaderboard(search); break;
    case 'coins': renderCoinsLeaderboard(search); break;
    case 'tracker': renderTrackerLeaderboard(search); break;
    case 'all': renderAllPlayers(search); break;
  }
}

// ─── CLASSEMENT XP ───────────────────────────────────────────────────────────

function renderXPLeaderboard(search = '') {
  const wrapper = document.getElementById('players-grid');
  const podium = ['🥇', '🥈', '🥉'];

  let rows = [...allXP];
  if (search) {
    rows = rows.filter(x => {
      const p = allPlayers.find(p => p.discord_id === x.discord_id);
      return p?.username?.toLowerCase().includes(search);
    });
  }

  if (!rows.length) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i>Aucun joueur classé</div>';
    return;
  }

  wrapper.innerHTML = `<div class="leaderboard-list">${rows.map((x, i) => {
    const player = allPlayers.find(p => p.discord_id === x.discord_id);
    const grade = getGrade(x.xp);
    const xp = (x.xp || 0).toLocaleString('fr-FR');
    const rank = podium[i] || `<span class="lb-rank-num">#${i + 1}</span>`;
    const nextGrade = GRADES.find(g => g.xp > x.xp);
    const progress = nextGrade
      ? Math.round(((x.xp - grade.xp) / (nextGrade.xp - grade.xp)) * 100)
      : 100;

    return `
      <div class="lb-row" onclick="openTimeline('${x.discord_id}')">
        <div class="lb-rank">${rank}</div>
        <div class="lb-avatar">
          <img src="${player?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
            onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        </div>
        <div class="lb-info">
          <div class="lb-name">${player?.username || x.discord_id}</div>
          <div class="lb-grade">${grade.emoji} ${grade.name}</div>
          <div class="lb-bar-wrap">
            <div class="lb-bar" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="lb-value">
          <div class="lb-main">✨ ${xp} XP</div>
          <div class="lb-sub">Niv. ${grade.level}</div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ─── CLASSEMENT COINS ────────────────────────────────────────────────────────

function renderCoinsLeaderboard(search = '') {
  const wrapper = document.getElementById('players-grid');
  const podium = ['🥇', '🥈', '🥉'];

  let rows = [...allWallets].sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0));
  if (search) {
    rows = rows.filter(w => {
      const p = allPlayers.find(p => p.discord_id === w.discord_id);
      return p?.username?.toLowerCase().includes(search);
    });
  }

  if (!rows.length) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-coins"></i>Aucun joueur classé</div>';
    return;
  }

  wrapper.innerHTML = `<div class="leaderboard-list">${rows.map((w, i) => {
    const player = allPlayers.find(p => p.discord_id === w.discord_id);
    const rank = podium[i] || `<span class="lb-rank-num">#${i + 1}</span>`;

    return `
      <div class="lb-row" onclick="openTimeline('${w.discord_id}')">
        <div class="lb-rank">${rank}</div>
        <div class="lb-avatar">
          <img src="${player?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
            onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        </div>
        <div class="lb-info">
          <div class="lb-name">${player?.username || w.discord_id}</div>
          <div class="lb-grade">💰 Total gagné : ${(w.total_earned || 0).toLocaleString('fr-FR')}</div>
        </div>
        <div class="lb-value">
          <div class="lb-main" style="color:#FFD700">💰 ${(w.coins || 0).toLocaleString('fr-FR')}</div>
          <div class="lb-sub">coins dispo</div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ─── CLASSEMENT TRACKER BF6 ──────────────────────────────────────────────────

function renderTrackerLeaderboard(search = '') {
  const wrapper = document.getElementById('players-grid');
  const podium = ['🥇', '🥈', '🥉'];

  let players = allPlayers.filter(p => p.snapshot);
  if (search) players = players.filter(p => p.username?.toLowerCase().includes(search));

  players.sort((a, b) => calcScore(b.snapshot) - calcScore(a.snapshot));

  if (!players.length) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i>Aucun joueur BF6 classé</div>';
    return;
  }

  wrapper.innerHTML = `<div class="leaderboard-list">${players.map((p, i) => {
    const s = p.snapshot;
    const score = calcScore(s).toFixed(1);
    const rank = podium[i] || `<span class="lb-rank-num">#${i + 1}</span>`;
    const grade = p.xpData ? getGrade(p.xpData.xp) : GRADES[0];

    return `
      <div class="lb-row" onclick="openTimeline('${p.discord_id}')">
        <div class="lb-rank">${rank}</div>
        <div class="lb-avatar">
          <img src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
            onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        </div>
        <div class="lb-info">
          <div class="lb-name">${p.username || 'Unknown'}</div>
          <div class="lb-grade">${grade.emoji} ${grade.name} ${s?.br_rank ? `• 🎖️ ${s.br_rank}` : ''}</div>
          <div class="lb-stats-mini">
            <span>K/D <strong>${s?.kd ?? '—'}</strong></span>
            <span>Win% <strong>${s?.winrate ? parseFloat(s.winrate).toFixed(1) + '%' : '—'}</strong></span>
            <span>Kills <strong>${s?.kills ? Number(s.kills).toLocaleString('fr-FR') : '—'}</strong></span>
          </div>
        </div>
        <div class="lb-value">
          <div class="lb-main" style="color:var(--green)">${score}</div>
          <div class="lb-sub">score WS</div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ─── TOUS LES JOUEURS ────────────────────────────────────────────────────────

function renderAllPlayers(search = '') {
  const wrapper = document.getElementById('players-grid');

  let players = [...allPlayers];
  if (search) {
    players = players.filter(p =>
      p.username?.toLowerCase().includes(search) ||
      p.pseudo_bf6?.toLowerCase().includes(search) ||
      p.tracker_id?.includes(search)
    );
  }

  if (!players.length) {
    wrapper.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i>Aucun joueur trouvé</div>';
    return;
  }

  wrapper.innerHTML = `<div class="players-grid">${players.map(p => {
    const s = p.snapshot;
    const score = calcScore(s);
    const division = getDivision(score);
    const tournoi = p.lastTournoi;
    const sub = p.lastSub;
    const grade = p.xpData ? getGrade(p.xpData.xp) : GRADES[0];

    const tournoisBadge = tournoi ? `
      <div class="player-tournoi">
        <span class="player-tournoi-name">🏆 ${tournoi.name}${tournoi.phase ? ` — ${tournoi.phase}` : ''}</span>
        ${sub
        ? `<span class="player-tournoi-stat">K/D <strong>${sub.kd ?? '—'}</strong></span>
             <span class="player-tournoi-stat">Kills <strong>${sub.kills ?? '—'}</strong></span>`
        : '<span class="player-tournoi-stat">Pas de soumission</span>'}
      </div>` : '';

    const brRankHtml = s?.br_rank ? `
      <div class="player-br-rank">
        ${s.br_rank_img ? `<img src="${s.br_rank_img}" style="width:20px;height:20px;object-fit:contain">` : '<i class="fas fa-shield-alt"></i>'}
        <span>${s.br_rank}</span>
      </div>` : '';

    return `
      <div class="player-card" onclick="openTimeline('${p.discord_id}')">
        <div class="player-card-top">
          <div class="player-avatar">
            <img src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
              alt="${p.username}"
              onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
          </div>
          <div class="player-main">
            <div class="player-name">${p.username || 'Unknown'}</div>
            <div class="player-division">${grade.emoji} ${grade.name}</div>
            <div class="player-division" style="font-size:0.75rem;opacity:0.7">${division}</div>
            ${brRankHtml}
          </div>
          <div class="player-card-actions">
            <a href="profil.html?id=${p.discord_id}&guild=${activeGuildId}" target="_blank" class="action-btn profile" title="Voir le profil" onclick="event.stopPropagation()">
              <i class="fas fa-user"></i>
            </a>
            <button class="action-btn delete" onclick="event.stopPropagation();window.deletePlayer('${p.discord_id}', '${p.username}')" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div class="player-stats">
          <div class="player-stat">
            <span>K/D</span>
            <strong>${s?.kd ?? '—'}</strong>
            <strong>${s?.kd ?? '—'}</strong>
          </div>
          <div class="player-stat">
            <span>XP</span>
            <strong style="color:var(--green)">${p.xpData ? (p.xpData.xp).toLocaleString('fr-FR') : '0'}</strong>
          </div>
          <div class="player-stat">
            <span>Coins</span>
            <strong style="color:#FFD700">${p.walletData ? (p.walletData.coins).toLocaleString('fr-FR') : '0'}</strong>
          </div>
          <div class="player-stat">
            <span>Score WS</span>
            <strong style="color:var(--green)">${calcScore(s).toFixed(1)}</strong>
          </div>
        </div>

        ${tournoisBadge}

        <div class="player-tracker">${p.tracker_id || 'No tracker'}</div>
      </div>`;
  }).join('')}</div>`;
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

window.openTimeline = async function (discordId) {
  currentDiscordId = discordId;
  const player = allPlayers.find(p => p.discord_id === discordId);
  if (!player) return;

  document.getElementById('tl-avatar').src = player.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('tl-username').textContent = player.username || 'Unknown';
  const score = calcScore(player.snapshot);
  document.getElementById('tl-division').textContent = getDivision(score);

  const s = player.snapshot;
  document.getElementById('tl-kd').textContent = s?.kd ?? '—';
  document.getElementById('tl-kills').textContent = s?.kills ? Number(s.kills).toLocaleString('fr-FR') : '—';
  document.getElementById('tl-winrate').textContent = s?.winrate ? `${parseFloat(s.winrate).toFixed(1)}%` : '—';
  document.getElementById('tl-score').textContent = calcScore(s).toFixed(1);

  const xpData = allXP.find(x => x.discord_id === discordId);
  const walletData = allWallets.find(w => w.discord_id === discordId);
  const grade = xpData ? getGrade(xpData.xp) : GRADES[0];

  document.getElementById('tl-xp').textContent = xpData ? (xpData.xp).toLocaleString('fr-FR') + ' XP' : '0 XP';
  document.getElementById('tl-grade').textContent = `${grade.emoji} ${grade.name}`;
  document.getElementById('tl-coins').textContent = walletData ? (walletData.coins).toLocaleString('fr-FR') + ' coins' : '0 coins';

  const badgesBar  = document.getElementById('tl-badges-bar');
  const badgesList = document.getElementById('tl-badges-list');
  const guildId    = activeGuildId;
  const playerBadges = await fetchSupabase(
    `player_badges?guild_id=eq.${guildId}&discord_id=eq.${discordId}&select=*,badge_definitions(*)`
  );
  if (playerBadges?.length && badgesBar && badgesList) {
    badgesBar.style.display = 'flex';
    badgesList.innerHTML = playerBadges.map(pb => {
      const bd = pb.badge_definitions;
      return `<span class="tl-badge-chip rarity-${bd?.rarity || 'common'}" title="${bd?.name || ''}">
        ${bd?.icon || '🏅'} <span>${bd?.name || '—'}</span>
      </span>`;
    }).join('');

    const btnGrant = document.createElement('button');
    btnGrant.className = 'btn btn-secondary tl-grant-badge-btn';
    btnGrant.innerHTML = '<i class="fas fa-plus"></i> Badge';
    btnGrant.title = 'Attribuer un badge';
    btnGrant.onclick = () => openGrantBadgeModal(discordId);
    badgesBar.appendChild(btnGrant);
  } else if (badgesBar) {
    badgesBar.style.display = 'flex';
    badgesList.innerHTML = '<span style="color:var(--text-muted);font-size:0.75rem;opacity:.6">Aucun badge</span>';
    const btnGrant = document.createElement('button');
    btnGrant.className = 'btn btn-secondary tl-grant-badge-btn';
    btnGrant.innerHTML = '<i class="fas fa-plus"></i> Badge';
    btnGrant.title = 'Attribuer un badge';
    btnGrant.onclick = () => openGrantBadgeModal(discordId);
    badgesBar.appendChild(btnGrant);
  }

  document.getElementById('timeline-overlay').style.display = 'block';
  document.getElementById('timeline-panel').classList.add('open');
  document.body.style.overflow = 'hidden';

  currentFilter = 'all';
  document.querySelectorAll('.tl-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));

  await loadTimeline(discordId);
};

window.closeTimeline = function () {
  document.getElementById('timeline-overlay').style.display = 'none';
  document.getElementById('timeline-panel').classList.remove('open');
  document.body.style.overflow = '';
  currentDiscordId = null;
  const badgesBar = document.getElementById('tl-badges-bar');
  if (badgesBar) { badgesBar.style.display = 'none'; badgesBar.innerHTML = '<span class="tl-badges-label">🏅 Badges</span><div id="tl-badges-list" class="tl-badges-list"></div>'; }
};

function initTimelineFilters() {
  document.querySelectorAll('.tl-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.tl-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentDiscordId) renderTimeline(window._tlEvents || [], currentFilter);
    });
  });
}

async function loadTimeline(discordId) {
  const guildId = await getActiveGuildId();
  const loading = document.getElementById('tl-loading');
  const list = document.getElementById('tl-list');
  loading.style.display = 'block';
  list.innerHTML = '';

  try {
    const guildTournois = await fetchSupabase(`tournaments?guild_id=eq.${guildId}&select=id`);
    const guildTournoiIds = new Set((guildTournois || []).map(t => t.id));

    const [auditLogs, sanctions, tournamentEntriesRaw, ranks, xpTransactions, playerBadgesRaw] = await Promise.all([
      fetchSupabase(`audit_logs?guild_id=eq.${guildId}&author_id=eq.${discordId}&order=created_at.desc&limit=100`),
      fetchSupabase(`sanctions?guild_id=eq.${guildId}&discord_id=eq.${discordId}&order=created_at.desc`),
      fetchSupabase(`tournament_entries?discord_id=eq.${discordId}&order=created_at.desc`),
      fetchSupabase(`warstack_ranks?discord_id=eq.${discordId}&order=updated_at.desc`),
      fetchSupabase(`warstack_transactions?discord_id=eq.${discordId}&order=created_at.desc&limit=50`),
      fetchSupabase(`player_badges?guild_id=eq.${guildId}&discord_id=eq.${discordId}&select=*,badge_definitions(*)&order=granted_at.desc`),
    ]);

    const tournamentEntries = (tournamentEntriesRaw || []).filter(e => guildTournoiIds.has(e.tournament_id));

    const events = [];

    for (const log of auditLogs || []) {
      if (!['member_join', 'member_leave', 'onboarding_complete', 'onboarding_approved', 'onboarding_rejected'].includes(log.action)) continue;
      const labelMap = {
        member_join          : '👋 A rejoint le serveur',
        member_leave         : '🚪 A quitté le serveur',
        onboarding_complete  : '✅ Onboarding complété',
        onboarding_approved  : '✅ Inscription approuvée',
        onboarding_rejected  : '❌ Inscription refusée',
      };
      events.push({ type: 'member', date: log.created_at, label: labelMap[log.action] || log.action, detail: null });
    }

    for (const s of sanctions || []) {
      const labels = { warn: '⚠️ Avertissement', mute: '🔇 Mute', kick: '👢 Kick', ban: '🔨 Ban', unban: '✅ Unban' };
      events.push({
        type  : 'sanction',
        date  : s.created_at,
        label : labels[s.type] || `🛡️ Sanction (${s.type})`,
        detail: s.reason ? `Raison : ${s.reason}` : null,
      });
    }

    for (const entry of tournamentEntries || []) {
      const tournoi = await fetchSupabase(`tournaments?id=eq.${entry.tournament_id}&select=name`);
      const name = tournoi?.[0]?.name || 'Tournoi inconnu';
      events.push({
        type  : 'tournament',
        date  : entry.created_at,
        label : `🏆 Inscrit au tournoi : ${name}`,
        detail: entry.team_name ? `Équipe : ${entry.team_name}` : null,
      });
    }

    for (const r of ranks || []) {
      if (!r.previous_division || r.previous_division === r.division) continue;
      events.push({ type: 'rank', date: r.updated_at, label: `📈 Changement de rang`, detail: `${r.previous_division} → ${r.division}` });
    }

    for (const tx of xpTransactions || []) {
      const sign  = tx.amount > 0 ? '+' : '';
      const color = tx.amount > 0 ? '#00ff88' : '#ff4444';
      const coinsDetail = tx.coins ? ` | ${tx.coins > 0 ? '+' : ''}${tx.coins} 💰` : '';
      events.push({
        type  : 'xp',
        date  : tx.created_at,
        label : `✨ ${tx.reason || tx.type || 'Transaction XP'}`,
        detail: `<span style="color:${color};font-weight:700">${sign}${tx.amount} XP</span>${coinsDetail}`,
      });
    }

    for (const pb of playerBadgesRaw || []) {
      const bd = pb.badge_definitions;
      events.push({
        type  : 'badge',
        date  : pb.granted_at,
        label : `🏅 Badge obtenu : ${bd?.name || '—'}`,
        detail: bd ? `${bd.icon || '🏅'} ${bd.description || ''} <span class="rarity-badge-${bd.rarity || 'common'}">${bd.rarity || 'common'}</span>` : null,
      });
    }

    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    window._tlEvents = events;
    renderTimeline(events, currentFilter);

  } catch (err) {
    list.innerHTML = `<div class="tl-empty"><i class="fas fa-exclamation-triangle"></i>Erreur de chargement</div>`;
  } finally {
    loading.style.display = 'none';
  }
}

function renderTimeline(events, filter) {
  const list = document.getElementById('tl-list');

  const filtered = filter === 'all' ? events : events.filter(e => {
    if (filter === 'member')     return e.type === 'member';
    if (filter === 'moderation') return e.type === 'sanction';
    if (filter === 'tournament') return e.type === 'tournament';
    if (filter === 'rank')       return e.type === 'rank';
    if (filter === 'xp')         return e.type === 'xp';
    if (filter === 'badge')      return e.type === 'badge';
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="tl-empty"><i class="fas fa-clock"></i>Aucun événement trouvé</div>`;
    return;
  }

  const iconMap = {
    member     : { cls: 'member',     icon: 'fa-user'       },
    sanction   : { cls: 'sanction',   icon: 'fa-gavel'      },
    tournament : { cls: 'tournament', icon: 'fa-trophy'     },
    rank       : { cls: 'rank',       icon: 'fa-arrow-up'   },
    xp         : { cls: 'xp',         icon: 'fa-star'       },
    badge      : { cls: 'badge',       icon: 'fa-award'      },
    message    : { cls: 'message',    icon: 'fa-comment'    },
  };

  list.innerHTML = filtered.map(ev => {
    const im = iconMap[ev.type] || { cls: 'member', icon: 'fa-circle' };
    const dateStr = new Date(ev.date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="tl-item">
        <div class="tl-icon ${im.cls}"><i class="fas ${im.icon}"></i></div>
        <div class="tl-content">
          <div class="tl-label">${ev.label}</div>
          <div class="tl-meta">${dateStr}</div>
          ${ev.detail ? `<div class="tl-detail">${ev.detail}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── MODAL AJOUT ─────────────────────────────────────────────────────────────

function initAddPlayerModal() {
  const btnOpen = document.getElementById('btn-add-player');
  const modal = document.getElementById('modal-add-player');
  const btnClose = document.getElementById('modal-add-close');
  const btnConfirm = document.getElementById('btn-add-confirm');
  const btnFetch = document.getElementById('btn-fetch-discord');
  const discordInput = document.getElementById('add-discord-id');
  const trackerInput = document.getElementById('add-tracker-url');
  const trackerHint = document.getElementById('add-tracker-hint');
  const errorDiv = document.getElementById('add-error');
  const discordPreview = document.getElementById('add-discord-preview');
  const discordAvatar = document.getElementById('add-discord-avatar');
  const discordUsername = document.getElementById('add-discord-username');
  const discordError = document.getElementById('add-discord-error');

  let selectedPlatform = null;
  let fetchedAvatar = null;

  if (!btnOpen || !modal) return;

  btnOpen.addEventListener('click', () => { resetAddForm(); modal.style.display = 'flex'; });
  btnClose.addEventListener('click', () => modal.style.display = 'none');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  btnFetch.addEventListener('click', async () => {
    const id = discordInput.value.trim();
    if (!id || !/^\d{15,20}$/.test(id)) {
      discordError.style.display = 'block';
      discordError.textContent = 'ID Discord invalide (15-20 chiffres)';
      return;
    }
    btnFetch.disabled = true;
    btnFetch.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    discordError.style.display = 'none';
    discordPreview.style.display = 'none';
    try {
      const data = await callBotAPI(`user/${id}`);
      if (data?.error) throw new Error(data.error);
      document.getElementById('add-username').value = data.username;
      fetchedAvatar = data.avatar;
      discordAvatar.src = data.avatar;
      discordUsername.textContent = data.username;
      discordPreview.style.display = 'flex';
      checkAddReady();
    } catch (e) {
      discordError.style.display = 'block';
      discordError.textContent = '❌ ' + e.message;
    } finally {
      btnFetch.disabled = false;
      btnFetch.innerHTML = '<i class="fas fa-search"></i> Fetch';
    }
  });

  document.querySelectorAll('#modal-add-player .platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modal-add-player .platform-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlatform = btn.dataset.platform;
      checkAddReady();
    });
  });

  trackerInput.addEventListener('input', () => {
    const val = trackerInput.value.trim();
    const match = val.match(/\/(\d{8,})(?:\/|$)/);
    if (match) {
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint ok';
      trackerHint.textContent = `✓ Tracker ID détecté : ${match[1]}`;
    } else if (val.length > 0) {
      trackerHint.style.display = 'block';
      trackerHint.className = 'hint';
      trackerHint.textContent = 'URL non reconnue — ajouté sans tracker';
    } else {
      trackerHint.style.display = 'none';
    }
    checkAddReady();
  });

  document.getElementById('add-username').addEventListener('input', checkAddReady);
  document.getElementById('add-pseudo-bf6').addEventListener('input', checkAddReady);

  function checkAddReady() {
    const username = document.getElementById('add-username').value.trim();
    const pseudoBf6 = document.getElementById('add-pseudo-bf6').value.trim();
    btnConfirm.disabled = !(username.length >= 2 && pseudoBf6.length >= 2 && !!selectedPlatform);
  }

  btnConfirm.addEventListener('click', async () => {
    const guildId = await getActiveGuildId();
    const username = document.getElementById('add-username').value.trim();
    const pseudoBf6 = document.getElementById('add-pseudo-bf6').value.trim();
    const trackerUrl = trackerInput.value.trim();
    const discordId = discordInput.value.trim();
    const match = trackerUrl.match(/\/(\d{8,})(?:\/|$)/);
    const trackerId = match ? match[1] : null;
    const finalDiscordId = discordId || `manual_${Date.now()}`;

    errorDiv.style.display = 'none';
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

    try {
      const existingXp = await fetchSupabase(`warstack_xp?discord_id=eq.${finalDiscordId}&guild_id=eq.${guildId}`);
      if (existingXp?.length > 0) { showError('Ce joueur est déjà membre de ce serveur.'); return; }

      const existingPlayer = await fetchSupabase(`players?discord_id=eq.${finalDiscordId}`);
      if (!existingPlayer?.length) {
        await insertSupabase('players', {
          discord_id: finalDiscordId,
          username: username,
          pseudo_bf6: pseudoBf6,
          platform: selectedPlatform,
          tracker_id: trackerId,
          tracker_url: trackerUrl || null,
          avatar_url: fetchedAvatar || null,
          created_at: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      await insertSupabase('warstack_xp', {
        discord_id: finalDiscordId,
        guild_id  : guildId,
        xp        : 0,
        level     : 1,
        updated_at: now,
      });
      await insertSupabase('warstack_wallets', {
        discord_id  : finalDiscordId,
        guild_id    : guildId,
        coins       : 0,
        total_earned: 0,
        updated_at  : now,
      });

      modal.style.display = 'none';
      showToast(`✅ ${username} ajouté !`);
      initPlayers();
    } catch (err) {
      showError('Erreur : ' + err.message);
    }
  });

  function showError(msg) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = '❌ ' + msg;
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<i class="fas fa-plus"></i> INSCRIRE LE JOUEUR';
  }

  function resetAddForm() {
    document.getElementById('add-username').value = '';
    document.getElementById('add-pseudo-bf6').value = '';
    document.getElementById('add-tracker-url').value = '';
    document.getElementById('add-discord-id').value = '';
    trackerHint.style.display = 'none';
    errorDiv.style.display = 'none';
    discordPreview.style.display = 'none';
    discordError.style.display = 'none';
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-plus"></i> INSCRIRE LE JOUEUR';
    selectedPlatform = null;
    fetchedAvatar = null;
    document.querySelectorAll('#modal-add-player .platform-btn').forEach(b => b.classList.remove('selected'));
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

window.deletePlayer = async function (discordId, username) {
  if (!confirm(`Supprimer ${username} ?`)) return;
  await deleteSupabase(`players?discord_id=eq.${discordId}`);
  showToast('✅ Joueur supprimé');
  initPlayers();
};
// ─── SAISONS ─────────────────────────────────────────────────────────────────

async function initSeasons() {
  const btnCreate = document.getElementById('btn-create-season');
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      document.getElementById('modal-create-season').style.display = 'flex';
    });
  }
  document.getElementById('modal-season-close')?.addEventListener('click', () => {
    document.getElementById('modal-create-season').style.display = 'none';
  });
  document.getElementById('btn-season-confirm')?.addEventListener('click', createSeason);
}

async function renderSeasons() {
  const guildId = activeGuildId;
  const [seasons, rankings] = await Promise.all([
    fetchSupabase(`seasons?guild_id=eq.${guildId}&order=number.desc`),
    fetchSupabase(`season_rankings?guild_id=eq.${guildId}&order=xp_gained.desc&limit=20`),
  ]);

  const activeSeason = (seasons || []).find(s => s.is_active);
  const pastSeasons  = (seasons || []).filter(s => !s.is_active);

  const activeEl = document.getElementById('seasons-active-info');
  if (activeEl) {
    if (activeSeason) {
      const start = new Date(activeSeason.start_date).toLocaleDateString('fr-FR');
      const end   = new Date(activeSeason.end_date).toLocaleDateString('fr-FR');
      const daysLeft = Math.ceil((new Date(activeSeason.end_date) - new Date()) / 86400000);
      activeEl.innerHTML = `
        <div class="season-active-badge">🟢 SAISON ACTIVE</div>
        <div class="season-active-name">${activeSeason.name}</div>
        <div class="season-active-dates">📅 ${start} → ${end}</div>
        <div class="season-active-days">${daysLeft > 0 ? `⏳ ${daysLeft} jours restants` : '🔴 Terminée'}</div>
      `;
    } else {
      activeEl.innerHTML = `<div class="season-active-empty">Aucune saison active — crée-en une !</div>`;
    }
  }

  const rankEl = document.getElementById('seasons-ranking');
  if (rankEl) {
    if (!activeSeason) {
      rankEl.innerHTML = '<div class="tl-empty"><i class="fas fa-trophy"></i> Lance une saison pour voir le classement</div>';
    } else {
      const seasonRankings = (rankings || []).filter(r => r.season_id === activeSeason.id);
      if (!seasonRankings.length) {
        rankEl.innerHTML = '<div class="tl-empty"><i class="fas fa-trophy"></i> Aucune donnée de classement pour cette saison</div>';
      } else {
        const podium = ['🥇', '🥈', '🥉'];
        rankEl.innerHTML = `
          <div class="seasons-ranking-title">🏆 Classement — ${activeSeason.name}</div>
          ${seasonRankings.map((r, i) => `
            <div class="lb-row ${i < 3 ? 'top' : ''}">
              <span class="lb-rank">${podium[i] || `#${i + 1}`}</span>
              <div class="lb-info">
                <div class="lb-name">${r.username || r.discord_id}</div>
                <div class="lb-sub">XP gagné cette saison</div>
              </div>
              <span class="lb-value" style="color:var(--green)">+${(r.xp_gained || 0).toLocaleString('fr-FR')} XP</span>
            </div>
          `).join('')}
        `;
      }
    }
  }

  const pastEl = document.getElementById('seasons-past-list');
  if (pastEl) {
    if (!pastSeasons.length) {
      pastEl.innerHTML = '<div class="tl-empty" style="opacity:.4">Aucune saison passée</div>';
    } else {
      pastEl.innerHTML = pastSeasons.map(s => {
        const start = new Date(s.start_date).toLocaleDateString('fr-FR');
        const end   = new Date(s.end_date).toLocaleDateString('fr-FR');
        return `
          <div class="season-past-card">
            <div>
              <div class="season-past-name">${s.name}</div>
              <div class="season-past-dates">${start} → ${end}</div>
            </div>
            <div class="season-past-badge">Saison ${s.number}</div>
          </div>
        `;
      }).join('');
    }
  }
}

async function createSeason() {
  const guildId = activeGuildId;
  const name    = document.getElementById('season-name').value.trim();
  const number  = parseInt(document.getElementById('season-number').value) || 1;
  const start   = document.getElementById('season-start').value;
  const end     = document.getElementById('season-end').value;
  const active  = document.getElementById('season-active').checked;
  const errEl   = document.getElementById('season-error');

  if (!name || !start || !end) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ Nom, date de début et fin sont requis.';
    return;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('btn-season-confirm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    if (active) {
      const { fetchSupabase: sb } = await import('../api.js');
      await fetchSupabase(`seasons?guild_id=eq.${guildId}`, 'PATCH', { is_active: false });
    }

    await insertSupabase('seasons', { guild_id: guildId, name, number, start_date: start, end_date: end, is_active: active });
    document.getElementById('modal-create-season').style.display = 'none';
    showToast(`✅ Saison "${name}" créée !`);
    renderSeasons();
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ Erreur : ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> CRÉER LA SAISON';
  }
}

// ─── MODAL ATTRIBUER BADGE ────────────────────────────────────────────────────

function initGrantBadgeModal() {
  document.getElementById('modal-badge-close')?.addEventListener('click', () => {
    document.getElementById('modal-grant-badge').style.display = 'none';
  });

  document.getElementById('grant-badge-select')?.addEventListener('change', (e) => {
    const bd = allBadgeDefs.find(b => String(b.id) === e.target.value);
    const preview = document.getElementById('grant-badge-preview');
    if (bd && preview) {
      preview.style.display = 'flex';
      preview.innerHTML = `
        <span class="badge-preview-icon">${bd.icon || '🏅'}</span>
        <div>
          <div style="font-weight:700">${bd.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${bd.description || ''}</div>
          <span class="rarity-badge-${bd.rarity || 'common'}" style="font-size:0.7rem;padding:2px 8px;border-radius:20px;display:inline-block;margin-top:4px">${bd.rarity || 'common'}</span>
        </div>
      `;
    } else if (preview) {
      preview.style.display = 'none';
    }
  });

  document.getElementById('btn-grant-badge-confirm')?.addEventListener('click', grantBadge);
}

function openGrantBadgeModal(discordId) {
  const select = document.getElementById('grant-badge-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Sélectionner —</option>' +
    allBadgeDefs.map(bd => `<option value="${bd.id}">${bd.icon || '🏅'} ${bd.name}</option>`).join('');
  select.dataset.discordId = discordId;
  document.getElementById('grant-badge-preview').style.display = 'none';
  document.getElementById('grant-badge-error').style.display = 'none';
  document.getElementById('modal-grant-badge').style.display = 'flex';
}

async function grantBadge() {
  const guildId  = activeGuildId;
  const select   = document.getElementById('grant-badge-select');
  const badgeId  = select?.value;
  const discordId = select?.dataset.discordId;
  const errEl    = document.getElementById('grant-badge-error');
  const btn      = document.getElementById('btn-grant-badge-confirm');

  if (!badgeId || !discordId) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ Sélectionne un badge.';
    return;
  }
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    await insertSupabase('player_badges', {
      guild_id  : guildId,
      discord_id: discordId,
      badge_id  : parseInt(badgeId),
      granted_by: 'dashboard',
      granted_at: new Date().toISOString(),
    });
    document.getElementById('modal-grant-badge').style.display = 'none';
    showToast('✅ Badge attribué !');
    await loadTimeline(discordId);
    await openTimeline(discordId);
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ Erreur (badge déjà attribué ?) : ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-award"></i> ATTRIBUER';
  }
}