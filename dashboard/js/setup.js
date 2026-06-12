import { supabase } from './supabaseClient.js';
import { BOT_URL, API_KEY } from './config.js';

let guildId         = null;
let scannedMembers  = [];
let selectedTeam    = [];
let selectedModules = [];

document.addEventListener('DOMContentLoaded', async () => {

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    localStorage.setItem('warstack_redirect', '/setup.html');
    window.location.href = '/login.html';
    return;
  }

  const discordId = session.user?.user_metadata?.provider_id
                 || session.user?.user_metadata?.sub;

  try {
    const res    = await fetch(`${BOT_URL}/api/guilds/${discordId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data   = await res.json();
    const guilds = data.guilds || [];

    if (guilds.length === 0) {
      document.getElementById('members-loading').innerHTML =
        '<span style="color:var(--danger)">❌ Aucun serveur trouvé. Le bot est-il bien invité ?</span>';
      return;
    }

    guildId = guilds[0].guild_id;

  } catch (err) {
    document.getElementById('members-loading').innerHTML =
      `<span style="color:var(--danger)">❌ Erreur connexion bot : ${err.message}</span>`;
    return;
  }

  await scanServer();
  initModuleCards();
});

async function scanServer() {
  try {
    const res  = await fetch(`${BOT_URL}/api/setup/scan/${guildId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Scan échoué');
    scannedMembers = data.privileged || [];
    renderMembers();
  } catch (err) {
    document.getElementById('members-loading').innerHTML =
      `<span style="color:var(--danger)">❌ Scan impossible : ${err.message}</span>`;
  }
}

function renderMembers() {
  const loading = document.getElementById('members-loading');
  const list    = document.getElementById('members-list');

  loading.style.display = 'none';
  list.style.display    = 'grid';
  document.getElementById('btn-next-1').disabled = false;

  if (!scannedMembers.length) {
    list.innerHTML = '<p style="color:var(--text-muted)">Aucun membre avec des accès élevés détecté.</p>';
    return;
  }

  list.innerHTML = scannedMembers.map((m, i) => `
    <div class="member-card ${i < 4 ? 'checked' : ''}" data-id="${m.discord_id}" onclick="toggleMember(this)">
      <div class="member-check">${i < 4 ? '✅' : '☐'}</div>
      <img src="${m.avatar}" alt="${m.username}" class="member-avatar"
           onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="member-info">
        <div class="member-name">${m.display || m.username}</div>
        <select class="member-role" onclick="event.stopPropagation()">
          <option value="👑 Fondateur"    ${i === 0 ? 'selected' : ''}>👑 Fondateur</option>
          <option value="⭐ Team Leader"  ${i === 1 ? 'selected' : ''}>⭐ Team Leader</option>
          <option value="🎮 Organisateur" ${i === 2 ? 'selected' : ''}>🎮 Organisateur</option>
          <option value="🛡 Modérateur"   ${i >= 3  ? 'selected' : ''}>🛡 Modérateur</option>
        </select>
      </div>
    </div>
  `).join('');
}

window.toggleMember = function(card) {
  card.classList.toggle('checked');
  card.querySelector('.member-check').textContent = card.classList.contains('checked') ? '✅' : '☐';
};

function initModuleCards() {
  document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('checked');
      card.querySelector('input').checked = card.classList.contains('checked');
    });
  });
}

window.goToStep1 = function() { showScreen(1); };

window.goToStep2 = function() {
  selectedTeam = [];
  document.querySelectorAll('.member-card.checked').forEach(card => {
    const id     = card.dataset.id;
    const member = scannedMembers.find(m => m.discord_id === id);
    const role   = card.querySelector('.member-role').value;
    if (member) selectedTeam.push({ ...member, role });
  });
  showScreen(2);
};

window.goToStep3 = function() {
  selectedModules = [];
  document.querySelectorAll('.module-card.checked').forEach(card => {
    selectedModules.push(card.dataset.module);
  });
  buildSummary();
  showScreen(3);
};

function showScreen(n) {
  document.querySelectorAll('.setup-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'done'));
  const target = document.getElementById(`screen-${n}`);
  if (target) target.classList.add('active');
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    if (!dot) continue;
    if (i < n)  dot.classList.add('done');
    if (i === n) dot.classList.add('active');
  }
}

const moduleChannelMap = {
  welcome    : ['bienvenue'],
  tickets    : ['tickets', 'logs-tickets'],
  events     : ['événements', 'inscriptions'],
  suggestions: ['suggestions'],
  logs       : ['logs'],
  automod    : ['logs-automod'],
};

const moduleLabels = {
  welcome    : 'Welcome',
  tickets    : 'Tickets',
  events     : 'Événements',
  suggestions: 'Suggestions',
  logs       : 'Logs',
  automod    : 'AutoMod',
};

function buildSummary() {
  document.getElementById('summary-team').innerHTML = selectedTeam.length
    ? selectedTeam.map(m => `<div class="summary-item">${m.role} — <strong>${m.display || m.username}</strong></div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun membre sélectionné</div>';

  document.getElementById('summary-modules').innerHTML = selectedModules.length
    ? selectedModules.map(m => `<div class="summary-item">✅ ${moduleLabels[m] || m}</div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun module sélectionné</div>';

  const chans = selectedModules.flatMap(m => moduleChannelMap[m] || []);
  document.getElementById('summary-channels').innerHTML = chans.length
    ? chans.map(c => `<div class="summary-item"># ${c}</div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun salon à créer</div>';
}

window.install = async function() {
  const btn = document.getElementById('btn-install');
  btn.disabled    = true;
  btn.textContent = '⏳ Installation en cours...';

  try {
    const res  = await fetch(`${BOT_URL}/api/setup/install`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body   : JSON.stringify({ guild_id: guildId, team: selectedTeam, modules: selectedModules }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur installation');

    document.getElementById('install-summary').innerHTML = `
      <div class="result-item">✅ ${data.created.roles?.length || 0} rôles créés</div>
      <div class="result-item">✅ ${data.created.channels?.length || 0} salons créés</div>
      <div class="result-item">✅ ${selectedTeam.length} membres configurés</div>
    `;

    document.querySelectorAll('.setup-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-success').classList.add('active');

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '🚀 Installer WARSTACK';
    alert('❌ Erreur : ' + err.message);
  }
};