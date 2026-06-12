// ═══════════════════════════════════════════════════
//  WARSTACK — Setup Wizard
// ═══════════════════════════════════════════════════

const API      = 'https://warstack-bot.onrender.com/api';
const API_KEY  = 'warstack-secret-2026';

let guildId    = null;
let scannedMembers = [];
let selectedTeam   = [];
let selectedModules = [];

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Récupérer guild_id depuis OAuth session
  const session = JSON.parse(localStorage.getItem('warstack_session') || '{}');
  guildId = session.guild_id;

  if (!guildId) {
    window.location.href = '/login.html';
    return;
  }

  await scanServer();
  initModuleCards();
});

// ── SCAN ─────────────────────────────────────────────
async function scanServer() {
  try {
    const res  = await fetch(`${API}/setup/scan/${guildId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();

    scannedMembers = data.privileged || [];
    renderMembers();
  } catch (err) {
    document.getElementById('members-loading').innerHTML =
      '<span style="color:var(--danger)">❌ Impossible de scanner le serveur. Le bot est-il bien présent ?</span>';
  }
}

// ── RENDER MEMBRES ────────────────────────────────────
function renderMembers() {
  const loading = document.getElementById('members-loading');
  const list    = document.getElementById('members-list');

  loading.style.display = 'none';
  list.style.display    = 'grid';

  if (!scannedMembers.length) {
    list.innerHTML = '<p style="color:var(--text-muted)">Aucun membre avec des accès élevés détecté.</p>';
    return;
  }

  list.innerHTML = scannedMembers.map((m, i) => `
    <div class="member-card ${i < 4 ? 'checked' : ''}" data-id="${m.discord_id}" onclick="toggleMember(this)">
      <div class="member-check">${i < 4 ? '✅' : '☐'}</div>
      <img src="${m.avatar}" alt="${m.username}" class="member-avatar">
      <div class="member-info">
        <div class="member-name">${m.display || m.username}</div>
        <select class="member-role" onclick="event.stopPropagation()">
          <option value="👑 Fondateur">👑 Fondateur</option>
          <option value="⭐ Team Leader">⭐ Team Leader</option>
          <option value="🎮 Organisateur">🎮 Organisateur</option>
          <option value="🛡 Modérateur" ${i > 0 ? 'selected' : ''}>🛡 Modérateur</option>
        </select>
      </div>
    </div>
  `).join('');
}

function toggleMember(card) {
  card.classList.toggle('checked');
  const check = card.querySelector('.member-check');
  check.textContent = card.classList.contains('checked') ? '✅' : '☐';
}

// ── MODULES ───────────────────────────────────────────
function initModuleCards() {
  document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('checked');
      card.querySelector('input').checked = card.classList.contains('checked');
    });
  });
}

// ── NAVIGATION ────────────────────────────────────────
function goToStep1() { showScreen(1); }

function goToStep2() {
  // Récupérer l'équipe sélectionnée
  selectedTeam = [];
  document.querySelectorAll('.member-card.checked').forEach(card => {
    const id     = card.dataset.id;
    const member = scannedMembers.find(m => m.discord_id === id);
    const role   = card.querySelector('.member-role').value;
    if (member) selectedTeam.push({ ...member, role });
  });
  showScreen(2);
}

function goToStep3() {
  // Récupérer les modules cochés
  selectedModules = [];
  document.querySelectorAll('.module-card.checked').forEach(card => {
    selectedModules.push(card.dataset.module);
  });

  buildSummary();
  showScreen(3);
}

function showScreen(n) {
  document.querySelectorAll('.setup-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'done'));

  document.getElementById(`screen-${n}`).classList.add('active');

  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    if (i < n)  dot.classList.add('done');
    if (i === n) dot.classList.add('active');
  }
}

// ── RÉSUMÉ ────────────────────────────────────────────
const moduleChannelMap = {
  welcome    : ['bienvenue'],
  tickets    : ['tickets', 'logs-tickets'],
  events     : ['événements', 'inscriptions'],
  suggestions: ['suggestions'],
  logs       : ['logs'],
  automod    : ['logs-automod'],
};

function buildSummary() {
  // Équipe
  document.getElementById('summary-team').innerHTML = selectedTeam.length
    ? selectedTeam.map(m => `<div class="summary-item">${m.role} — <strong>${m.display || m.username}</strong></div>`).join('')
    : '<div class="summary-item text-muted">Aucun membre sélectionné</div>';

  // Modules
  const moduleLabels = { welcome:'Welcome', tickets:'Tickets', events:'Événements', suggestions:'Suggestions', logs:'Logs', automod:'AutoMod' };
  document.getElementById('summary-modules').innerHTML = selectedModules.length
    ? selectedModules.map(m => `<div class="summary-item">✅ ${moduleLabels[m]}</div>`).join('')
    : '<div class="summary-item text-muted">Aucun module sélectionné</div>';

  // Salons
  const chans = selectedModules.flatMap(m => moduleChannelMap[m] || []);
  document.getElementById('summary-channels').innerHTML = chans.length
    ? chans.map(c => `<div class="summary-item"># ${c}</div>`).join('')
    : '<div class="summary-item text-muted">Aucun salon à créer</div>';
}

// ── INSTALL ───────────────────────────────────────────
async function install() {
  const btn = document.getElementById('btn-install');
  btn.disabled    = true;
  btn.textContent = '⏳ Installation en cours...';

  try {
    const res  = await fetch(`${API}/setup/install`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body   : JSON.stringify({
        guild_id: guildId,
        team    : selectedTeam,
        modules : selectedModules,
      })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    // Afficher le résultat
    document.getElementById('install-summary').innerHTML = `
      <div class="result-item">✅ ${data.created.roles.length} rôles créés</div>
      <div class="result-item">✅ ${data.created.channels.length} salons créés</div>
      <div class="result-item">✅ ${selectedTeam.length} membres configurés</div>
    `;

    document.querySelectorAll('.setup-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-success').classList.add('active');

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '🚀 Installer WARSTACK';
    alert('❌ Erreur installation : ' + err.message);
  }
}