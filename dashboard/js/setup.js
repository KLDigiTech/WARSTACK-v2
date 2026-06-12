import { supabase } from './supabaseClient.js';
import { BOT_URL, API_KEY } from './config.js';

let guildId         = null;
let scannedMembers  = [];
let selectedModules = [];

// Rôles par défaut — nom modifiable, membres assignables
let roles = [
  { id: 'fondateur',    label: 'Fondateur',    emoji: '👑', members: [] },
  { id: 'teamleader',   label: 'Team Leader',  emoji: '⭐', members: [] },
  { id: 'organisateur', label: 'Organisateur', emoji: '🎮', members: [] },
  { id: 'moderateur',   label: 'Modérateur',   emoji: '🛡', members: [] },
];

// ── Init ──────────────────────────────────────────────────────
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
    const { data: guildData, error } = await supabase
      .from('guilds')
      .select('guild_id, name')
      .eq('owner_id', discordId)
      .eq('setup_complete', false)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !guildData) {
      document.getElementById('members-loading').innerHTML =
        '<span style="color:var(--danger)">❌ Aucun serveur en attente. Invitez d\'abord le bot sur votre serveur.</span>';
      return;
    }

    guildId = guildData.guild_id;

  } catch (err) {
    document.getElementById('members-loading').innerHTML =
      `<span style="color:var(--danger)">❌ Erreur : ${err.message}</span>`;
    return;
  }

  await scanServer();
  initModuleCards();
});

// ── SCAN ─────────────────────────────────────────────────────
async function scanServer() {
  try {
    const res  = await fetch(`${BOT_URL}/api/setup/scan/${guildId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Scan échoué');
    scannedMembers = data.privileged || [];
    renderScreen1();
  } catch (err) {
    document.getElementById('members-loading').innerHTML =
      `<span style="color:var(--danger)">❌ Scan impossible : ${err.message}</span>`;
  }
}

// ── SCREEN 1 — ÉQUIPE ─────────────────────────────────────────
function renderScreen1() {
  const loading = document.getElementById('members-loading');
  const list    = document.getElementById('members-list');

  loading.style.display = 'none';
  list.style.display    = 'block';
  document.getElementById('btn-next-1').disabled = false;

  renderRoles();
}

function renderRoles() {
  const list = document.getElementById('members-list');

  list.innerHTML = `
    <div class="roles-grid">
      ${roles.map((role, ri) => `
        <div class="role-block" data-role-id="${role.id}">
          <div class="role-header">
            <span class="role-emoji">${role.emoji}</span>
            <input class="role-label-input" value="${role.label}" 
                   onchange="updateRoleLabel(${ri}, this.value)"
                   placeholder="Nom du rôle">
            <button class="btn-remove-role" onclick="removeRole(${ri})" title="Supprimer ce rôle">✕</button>
          </div>

          <div class="role-members">
            ${role.members.map((m, mi) => `
              <div class="role-member-card">
                <img src="${m.avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <span>${m.display || m.username}</span>
                <button onclick="removeMemberFromRole(${ri}, ${mi})">✕</button>
              </div>
            `).join('')}
          </div>

          <div class="role-add-member">
            <select onchange="addMemberToRole(${ri}, this)">
              <option value="">+ Ajouter un membre</option>
              ${scannedMembers
                .filter(m => !roles.some(r => r.members.find(rm => rm.discord_id === m.discord_id)))
                .map(m => `<option value="${m.discord_id}">${m.display || m.username}</option>`)
                .join('')}
            </select>
          </div>
        </div>
      `).join('')}
    </div>

    <button class="btn-add-role" onclick="addRole()">+ Ajouter un rôle</button>
  `;
}

// ── ACTIONS RÔLES ─────────────────────────────────────────────
window.updateRoleLabel = function(ri, value) {
  roles[ri].label = value;
};

window.addMemberToRole = function(ri, select) {
  const id = select.value;
  if (!id) return;
  const member = scannedMembers.find(m => m.discord_id === id);
  if (!member) return;
  roles[ri].members.push(member);
  select.value = '';
  renderRoles();
};

window.removeMemberFromRole = function(ri, mi) {
  roles[ri].members.splice(mi, 1);
  renderRoles();
};

window.removeRole = function(ri) {
  roles.splice(ri, 1);
  renderRoles();
};

window.addRole = function() {
  roles.push({ id: `role_${Date.now()}`, label: 'Nouveau rôle', emoji: '🔹', members: [] });
  renderRoles();
};

// ── MODULES ───────────────────────────────────────────────────
function initModuleCards() {
  document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('checked');
      card.querySelector('input').checked = card.classList.contains('checked');
    });
  });
}

// ── NAVIGATION ────────────────────────────────────────────────
window.goToStep1 = function() { showScreen(1); };

window.goToStep2 = function() {
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

// ── RÉSUMÉ ────────────────────────────────────────────────────
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
  const teamFlat = roles.flatMap(r => r.members.map(m => ({ ...m, role: r.label })));

  document.getElementById('summary-team').innerHTML = teamFlat.length
    ? teamFlat.map(m => `<div class="summary-item">${m.role} — <strong>${m.display || m.username}</strong></div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun membre assigné</div>';

  document.getElementById('summary-modules').innerHTML = selectedModules.length
    ? selectedModules.map(m => `<div class="summary-item">✅ ${moduleLabels[m] || m}</div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun module sélectionné</div>';

  const chans = selectedModules.flatMap(m => moduleChannelMap[m] || []);
  document.getElementById('summary-channels').innerHTML = chans.length
    ? chans.map(c => `<div class="summary-item"># ${c}</div>`).join('')
    : '<div class="summary-item" style="color:var(--text-muted)">Aucun salon à créer</div>';
}

// ── INSTALL ───────────────────────────────────────────────────
window.install = async function() {
  const btn = document.getElementById('btn-install');
  btn.disabled    = true;
  btn.textContent = '⏳ Installation en cours...';

  const teamFlat = roles.flatMap(r => r.members.map(m => ({
    discord_id: m.discord_id,
    username  : m.username,
    avatar    : m.avatar,
    role      : r.label,
  })));

  try {
    const res  = await fetch(`${BOT_URL}/api/setup/install`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body   : JSON.stringify({ guild_id: guildId, team: teamFlat, modules: selectedModules }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur installation');

    document.getElementById('install-summary').innerHTML = `
      <div class="result-item">✅ ${data.created.channels?.length || 0} salons créés</div>
      <div class="result-item">✅ ${teamFlat.length} membres configurés</div>
    `;

    document.querySelectorAll('.setup-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-success').classList.add('active');

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '🚀 Installer WARSTACK';
    alert('❌ Erreur : ' + err.message);
  }
};