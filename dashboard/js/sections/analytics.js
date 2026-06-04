import { fetchSupabase } from '../api.js';

let chartMembers  = null;
let chartActivity = null;
let chartSanctions = null;
let currentRange  = 7;

export async function initAnalytics() {
  initRangeButtons();
  await Promise.all([
    loadStatCards(),
    loadMembersChart(currentRange),
    loadActivityChart(),
    loadTopPlayers(),
    loadSanctionsChart(),
  ]);
}

// ─── RANGE BUTTONS ───────────────────────────────────────────────────────────

function initRangeButtons() {
  document.querySelectorAll('.an-range').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.an-range').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = parseInt(btn.dataset.range);
      await loadMembersChart(currentRange);
    });
  });
}

// ─── STAT CARDS ──────────────────────────────────────────────────────────────

async function loadStatCards() {
  const now   = new Date();
  const d7ago = new Date(now - 7 * 86400000).toISOString();

  const [players, tickets, suggestions, sanctions,
         recentJoins, recentTickets, recentSuggestions, recentSanctions] = await Promise.all([
    fetchSupabase('players?select=discord_id'),
    fetchSupabase('tickets?select=id&status=eq.open'),
    fetchSupabase('suggestions?select=id'),
    fetchSupabase('sanctions?select=id&active=eq.true'),
    fetchSupabase(`audit_logs?action=eq.member_join&created_at=gte.${d7ago}&select=id`),
    fetchSupabase(`tickets?select=id&created_at=gte.${d7ago}`),
    fetchSupabase(`suggestions?select=id&created_at=gte.${d7ago}`),
    fetchSupabase(`sanctions?select=id&created_at=gte.${d7ago}`),
  ]);

  setCard('an-total-members',     players?.length     ?? 0, recentJoins?.length     ?? 0, 'an-delta-members',     '+{n} cette semaine');
  setCard('an-total-tickets',     tickets?.length     ?? 0, recentTickets?.length   ?? 0, 'an-delta-tickets',     '+{n} cette semaine');
  setCard('an-total-suggestions', suggestions?.length ?? 0, recentSuggestions?.length ?? 0, 'an-delta-suggestions', '+{n} cette semaine');
  setCard('an-total-sanctions',   sanctions?.length   ?? 0, recentSanctions?.length ?? 0, 'an-delta-sanctions',   '+{n} cette semaine');
}

function setCard(valueId, total, delta, deltaId, tpl) {
  const valEl   = document.getElementById(valueId);
  const deltaEl = document.getElementById(deltaId);
  if (valEl)   valEl.textContent = total;
  if (deltaEl) {
    if (delta > 0) {
      deltaEl.textContent = tpl.replace('{n}', delta);
      deltaEl.className   = 'an-card-delta up';
    } else {
      deltaEl.textContent = 'Stable cette semaine';
      deltaEl.className   = 'an-card-delta flat';
    }
  }
}

// ─── MEMBRES CHART ───────────────────────────────────────────────────────────

async function loadMembersChart(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [joins, leaves] = await Promise.all([
    fetchSupabase(`audit_logs?action=eq.member_join&created_at=gte.${since}&select=created_at&order=created_at.asc`),
    fetchSupabase(`audit_logs?action=eq.member_leave&created_at=gte.${since}&select=created_at&order=created_at.asc`),
  ]);

  const labels = buildDateLabels(days);
  const joinMap  = groupByDay(joins  || []);
  const leaveMap = groupByDay(leaves || []);

  const joinData  = labels.map(d => joinMap[d]  || 0);
  const leaveData = labels.map(d => leaveMap[d] || 0);

  // Net cumulatif
  let running = 0;
  const netData = joinData.map((j, i) => { running += j - leaveData[i]; return running; });

  const displayLabels = labels.map(d => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  });

  const canvas = document.getElementById('chart-members');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (chartMembers) chartMembers.destroy();

  chartMembers = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: 'Arrivées',
          data: joinData,
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0,255,136,.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#00ff88',
        },
        {
          label: 'Départs',
          data: leaveData,
          borderColor: '#ff5050',
          backgroundColor: 'rgba(255,80,80,.06)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#ff5050',
        },
        {
          label: 'Net cumulatif',
          data: netData,
          borderColor: '#5bc8ff',
          backgroundColor: 'transparent',
          tension: 0.4,
          fill: false,
          pointRadius: 2,
          borderDash: [4, 3],
        },
      ],
    },
    options: chartOptions('membres'),
  });
}

// ─── ACTIVITÉ CHART ───────────────────────────────────────────────────────────

async function loadActivityChart() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const logs = await fetchSupabase(
    `audit_logs?created_at=gte.${since}&select=created_at,type&order=created_at.asc`
  );

  const labels   = buildDateLabels(30);
  const msgMap   = groupByDay((logs || []).filter(l => l.type === 'message'));
  const memberMap = groupByDay((logs || []).filter(l => l.type === 'member'));
  const modMap   = groupByDay((logs || []).filter(l => l.type === 'moderation'));

  const displayLabels = labels.map(d => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  });

  const canvas = document.getElementById('chart-activity');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (chartActivity) chartActivity.destroy();

  chartActivity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: 'Messages',
          data: labels.map(d => msgMap[d] || 0),
          backgroundColor: 'rgba(0,255,136,.5)',
          borderRadius: 4,
        },
        {
          label: 'Membres',
          data: labels.map(d => memberMap[d] || 0),
          backgroundColor: 'rgba(91,200,255,.5)',
          borderRadius: 4,
        },
        {
          label: 'Modération',
          data: labels.map(d => modMap[d] || 0),
          backgroundColor: 'rgba(255,80,80,.5)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...chartOptions('actions'),
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#7fa38a', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 10 },
          grid:  { color: 'rgba(255,255,255,.03)' },
        },
        y: {
          stacked: true,
          ticks: { color: '#7fa38a', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
      },
    },
  });
}

// ─── TOP JOUEURS ─────────────────────────────────────────────────────────────

async function loadTopPlayers() {
  const players = await fetchSupabase('players?select=*&order=created_at.desc');
  if (!players?.length) {
    document.getElementById('an-top-players').innerHTML =
      '<div class="an-empty"><i class="fas fa-users"></i>Aucun joueur enregistré</div>';
    return;
  }

  const withScores = [];
  for (const p of players) {
    let snap = null;
    if (p.tracker_id) {
      const snaps = await fetchSupabase(`player_snapshots?tracker_id=eq.${p.tracker_id}&order=snapshot_at.desc&limit=1`);
      snap = snaps?.[0] || null;
    }
    const score = calcScore(snap);
    withScores.push({ ...p, snapshot: snap, score: parseFloat(score) });
  }

  withScores.sort((a, b) => b.score - a.score);
  const top10 = withScores.slice(0, 10);

  const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankIcon  = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  document.getElementById('an-top-players').innerHTML = top10.map((p, i) => `
    <div class="an-player-row">
      <div class="an-rank ${rankClass(i)}">${rankIcon(i)}</div>
      <img class="an-player-avatar"
        src="${p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
        onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
        alt="${p.username}">
      <div class="an-player-info">
        <div class="an-player-name">${p.username || 'Unknown'}</div>
        <div class="an-player-div">${getDivision(p.score)}</div>
      </div>
      <div class="an-player-score">${p.score.toFixed(1)}</div>
    </div>
  `).join('');
}

// ─── SANCTIONS CHART ─────────────────────────────────────────────────────────

async function loadSanctionsChart() {
  const sanctions = await fetchSupabase('sanctions?select=type');
  const counts    = { warn: 0, mute: 0, kick: 0, ban: 0 };
  for (const s of sanctions || []) {
    if (counts[s.type] !== undefined) counts[s.type]++;
  }

  const canvas = document.getElementById('chart-sanctions');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (chartSanctions) chartSanctions.destroy();

  chartSanctions = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Avertissements', 'Mutes', 'Kicks', 'Bans'],
      datasets: [{
        data: [counts.warn, counts.mute, counts.kick, counts.ban],
        backgroundColor: [
          'rgba(255,210,0,.7)',
          'rgba(91,200,255,.7)',
          'rgba(255,140,0,.7)',
          'rgba(255,80,80,.7)',
        ],
        borderColor: [
          'rgba(255,210,0,.3)',
          'rgba(91,200,255,.3)',
          'rgba(255,140,0,.3)',
          'rgba(255,80,80,.3)',
        ],
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#7fa38a', font: { size: 11 }, padding: 12 },
        },
      },
      cutout: '65%',
    },
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildDateLabels(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

function groupByDay(rows) {
  const map = {};
  for (const r of rows) {
    const day = (r.created_at || r.snapshot_at || '').slice(0, 10);
    if (day) map[day] = (map[day] || 0) + 1;
  }
  return map;
}

function chartOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#7fa38a', font: { size: 11 }, boxWidth: 12, padding: 16 },
      },
      tooltip: {
        backgroundColor: 'rgba(8,13,10,.95)',
        borderColor: 'rgba(0,255,120,.15)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#7fa38a',
        padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: '#7fa38a', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 10 },
        grid:  { color: 'rgba(255,255,255,.03)' },
      },
      y: {
        ticks: { color: '#7fa38a', font: { size: 10 } },
        grid:  { color: 'rgba(255,255,255,.04)' },
      },
    },
  };
}

function calcScore(s) {
  if (!s) return 0;
  const kd      = parseFloat(s.kd)      || 0;
  const winrate = parseFloat(s.winrate) || 0;
  const kills   = parseInt(s.kills)     || 0;
  const games   = parseInt(s.games)     || 1;
  const kpm     = kills / games;
  return (Math.min(kd / 5, 1) * 100 * 0.30) + (Math.min(winrate / 60, 1) * 100 * 0.35) + (Math.min(kpm / 20, 1) * 100 * 0.25);
}

function getDivision(score) {
  if (score >= 65) return 'WARSTACK 🔱';
  if (score >= 55) return 'Phantom 👻';
  if (score >= 45) return 'Elite 💎';
  if (score >= 35) return 'Veteran 🎖️';
  if (score >= 25) return 'Grunt ⚔️';
  return 'Recruit 🪖';
}