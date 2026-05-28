// dashboard/js/sections/access.js v2
// Modal centré, tout cocher, protection Fondateur

import {
  getDashboardRoles,
  getRolePermissions,
  getRoleChannels,
  saveRolePermissions,
  saveRoleChannels,
  createDashboardRole,
  updateDashboardRole,
  deleteDashboardRole,
  getGuildMembers,
  assignRoleToMember,
  removeRoleFromMember,
  getDiscordChannels
} from '../services/accessService.js';

import { showToast } from '../ui/toast.js';
import { getCurrentDiscordId } from '../services/permissionService.js';

// ─── CONSTANTES ──────────────────────────────────────────────

const FOUNDER_ID = '1233271006236377180';

const ALL_MODULES = [
  { key: 'overview',    label: 'Vue générale'    },
  { key: 'players',     label: 'Joueurs'          },
  { key: 'tournament',  label: 'Tournoi'          },
  { key: 'moderation',  label: 'Modération'       },
  { key: 'automod',     label: 'Auto-mod'         },
  { key: 'logs',        label: 'Logs'             },
  { key: 'tickets',     label: 'Tickets'          },
  { key: 'channels',    label: 'Salons'           },
  { key: 'roles',       label: 'Rôles auto'       },
  { key: 'welcome',     label: 'Arrivées'         },
  { key: 'messages',    label: 'Messages récur.'  },
  { key: 'reactions',   label: 'Rôles-réactions'  },
  { key: 'birthdays',   label: 'Anniversaires'    },
  { key: 'suggestions', label: 'Suggestions'      },
  { key: 'access',      label: 'Accès Dashboard'  },
  { key: 'settings',    label: 'Paramètres'       },
  { key: 'ocr-test',    label: 'Test OCR'         },
];

const COLORS = [
  '#FFD700','#00FF66','#00D1FF','#9B59B6','#ED4245',
  '#FAA61A','#EB459E','#57F287','#5865F2','#95A5A6',
  '#FF6B35','#00B894','#FD79A8','#6C5CE7','#FDCB6E',
  '#ffffff','#e74c3c','#2ecc71','#3498db','#f39c12',
];

// ─── STATE ───────────────────────────────────────────────────

let _roles         = [];
let _members       = [];
let _channels      = [];
let _editingRoleId = null;
let _editingMember = null;
let _selectedColor = '#00FF66';
let _selectedRoleId= null;

// ─── INIT ────────────────────────────────────────────────────

export async function initAccess() {
  [_roles, _members] = await Promise.all([
    getDashboardRoles(),
    getGuildMembers()
  ]);

  renderRoles();
  renderMembers(_members);
  initTabs();
  initRoleModalEvents();
  initMemberModalEvents();
  initSearch();

  document.getElementById('btn-new-role')
    ?.addEventListener('click', () => openRoleModal(null));
}

// ─── TABS ─────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.access-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.access-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.access-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ─── RENDER RÔLES ─────────────────────────────────────────────

function renderRoles() {
  const list = document.getElementById('roles-list');
  if (!list) return;

  if (!_roles?.length) {
    list.innerHTML = `<div class="access-loading">Aucun rôle créé.</div>`;
    return;
  }

  list.innerHTML = _roles.map(role => `
    <div class="access-role-row" data-role-id="${role.id}"
         style="--role-color:${role.color || '#00ff66'}">
      <div class="access-role-dot" style="background:${role.color || '#00ff66'}"></div>
      <div class="access-role-info">
        <div class="access-role-name" style="color:${role.color || '#00ff66'}">${role.name}</div>
        <div class="access-role-meta">${_members.filter(m => m.role_id == role.id).length} membre(s)</div>
      </div>
      ${role.is_system ? '<span class="access-badge access-badge-system">SYSTÈME</span>' : ''}
      <i class="fas fa-chevron-right access-role-arrow"></i>
    </div>
  `).join('');

  list.querySelectorAll('.access-role-row').forEach(row => {
    row.addEventListener('click', () => openRoleModal(row.dataset.roleId));
  });
}

// ─── RENDER MEMBRES ───────────────────────────────────────────

function renderMembers(members) {
  const list = document.getElementById('members-list');
  if (!list) return;

  const roleMap = {};
  (_roles || []).forEach(r => { roleMap[r.id] = r; });

  if (!members?.length) {
    list.innerHTML = `<div class="access-loading">Aucun joueur inscrit.</div>`;
    return;
  }

  list.innerHTML = members.map(m => {
    const role = m.role_id ? roleMap[m.role_id] : null;
    return `
      <div class="access-member-row" data-discord-id="${m.discord_id}">
        ${m.avatar_url
          ? `<img class="access-member-avatar" src="${m.avatar_url}" alt="">`
          : `<div class="access-member-avatar-placeholder"><i class="fas fa-user"></i></div>`
        }
        <div class="access-member-info">
          <div class="access-member-name">${m.username || m.discord_id}</div>
          ${m.pseudo_bf6 ? `<div class="access-member-pseudo">${m.pseudo_bf6}</div>` : ''}
        </div>
        ${role
          ? `<span class="access-member-role-badge"
               style="color:${role.color};border-color:${role.color}33;background:${role.color}11">
               ${role.name}
             </span>`
          : `<span class="access-member-no-role">— Aucun rôle</span>`
        }
      </div>
    `;
  }).join('');

  list.querySelectorAll('.access-member-row').forEach(row => {
    row.addEventListener('click', () => {
      const member = members.find(m => m.discord_id === row.dataset.discordId);
      if (member) openMemberModal(member);
    });
  });
}

// ─── SEARCH ───────────────────────────────────────────────────

function initSearch() {
  document.getElementById('member-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { renderMembers(_members); return; }
    renderMembers(_members.filter(m =>
      (m.username || '').toLowerCase().includes(q) ||
      (m.pseudo_bf6 || '').toLowerCase().includes(q)
    ));
  });
}

// ─── MODAL RÔLE ───────────────────────────────────────────────

async function openRoleModal(roleId) {
  _editingRoleId = roleId;

  const modal    = document.getElementById('role-modal');
  const title    = document.getElementById('role-modal-title');
  const nameInp  = document.getElementById('role-name-input');
  const deleteBtn= document.getElementById('btn-delete-role');

  let currentPerms = [], currentChannels = [], role = null;

  if (roleId) {
    role = _roles.find(r => r.id == roleId);
    title.textContent = `Modifier — ${role?.name || ''}`;
    nameInp.value     = role?.name || '';
    _selectedColor    = role?.color || '#00FF66';
    deleteBtn.style.display = role?.is_system ? 'none' : 'inline-flex';

    const [perms, chans] = await Promise.all([
      getRolePermissions(roleId),
      getRoleChannels(roleId)
    ]);
    currentPerms    = (perms  || []).map(p => p.module_key);
    currentChannels = (chans  || []).map(c => c.channel_id);
  } else {
    title.textContent       = 'Nouveau rôle';
    nameInp.value           = '';
    _selectedColor          = '#00FF66';
    deleteBtn.style.display = 'none';
  }

  renderColorPicker();
  renderModulesGrid(currentPerms, role?.is_system);
  await renderChannelsList(currentChannels);

  modal.classList.add('open');
}

function initRoleModalEvents() {
  const overlay   = document.getElementById('role-modal-overlay');
  const closeBtn  = document.getElementById('btn-close-role-modal');
  const cancelBtn = document.getElementById('btn-cancel-role-modal');
  const saveBtn   = document.getElementById('btn-save-role');
  const deleteBtn = document.getElementById('btn-delete-role');
  const hexInput  = document.getElementById('color-hex-input');

  [overlay, closeBtn, cancelBtn].forEach(el =>
    el?.addEventListener('click', closeRoleModal)
  );

  hexInput?.addEventListener('input', e => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      _selectedColor = val;
      document.getElementById('color-preview').style.background = val;
      document.querySelectorAll('.access-color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === val)
      );
    }
  });

  // Tout cocher modules
  document.getElementById('btn-check-all-modules')?.addEventListener('click', () => {
    const all    = document.querySelectorAll('.access-module-toggle');
    const allOn  = [...all].every(t => t.classList.contains('active'));
    all.forEach(t => t.classList.toggle('active', !allOn));
    document.getElementById('btn-check-all-modules').textContent =
      allOn ? 'Tout cocher' : 'Tout décocher';
  });

  // Tout cocher salons
  document.getElementById('btn-check-all-channels')?.addEventListener('click', () => {
    const all   = document.querySelectorAll('.access-channel-toggle');
    const allOn = [...all].every(t => t.classList.contains('active'));
    all.forEach(t => t.classList.toggle('active', !allOn));
    document.getElementById('btn-check-all-channels').textContent =
      allOn ? 'Tout cocher' : 'Tout décocher';
  });

  saveBtn?.addEventListener('click', saveRole);
  deleteBtn?.addEventListener('click', deleteRole);
}

function closeRoleModal() {
  document.getElementById('role-modal').classList.remove('open');
  _editingRoleId = null;
}

function renderColorPicker() {
  const grid    = document.getElementById('color-grid');
  const preview = document.getElementById('color-preview');
  const hexInp  = document.getElementById('color-hex-input');
  if (!grid) return;

  grid.innerHTML = COLORS.map(c => `
    <div class="access-color-swatch ${c === _selectedColor ? 'active' : ''}"
         data-color="${c}" style="background:${c}${c==='#ffffff'?';border:1px solid #333':''}">
    </div>
  `).join('');

  preview.style.background = _selectedColor;
  hexInp.value             = _selectedColor;

  grid.querySelectorAll('.access-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      grid.querySelectorAll('.access-color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      _selectedColor           = swatch.dataset.color;
      preview.style.background = _selectedColor;
      hexInp.value             = _selectedColor;
    });
  });
}

function renderModulesGrid(activeModules, isSystem) {
  const grid = document.getElementById('modules-grid');
  if (!grid) return;

  grid.innerHTML = ALL_MODULES.map(m => `
    <label class="access-module-toggle ${activeModules.includes(m.key) ? 'active' : ''}"
           data-key="${m.key}" ${isSystem ? 'style="pointer-events:none;opacity:.5"' : ''}>
      <span class="access-module-label">${m.label}</span>
      <div class="access-module-check"></div>
    </label>
  `).join('');

  if (!isSystem) {
    grid.querySelectorAll('.access-module-toggle').forEach(toggle =>
      toggle.addEventListener('click', () => toggle.classList.toggle('active'))
    );
  }
}

async function renderChannelsList(activeChannelIds) {
  const container = document.getElementById('channels-list-modal');
  if (!container) return;

  container.innerHTML = `<div class="access-loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>`;

  try {
    if (!_channels.length) {
      const res = await getDiscordChannels();
      _channels  = res?.channels || [];
    }

    // Grouper par catégorie
    const categories = {};
    _channels.filter(c => c.type === 'category').forEach(c => { categories[c.name] = []; });
    _channels.filter(c => c.type !== 'category').forEach(c => {
      const cat = c.category || 'Sans catégorie';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(c);
    });

    container.innerHTML = Object.entries(categories)
      .filter(([, chans]) => chans.length > 0)
      .map(([catName, chans]) => `
        <div class="access-channels-category">
          <div class="access-channels-cat-title">${catName}</div>
          ${chans.map(ch => `
            <div class="access-channel-toggle ${activeChannelIds.includes(ch.id) ? 'active' : ''}"
                 data-channel-id="${ch.id}">
              <i class="fas ${ch.type === 'voice' ? 'fa-volume-up' : 'fa-hashtag'} access-channel-icon"></i>
              <span class="access-channel-name">${ch.name}</span>
              <div class="access-channel-check"></div>
            </div>
          `).join('')}
        </div>
      `).join('');

    container.querySelectorAll('.access-channel-toggle').forEach(toggle =>
      toggle.addEventListener('click', () => toggle.classList.toggle('active'))
    );

  } catch {
    container.innerHTML = `<div class="access-loading" style="color:var(--red)">Erreur chargement salons</div>`;
  }
}

async function saveRole() {
  const name = document.getElementById('role-name-input')?.value.trim();
  if (!name) { showToast('Le nom du rôle est requis.', 'error'); return; }

  const selectedModules = [...document.querySelectorAll('.access-module-toggle.active')]
    .map(t => t.dataset.key);

  const selectedChannels = [...document.querySelectorAll('.access-channel-toggle.active')]
    .map(t => t.dataset.channelId);

  try {
    let roleId = _editingRoleId;

    if (roleId) {
      await updateDashboardRole(roleId, { name, color: _selectedColor });
    } else {
      const created = await createDashboardRole(name, _selectedColor);
      roleId = created?.[0]?.id || created?.id;
    }

    await Promise.all([
      saveRolePermissions(roleId, selectedModules),
      saveRoleChannels(roleId, selectedChannels)
    ]);

    showToast(`Rôle "${name}" sauvegardé.`, 'success');
    closeRoleModal();
    _roles = await getDashboardRoles();
    renderRoles();

  } catch (err) {
    showToast(err.message || 'Erreur lors de la sauvegarde.', 'error');
  }
}

async function deleteRole() {
  const role = _roles.find(r => r.id == _editingRoleId);
  if (!role || role.is_system) return;
  if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return;
  try {
    await deleteDashboardRole(_editingRoleId);
    showToast(`Rôle "${role.name}" supprimé.`, 'success');
    closeRoleModal();
    _roles = await getDashboardRoles();
    renderRoles();
  } catch (err) {
    showToast(err.message || 'Erreur.', 'error');
  }
}

// ─── MODAL MEMBRE ─────────────────────────────────────────────

function openMemberModal(member) {
  _editingMember  = member;
  _selectedRoleId = member.role_id || null;

  document.getElementById('member-modal-title').textContent =
    `Rôle de ${member.username || member.discord_id}`;

  document.getElementById('member-info-block').innerHTML = `
    <div class="access-member-info-block">
      ${member.avatar_url
        ? `<img src="${member.avatar_url}" alt="">`
        : `<div style="width:48px;height:48px;border-radius:50%;background:rgba(0,255,120,.08);display:flex;align-items:center;justify-content:center;color:var(--green-dim);font-size:18px;border:2px solid rgba(0,255,120,.15)"><i class="fas fa-user"></i></div>`
      }
      <div>
        <div class="name">${member.username || member.discord_id}</div>
        ${member.pseudo_bf6 ? `<div class="pseudo">${member.pseudo_bf6}</div>` : ''}
      </div>
    </div>
  `;

  const radioList = document.getElementById('roles-radio-list');
  radioList.innerHTML = _roles.map(role => `
    <div class="access-role-option ${_selectedRoleId == role.id ? 'selected' : ''}"
         data-role-id="${role.id}"
         style="--role-color:${role.color || '#00ff66'}">
      <div class="access-role-option-dot" style="background:${role.color || '#00ff66'}"></div>
      <span class="access-role-option-name" style="color:${role.color || '#00ff66'}">${role.name}</span>
      <div class="access-role-option-radio"></div>
    </div>
  `).join('');

  radioList.querySelectorAll('.access-role-option').forEach(opt => {
    opt.addEventListener('click', () => {
      radioList.querySelectorAll('.access-role-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      _selectedRoleId = opt.dataset.roleId;
    });
  });

  document.getElementById('member-modal').classList.add('open');
}

function initMemberModalEvents() {
  [
    document.getElementById('member-modal-overlay'),
    document.getElementById('btn-close-member-modal'),
    document.getElementById('btn-cancel-member-modal'),
  ].forEach(el => el?.addEventListener('click', closeMemberModal));

  document.getElementById('btn-save-member-role')?.addEventListener('click', saveMemberRole);
  document.getElementById('btn-remove-member-role')?.addEventListener('click', removeMemberRole);
}

function closeMemberModal() {
  document.getElementById('member-modal').classList.remove('open');
  _editingMember  = null;
  _selectedRoleId = null;
}

async function saveMemberRole() {
  if (!_editingMember || !_selectedRoleId) {
    showToast('Sélectionne un rôle.', 'error'); return;
  }
  try {
    await assignRoleToMember(_editingMember.discord_id, _selectedRoleId);
    const role = _roles.find(r => r.id == _selectedRoleId);
    showToast(`Rôle "${role?.name}" assigné à ${_editingMember.username}.`, 'success');
    closeMemberModal();
    _members = await getGuildMembers();
    renderMembers(_members);
  } catch (err) {
    showToast(err.message || 'Erreur.', 'error');
  }
}

async function removeMemberRole() {
  if (!_editingMember) return;
  if (_editingMember.discord_id === FOUNDER_ID) {
    showToast('Impossible de modifier le Fondateur.', 'error'); return;
  }
  if (!confirm(`Retirer le rôle de ${_editingMember.username} ?`)) return;
  try {
    await removeRoleFromMember(_editingMember.discord_id);
    showToast('Rôle retiré.', 'success');
    closeMemberModal();
    _members = await getGuildMembers();
    renderMembers(_members);
  } catch (err) {
    showToast(err.message || 'Erreur.', 'error');
  }
}
