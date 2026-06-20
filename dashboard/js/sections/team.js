import { supabase }              from '../supabaseClient.js';
import { BOT_URL, API_KEY }      from '../config.js';
import { showToast }             from '../ui/toast.js';
import { showModal, closeModal } from '../ui/modal.js';
import { getActiveGuildId }      from '../services/guildService.js';
import { clearPermissionCache, getCurrentDiscordId, isFounder } from '../services/permissionService.js';
import {
  MODULE_LABELS, ALL_MODULES,
  loadRoles, createRole, updateRole, deleteRole,
} from '../services/teamRoles.js';

let _members      = [];
let _roles        = [];
let _editingId    = null;
let _selectedUser = null;
let _selectedRole = null;
let _deleteId     = null;
let _searchTimer  = null;
let _isFounderUI  = false;

// rôle en cours d'édition dans le modal "Gérer les rôles"
let _editingRoleId      = null;
let _editingRoleModules = [];

export async function initTeam() {
  const guildId   = await getActiveGuildId();
  const discordId = await getCurrentDiscordId();
  _isFounderUI    = isFounder(discordId);

  _roles = await loadRoles(guildId);

  await loadTeam();
  renderRolePerms();
  document.getElementById('btn-add-member').onclick = () => openAddModal();

  const rolesBtn = document.getElementById('btn-manage-roles');
  if (rolesBtn) {
    rolesBtn.style.display = _isFounderUI ? 'inline-flex' : 'none';
    rolesBtn.onclick = () => openManageRolesModal();
  }
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

function roleModules(roleName) {
  return _roles.find(r => r.role_name === roleName)?.modules || [];
}

// ── RENDER TABLE ──────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('team-tbody');

  if (!_members.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">Aucun membre dans l'équipe</td></tr>`;
    return;
  }

  tbody.innerHTML = _members.map(m => {
    const perms = roleModules(m.role);
    const extra = m.extra_perms ? JSON.parse(m.extra_perms) : [];
    const total = new Set([...perms, ...extra]).size;
    const pct   = Math.round((total / ALL_MODULES.length) * 100);

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

// ── RENDER ROLE PERMS (aperçu en bas de page) ──────────────────
function renderRolePerms() {
  const grid = document.getElementById('role-perms-grid');
  if (!grid) return;

  grid.innerHTML = _roles.map(r => `
    <div class="role-perm-card">
      <div class="role-perm-title">${r.emoji || ''} ${r.role_name}</div>
      <div class="role-perm-list">
        ${(r.modules || []).map(p => `<span class="perm-tag">${MODULE_LABELS[p] || p}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ── MODAL BODY HELPERS ────────────────────────────────────────
function roleChoicesHTML(selected = null) {
  return `
    <div class="role-choices" id="modal-role-choices">
      ${_roles.map(r => `
        <div class="role-choice ${r.role_name === selected ? 'active' : ''}" data-role="${r.role_name}" onclick="selectRole(this)">
          <span class="role-choice-emoji">${r.emoji || '🔰'}</span>
          <span class="role-choice-label">${r.role_name.replace(/^\S+\s/, '')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function extraPermsHTML(checked = []) {
  return `
    <div class="perms-list" id="modal-extra-perms">
      ${ALL_MODULES.map(p => `
        <label class="perm-item">
          <input type="checkbox" value="${p}" ${checked.includes(p) ? 'checked' : ''}>
          ${MODULE_LABELS[p]}
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

// ── OPEN EDIT MEMBRE ─────────────────────────────────────────────────
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

// ── OPEN DELETE MEMBRE ───────────────────────────────────────────────
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

// ── ACTIONS MEMBRE ───────────────────────────────────────────────────
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

// ════════════════════════════════════════════════════════
// GESTION DES RÔLES (Fondateur uniquement)
// ════════════════════════════════════════════════════════

function rolesListHTML() {
  return _roles.map(r => `
    <div class="role-manage-row" data-role-id="${r.id}">
      <div class="role-manage-head">
        <span class="role-choice-emoji">${r.emoji || '🔰'}</span>
        <span style="font-weight:700;color:var(--text)">${r.role_name}</span>
        ${r.is_protected ? '<span class="perm-tag" style="margin-left:.5rem">protégé</span>' : ''}
        <div style="margin-left:auto;display:flex;gap:.5rem">
          <button class="btn-icon" onclick="openEditRole('${r.id}')">✏️</button>
          ${!r.is_protected ? `<button class="btn-icon btn-icon-danger" onclick="confirmDeleteRole('${r.id}','${r.role_name}')">✕</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

window.openManageRolesModal = function() {
  showModal({
    title: '🔐 Gérer les rôles',
    body: `
      <p style="color:var(--text-muted);margin-bottom:1rem">
        Crée tes propres rôles et choisis exactement ce que chacun peut voir dans le dashboard.
      </p>
      <div id="roles-manage-list">${rolesListHTML()}</div>
      <button class="btn-secondary" style="margin-top:1rem;width:100%" onclick="openNewRoleForm()">
        + Nouveau rôle
      </button>
      <div style="display:flex;justify-content:flex-end;margin-top:1.5rem">
        <button class="btn-secondary" onclick="closeModal()">Fermer</button>
      </div>
    `
  });
};

function roleFormHTML(role = null) {
  _editingRoleId      = role?.id || null;
  _editingRoleModules = role?.modules || [];

  return `
    <div class="form-group">
      <label class="form-label">Emoji</label>
      <input type="text" class="form-input" id="role-form-emoji" maxlength="2" value="${role?.emoji || '🔰'}" style="width:70px">
    </div>
    <div class="form-group">
      <label class="form-label">Nom du rôle</label>
      <input type="text" class="form-input" id="role-form-name" value="${role?.role_name?.replace(/^\S+\s/, '') || ''}" placeholder="Ex : Recruteur">
    </div>
    <div class="form-group">
      <label class="form-label">Modules accessibles</label>
      <div class="perms-list" id="role-form-modules">
        ${ALL_MODULES.map(m => `
          <label class="perm-item">
            <input type="checkbox" value="${m}" ${_editingRoleModules.includes(m) ? 'checked' : ''}>
            ${MODULE_LABELS[m]}
          </label>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem">
      <button class="btn-secondary" onclick="openManageRolesModal()">Retour</button>
      <button class="btn-primary" onclick="saveRole()">Enregistrer le rôle</button>
    </div>
  `;
}

window.openNewRoleForm = function() {
  showModal({ title: '+ Nouveau rôle', body: roleFormHTML(null) });
};

window.openEditRole = function(roleId) {
  const role = _roles.find(r => r.id === roleId);
  if (!role) return;
  showModal({ title: `Modifier ${role.role_name}`, body: roleFormHTML(role) });
};

window.saveRole = async function() {
  const emoji   = document.getElementById('role-form-emoji').value.trim() || '🔰';
  const name    = document.getElementById('role-form-name').value.trim();
  const modules = [...document.querySelectorAll('#role-form-modules input:checked')].map(cb => cb.value);

  if (!name) { showToast('Donne un nom au rôle', 'error'); return; }
  if (!modules.length) { showToast('Sélectionne au moins un module', 'error'); return; }

  const guildId  = await getActiveGuildId();
  const fullName = `${emoji} ${name}`;

  const { error } = _editingRoleId
    ? await updateRole(guildId, _editingRoleId, { role_name: fullName, emoji, modules })
    : await createRole(guildId, { role_name: fullName, emoji, modules });

  if (error) { showToast('Erreur enregistrement du rôle', 'error'); return; }

  _roles = await loadRoles(guildId, true);
  clearPermissionCache();
  renderRolePerms();
  renderTable();
  showToast(_editingRoleId ? 'Rôle modifié' : 'Rôle créé', 'success');
  openManageRolesModal();
};

window.confirmDeleteRole = function(roleId, roleName) {
  showModal({
    title: 'Supprimer ce rôle ?',
    body: `
      <p style="color:var(--text-muted)">
        Le rôle <strong style="color:var(--text)">${roleName}</strong> sera supprimé.
        Les membres qui l'ont actuellement perdront leurs accès tant qu'ils n'auront pas un nouveau rôle.
      </p>
      <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem">
        <button class="btn-secondary" onclick="openManageRolesModal()">Annuler</button>
        <button class="btn-danger" onclick="doDeleteRole('${roleId}')">Supprimer</button>
      </div>
    `
  });
};

window.doDeleteRole = async function(roleId) {
  const guildId = await getActiveGuildId();
  const { error } = await deleteRole(guildId, roleId);
  if (error) { showToast('Erreur suppression du rôle', 'error'); return; }

  _roles = await loadRoles(guildId, true);
  clearPermissionCache();
  renderRolePerms();
  renderTable();
  showToast('Rôle supprimé', 'success');
  openManageRolesModal();
};