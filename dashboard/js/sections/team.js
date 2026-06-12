import { supabase }           from '../supabaseClient.js';
import { BOT_URL, API_KEY }   from '../config.js';
import { showToast }          from '../ui/toast.js';

const GUILD_ID = sessionStorage.getItem('warstack_guild_id') || window.WARSTACK_GUILD_ID;

const ROLE_PERMS = {
  '👑 Fondateur'   : ['overview','players','tournament','events','suggestions','tickets','logs','moderation','analytics','settings','channels','reactions','messages','onboarding','access'],
  '⭐ Team Leader' : ['overview','players','tournament','events','suggestions','tickets','logs'],
  '🎮 Organisateur': ['overview','events','tournament','suggestions'],
  '🛡 Modérateur'  : ['overview','tickets','logs','suggestions','moderation'],
};

let _members      = [];
let _editingId    = null;
let _selectedUser = null;
let _selectedRole = null;
let _searchTimer  = null;

export async function initTeam() {
  await loadTeam();
  renderRolePerms();
  bindEvents();
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadTeam() {
  document.getElementById('team-loading').style.display = 'flex';
  document.getElementById('team-content').style.display = 'none';

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('guild_id', GUILD_ID)
    .order('created_at', { ascending: true });

  if (error) { showToast('Erreur chargement équipe', 'error'); return; }

  _members = data || [];
  renderTable();

  document.getElementById('team-loading').style.display = 'none';
  document.getElementById('team-content').style.display = 'block';
}

// ── RENDER TABLE ──────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('team-tbody');

  if (!_members.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">Aucun membre dans l'équipe</td></tr>`;
    return;
  }

  tbody.innerHTML = _members.map(m => {
    const perms   = ROLE_PERMS[m.role] || [];
    const extra   = m.extra_perms ? JSON.parse(m.extra_perms) : [];
    const total   = new Set([...perms, ...extra]).size;
    const pct     = Math.round((total / 16) * 100);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem">
            <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
                 style="width:36px;height:36px;border-radius:50%;border:2px solid var(--border)">
            <div>
              <div style="font-weight:700;color:var(--text)">${m.username}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${m.discord_id}</div>
            </div>
          </div>
        </td>
        <td><span class="role-badge">${m.role}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="perm-bar"><div class="perm-bar-fill" style="width:${pct}%"></div></div>
            <span style="font-size:.8rem;color:var(--text-muted)">${pct}%</span>
          </div>
        </td>
        <td>
          <div style="display:flex;gap:.5rem">
            <button class="btn-icon" onclick="openEditModal('${m.discord_id}')">✏️</button>
            <button class="btn-icon btn-icon-danger" onclick="openDeleteModal('${m.discord_id}', '${m.username}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── RENDER ROLE PERMS ─────────────────────────────────────────
function renderRolePerms() {
  const grid = document.getElementById('role-perms-grid');
  const labels = {
    overview:'Vue générale', players:'Joueurs', tournament:'Tournois',
    events:'Événements', suggestions:'Suggestions', tickets:'Tickets',
    logs:'Logs', moderation:'Modération', analytics:'Analytics',
    settings:'Paramètres', channels:'Salons', reactions:'Réactions',
    messages:'Messages', onboarding:'Onboarding', access:'Accès'
  };

  grid.innerHTML = Object.entries(ROLE_PERMS).map(([role, perms]) => `
    <div class="role-perm-card">
      <div class="role-perm-title">${role}</div>
      <div class="role-perm-list">
        ${perms.map(p => `<span class="perm-tag">${labels[p] || p}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ── MODALS ────────────────────────────────────────────────────
window.openEditModal = function(discordId) {
  const m = _members.find(x => x.discord_id === discordId);
  if (!m) return;

  _editingId    = discordId;
  _selectedUser = { discord_id: m.discord_id, username: m.username, avatar: m.avatar };
  _selectedRole = m.role;

  document.getElementById('team-modal-title').textContent = 'Modifier ' + m.username;
  document.getElementById('search-group').style.display         = 'none';
  document.getElementById('selected-member-group').style.display = 'block';
  document.getElementById('selected-member-card').innerHTML = `
    <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
         style="width:32px;height:32px;border-radius:50%">
    <span style="font-weight:700;color:var(--text)">${m.username}</span>
  `;

  // Sélectionner le rôle
  document.querySelectorAll('.role-choice').forEach(c => {
    c.classList.toggle('active', c.dataset.role === m.role);
  });

  // Cocher les permissions extra
  const extra = m.extra_perms ? JSON.parse(m.extra_perms) : [];
  document.querySelectorAll('#extra-perms input').forEach(cb => {
    cb.checked = extra.includes(cb.value);
  });

  document.getElementById('team-modal').style.display = 'flex';
};

window.openAddModal = function() {
  _editingId    = null;
  _selectedUser = null;
  _selectedRole = null;

  document.getElementById('team-modal-title').textContent = 'Ajouter un membre';
  document.getElementById('search-group').style.display          = 'block';
  document.getElementById('selected-member-group').style.display = 'none';
  document.getElementById('member-search').value                 = '';
  document.getElementById('search-results').innerHTML            = '';
  document.querySelectorAll('.role-choice').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#extra-perms input').forEach(cb => cb.checked = false);

  document.getElementById('team-modal').style.display = 'flex';
};

window.selectRole = function(card) {
  document.querySelectorAll('.role-choice').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  _selectedRole = card.dataset.role;
};

let _deleteId = null;

window.openDeleteModal = function(discordId, username) {
  _deleteId = discordId;
  document.getElementById('delete-member-name').textContent = username;
  document.getElementById('team-delete-modal').style.display = 'flex';
};

window.confirmDelete = async function() {
  if (!_deleteId) return;
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('guild_id', GUILD_ID)
    .eq('discord_id', _deleteId);

  if (error) { showToast('Erreur suppression', 'error'); return; }

  document.getElementById('team-delete-modal').style.display = 'none';
  showToast('Membre retiré', 'success');
  await loadTeam();
};

// ── SEARCH MEMBRES ────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-add-member').onclick = () => openAddModal();

  document.getElementById('member-search').addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('search-results').innerHTML = ''; return; }
    _searchTimer = setTimeout(() => searchMembers(q), 300);
  });
}

async function searchMembers(q) {
  try {
    const res  = await fetch(`${BOT_URL}/api/member/search?q=${encodeURIComponent(q)}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();
    const results = document.getElementById('search-results');

    if (!data.members?.length) {
      results.innerHTML = '<div style="color:var(--text-muted);padding:.5rem">Aucun résultat</div>';
      return;
    }

    results.innerHTML = data.members.map(m => `
      <div class="search-result-item" onclick="selectMember('${m.discord_id}', '${m.username}', '${m.avatar}')">
        <img src="${m.avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <span>${m.display || m.username}</span>
      </div>
    `).join('');
  } catch {}
}

window.selectMember = function(id, username, avatar) {
  _selectedUser = { discord_id: id, username, avatar };
  document.getElementById('search-group').style.display          = 'none';
  document.getElementById('selected-member-group').style.display = 'block';
  document.getElementById('selected-member-card').innerHTML = `
    <img src="${avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
         style="width:32px;height:32px;border-radius:50%">
    <span style="font-weight:700;color:var(--text)">${username}</span>
    <button onclick="clearSelectedMember()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;margin-left:auto">✕</button>
  `;
};

window.clearSelectedMember = function() {
  _selectedUser = null;
  document.getElementById('search-group').style.display          = 'block';
  document.getElementById('selected-member-group').style.display = 'none';
  document.getElementById('member-search').value                 = '';
  document.getElementById('search-results').innerHTML            = '';
};

// ── SAVE ──────────────────────────────────────────────────────
window.saveMember = async function() {
  if (!_selectedUser) { showToast('Sélectionnez un membre', 'error'); return; }
  if (!_selectedRole) { showToast('Sélectionnez un rôle', 'error'); return; }

  const extraPerms = [...document.querySelectorAll('#extra-perms input:checked')].map(cb => cb.value);

  const { error } = await supabase.from('team_members').upsert({
    guild_id   : GUILD_ID,
    discord_id : _selectedUser.discord_id,
    username   : _selectedUser.username,
    avatar     : _selectedUser.avatar,
    role       : _selectedRole,
    extra_perms: JSON.stringify(extraPerms),
    created_at : new Date().toISOString(),
  }, { onConflict: 'guild_id,discord_id' });

  if (error) { showToast('Erreur enregistrement', 'error'); return; }

  document.getElementById('team-modal').style.display = 'none';
  showToast(_editingId ? 'Membre modifié' : 'Membre ajouté', 'success');
  await loadTeam();
};