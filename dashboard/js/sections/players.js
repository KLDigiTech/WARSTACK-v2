import { fetchSupabase, deleteSupabase, insertSupabase, callBotAPI } from '../api.js';
import { showToast } from '../ui/toast.js';

let allPlayers = [];
let allXP = [];
let allWallets = [];
let currentTab = 'tracker';
let currentFilter = 'all';
let currentDiscordId = null;

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
  const [players, xpRows, walletRows] = await Promise.all([
    fetchSupabase('players?select=*&order=created_at.desc'),
    fetchSupabase('warstack_xp?select=*&order=xp.desc'),
    fetchSupabase('warstack_wallets?select=*&order=total_earned.desc'),
  ]);

  allPlayers = players || [];
  allXP = xpRows || [];
  allWallets = walletRows || [];

  for (const player of allPlayers) {
    if (player.tracker_id) {
      const snaps = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
      player.snapshot = snaps?.[0] || null;
    }
    const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${player.discord_id}&order=created_at.desc&limit=1`);
    player.lastEntry = entries?.[0] || null;
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
            <a href="profil.html?id=${p.discord_id}" target="_blank" class="action-btn profile" title="Voir le profil" onclick="event.stopPropagation()">
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
  const loading = document.getElementById('tl-loading');
  const list = document.getElementById('tl-list');
  loading.style.display = 'block';
  list.innerHTML = '';

  try {
    const [auditLogs, sanctions, tournamentEntries, ranks] = await Promise.all([
      fetchSupabase(`audit_logs?author_id=eq.${discordId}&order=created_at.desc&limit=100`),
      fetchSupabase(`sanctions?discord_id=eq.${discordId}&order=created_at.desc`),
      fetchSupabase(`tournament_entries?discord_id=eq.${discordId}&order=created_at.desc`),
      fetchSupabase(`warstack_ranks?discord_id=eq.${discordId}&order=updated_at.desc`),
    ]);

    const events = [];

    for (const log of auditLogs || []) {
      if (!['member_join', 'member_leave', 'onboarding_complete'].includes(log.action)) continue;
      events.push({
        type: 'member',
        date: log.created_at,
        label: log.action === 'member_join' ? '👋 A rejoint le serveur'
          : log.action === 'member_leave' ? '🚪 A quitté le serveur'
            : '✅ Onboarding complété',
        detail: null,
      });
    }

    for (const s of sanctions || []) {
      const labels = { warn: '⚠️ Avertissement', mute: '🔇 Mute', kick: '👢 Kick', ban: '🔨 Ban' };
      events.push({
        type: 'sanction',
        date: s.created_at,
        label: labels[s.type] || `🛡️ Sanction (${s.type})`,
        detail: s.reason ? `Raison : ${s.reason}` : null,
      });
    }

    for (const entry of tournamentEntries || []) {
      const tournoi = await fetchSupabase(`tournaments?id=eq.${entry.tournament_id}&select=name`);
      const name = tournoi?.[0]?.name || 'Tournoi inconnu';
      events.push({
        type: 'tournament',
        date: entry.created_at,
        label: `🏆 Inscrit au tournoi : ${name}`,
        detail: entry.team_name ? `Équipe : ${entry.team_name}` : null,
      });
    }

    for (const r of ranks || []) {
      if (!r.previous_division || r.previous_division === r.division) continue;
      events.push({
        type: 'rank',
        date: r.updated_at,
        label: `📈 Changement de rang`,
        detail: `${r.previous_division} → ${r.division}`,
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
    if (filter === 'member') return e.type === 'member';
    if (filter === 'moderation') return e.type === 'sanction';
    if (filter === 'tournament') return e.type === 'tournament';
    if (filter === 'rank') return e.type === 'rank';
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="tl-empty"><i class="fas fa-clock"></i>Aucun événement trouvé</div>`;
    return;
  }

  const iconMap = {
    member: { cls: 'member', icon: 'fa-user' },
    sanction: { cls: 'sanction', icon: 'fa-gavel' },
    tournament: { cls: 'tournament', icon: 'fa-trophy' },
    rank: { cls: 'rank', icon: 'fa-arrow-up' },
    message: { cls: 'message', icon: 'fa-comment' },
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
      const existing = await fetchSupabase(`players?discord_id=eq.${finalDiscordId}`);
      if (existing?.length > 0) { showError('Ce Discord ID existe déjà.'); return; }

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