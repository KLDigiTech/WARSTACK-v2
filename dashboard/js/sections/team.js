import { supabase }              from '../supabaseClient.js';
import { BOT_URL, API_KEY }      from '../config.js';
import { showToast }             from '../ui/toast.js';
import { showModal, closeModal } from '../ui/modal.js';
import { getActiveGuildId }      from '../services/guildService.js';
import { clearPermissionCache }  from '../services/permissionService.js';
import { ROLES, ROLE_PERMS, PERMS_LIST, PERMS_LABELS } from '../services/teamRoles.js';

let _members      = [];

const ROLE_PERMS = {
  '👑 Fondateur'   : ['overview','players','tournament','events','suggestions','tickets','logs','moderation','analytics','settings','channels','reactions','messages','onboarding','access'],
  '⭐ Team Leader' : ['overview','players','tournament','events','suggestions','tickets','logs'],
  '🎮 Organisateur': ['overview','events','tournament','suggestions'],
  '🛡 Modérateur'  : ['overview','tickets','logs','suggestions','moderation'],
};

const PERMS_LIST = ['logs','tickets','suggestions','events','tournament','moderation','analytics','settings'];
const PERMS_LABELS = { logs:'Logs', tickets:'Tickets', suggestions:'Suggestions', events:'Événements', tournament:'Tournois', moderation:'Modération', analytics:'Analytics', settings:'Paramètres' };
const ROLES = ['👑 Fondateur','⭐ Team Leader','🎮 Organisateur','🛡 Modérateur'];

let _members      = [];
let _editingId    = null;
let _selectedUser = null;
let _selectedRole = null;
let _deleteId     = null;
let _searchTimer  = null;

export async function initTeam() {
  await loadTeam();
  renderRolePerms();
  document.getElementById('btn-add-member').onclick = () => openAddModal();
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadTeam() {
  document.getElementById('team-loading').style.display = 'flex';
  document.getElementById('team-content').style.display = 'none';

  const guildId = await getActiveGuildId();

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('guild_id', guildId)
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
    const perms = ROLE_PERMS[m.role] || [];
    const extra = m.extra_perms ? JSON.parse(m.extra_perms) : [];
    const total = new Set([...perms, ...extra]).size;
    const pct   = Math.round((total / 16) * 100);

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

// ── MODAL BODY HELPERS ────────────────────────────────────────
function roleChoicesHTML(selected = null) {
  return `
    <div class="role-choices" id="modal-role-choices">
      ${ROLES.map(r => `
        <div class="role-choice ${r === selected ? 'active' : ''}" data-role="${r}" onclick="selectRole(this)">
          <span class="role-choice-emoji">${r.split(' ')[0]}</span>
          <span class="role-choice-label">${r.split(' ').slice(1).join(' ')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function extraPermsHTML(checked = []) {
  return `
    <div class="perms-list" id="modal-extra-perms">
      ${PERMS_LIST.map(p => `
        <label class="perm-item">
          <input type="checkbox" value="${p}" ${checked.includes(p) ? 'checked' : ''}>
          ${PERMS_LABELS[p]}
        </label>
      `).join('')}
    </div>
  `;
}

function modalFooter() {
  return `
    <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem">
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn-primary" onclick="saveMember()">Enregistrer</button>
    </div>
  `;
}

// ── OPEN EDIT ─────────────────────────────────────────────────
window.openEditModal = function(discordId) {
  const m = _members.find(x => x.discord_id === discordId);
  if (!m) return;

  _editingId    = discordId;
  _selectedUser = { discord_id: m.discord_id, username: m.username, avatar: m.avatar };
  _selectedRole = m.role;

  const extra = m.extra_perms ? JSON.parse(m.extra_perms) : [];

  showModal({
    title: `Modifier ${m.username}`,
    body: `
      <div class="form-group">
        <label class="form-label">Membre</label>
        <div class="selected-member-card">
          <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
               onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
               style="width:32px;height:32px;border-radius:50%">
          <span style="font-weight:700;color:var(--text);margin-left:.75rem">${m.username}</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Rôle</label>
        ${roleChoicesHTML(m.role)}
      </div>
      <div class="form-group">
        <label class="form-label">Permissions supplémentaires</label>
        ${extraPermsHTML(extra)}
      </div>
      ${modalFooter()}
    `
  });
};

// ── OPEN ADD ──────────────────────────────────────────────────
window.openAddModal = function() {
  _editingId    = null;
  _selectedUser = null;
  _selectedRole = null;

  showModal({
    title: 'Ajouter un membre',
    body: `
      <div class="form-group" id="search-group">
        <label class="form-label">Rechercher un membre Discord</label>
        <input type="text" class="form-input" id="member-search" placeholder="Tapez un pseudo..." oninput="searchMembersModal(this.value)">
        <div id="search-results" class="search-results"></div>
      </div>
      <div class="form-group" id="selected-member-group" style="display:none">
        <label class="form-label">Membre sélectionné</label>
        <div class="selected-member-card" id="selected-member-card"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Rôle</label>
        ${roleChoicesHTML()}
      </div>
      <div class="form-group">
        <label class="form-label">Permissions supplémentaires</label>
        ${extraPermsHTML()}
      </div>
      ${modalFooter()}
    `
  });
};

// ── OPEN DELETE ───────────────────────────────────────────────
window.openDeleteModal = function(discordId, username) {
  _deleteId = discordId;
  showModal({
    title: 'Retirer ce membre ?',
    body: `
      <p style="color:var(--text-muted)">
        Cette action retire <strong style="color:var(--text)">${username}</strong>
        de l'équipe WARSTACK. Ses accès au dashboard seront supprimés.
      </p>
      <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem">
        <button class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button class="btn-danger" onclick="confirmDelete()">Retirer</button>
      </div>
    `
  });
};

// ── ACTIONS ───────────────────────────────────────────────────
window.selectRole = function(card) {
  document.querySelectorAll('#modal-role-choices .role-choice').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  _selectedRole = card.dataset.role;
};

window.confirmDelete = async function() {
  if (!_deleteId) return;
  const guildId = await getActiveGuildId();
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('guild_id', guildId)
    .eq('discord_id', _deleteId);

  if (error) { showToast('Erreur suppression', 'error'); return; }
  closeModal();
  showToast('Membre retiré', 'success');
  await loadTeam();
};

window.searchMembersModal = async function(q) {
  clearTimeout(_searchTimer);
  if (q.length < 2) { document.getElementById('search-results').innerHTML = ''; return; }
  _searchTimer = setTimeout(async () => {
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
        <div class="search-result-item" onclick="selectMember('${m.discord_id}','${m.username}','${m.avatar}')">
          <img src="${m.avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <span>${m.display || m.username}</span>
        </div>
      `).join('');
    } catch {}
  }, 300);
};

window.selectMember = function(id, username, avatar) {
  _selectedUser = { discord_id: id, username, avatar };
  document.getElementById('search-group').style.display          = 'none';
  document.getElementById('selected-member-group').style.display = 'block';
  document.getElementById('selected-member-card').innerHTML = `
    <img src="${avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
         style="width:32px;height:32px;border-radius:50%">
    <span style="font-weight:700;color:var(--text);margin-left:.75rem">${username}</span>
    <button onclick="clearSelectedMember()"
            style="background:none;border:none;color:var(--text-muted);cursor:pointer;margin-left:auto">✕</button>
  `;
};

window.clearSelectedMember = function() {
  _selectedUser = null;
  document.getElementById('search-group').style.display          = 'block';
  document.getElementById('selected-member-group').style.display = 'none';
  document.getElementById('member-search').value                 = '';
  document.getElementById('search-results').innerHTML            = '';
};

window.saveMember = async function() {
  if (!_selectedUser) { showToast('Sélectionnez un membre', 'error'); return; }
  if (!_selectedRole) { showToast('Sélectionnez un rôle', 'error'); return; }

  const extraPerms = [...document.querySelectorAll('#modal-extra-perms input:checked')].map(cb => cb.value);
  const guildId    = await getActiveGuildId();

  const { error } = await supabase.from('team_members').upsert({
    guild_id   : guildId,
    discord_id : _selectedUser.discord_id,
    username   : _selectedUser.username,
    avatar     : _selectedUser.avatar,
    role       : _selectedRole,
    extra_perms: JSON.stringify(extraPerms),
    created_at : new Date().toISOString(),
  }, { onConflict: 'guild_id,discord_id' });

if (error) { showToast('Erreur enregistrement', 'error'); return; }

  clearPermissionCache(); // les accès au dashboard changent immédiatement
  closeModal();
  showToast(_editingId ? 'Membre modifié — ses accès sont mis à jour immédiatement' : 'Membre ajouté', 'success');
  await loadTeam();
};
