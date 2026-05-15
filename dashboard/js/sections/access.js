import {
  getDashboardRoles,
  getRolePermissions,
  saveRolePermissions,
  createDashboardRole,
  updateDashboardRole,
  deleteDashboardRole
} from '../services/accessService.js';

import { showModal } from '../ui/modal.js';

const ALL_PERMISSIONS = [
  'overview', 'players', 'tournament',
  'welcome', 'roles', 'birthdays', 'suggestions',
  'moderation', 'automod', 'tickets', 'logs',
  'messages', 'reactions', 'channels',
  'access', 'settings'
];

export async function initAccess() {
  const roles = await getDashboardRoles();

  document.getElementById('access-root').innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>🔐 Accès Dashboard</h2>
      </div>
      <div class="panel-body">
        <div class="access-topbar">
          <button class="access-create-btn" id="create-role-btn">
            <i class="fas fa-plus"></i> Nouveau rôle
          </button>
        </div>
        <div class="access-roles-grid">
          ${roles.map(role => `
            <div class="access-role-card" data-role-id="${role.id}">
              <div class="access-role-header">
                <div class="access-role-name" style="color:${role.color || '#ffffff'}">${role.name}</div>
                <div class="access-role-badge">${role.is_system ? 'SYSTEM' : 'CUSTOM'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('create-role-btn')?.addEventListener('click', () => {
    showModal({
      title: 'Créer un rôle',
      body: `
        <div class="create-role-modal">
          <label class="modal-label">Nom du rôle</label>
          <input type="text" id="new-role-name" class="modal-input" placeholder="Ex: Staff">
          <button class="access-save-btn" id="confirm-create-role">Créer le rôle</button>
        </div>
      `
    });
    setTimeout(() => {
      document.getElementById('confirm-create-role')?.addEventListener('click', async () => {
        const roleName = document.getElementById('new-role-name').value.trim();
        if (!roleName) return;
        await createDashboardRole(roleName);
        window.location.reload();
      });
    }, 50);
  });

  initRoleEvents(roles);
}

function initRoleEvents(roles) {
  document.querySelectorAll('.access-role-card').forEach(card => {
    card.addEventListener('click', async () => {
      const roleId             = card.dataset.roleId;
      const role               = roles.find(r => r.id == roleId);
      const permissions        = await getRolePermissions(roleId);
      const currentPermissions = permissions.map(p => p.module_key);

      showModal({
        title: 'Permissions du rôle',
        body: `
          <div class="edit-role-section">
            <label class="modal-label">Nom du rôle</label>
            <input type="text" id="edit-role-name" class="modal-input" value="${role.name || ''}">
            <label class="modal-label">Couleur</label>
            <div class="role-color-picker">
              ${['#5865F2','#57F287','#ED4245','#FAA61A','#EB459E','#00D1FF','#9B59B6','#FEE75C','#FFFFFF','#95A5A6','#111111','#FFD700'].map(c => `
                <div class="role-color ${role.color === c ? 'active' : ''}" data-color="${c}" style="background:${c}${c === '#FFFFFF' || c === '#111111' ? ';border:2px solid #333' : ''}"></div>
              `).join('')}
            </div>
          </div>
          <div class="permissions-grid">
            ${ALL_PERMISSIONS.map(p => `
              <label class="permission-toggle">
                <span>${p}</span>
                <input type="checkbox" ${currentPermissions.includes(p) ? 'checked' : ''}>
              </label>
            `).join('')}
          </div>
          <div class="access-role-actions">
            <button class="access-delete-btn" id="delete-role-btn">Supprimer le rôle</button>
            <button class="access-save-btn"   id="save-permissions-btn">Sauvegarder</button>
          </div>
        `
      });

      setTimeout(() => {
        let selectedColor = role.color || '#5865F2';

        document.querySelectorAll('.role-color').forEach(c => {
          c.addEventListener('click', () => {
            document.querySelectorAll('.role-color').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            selectedColor = c.dataset.color;
          });
        });

        document.getElementById('delete-role-btn')?.addEventListener('click', async () => {
          if (!confirm('Supprimer ce rôle ?')) return;
          await deleteDashboardRole(roleId);
          window.location.reload();
        });

        document.getElementById('save-permissions-btn')?.addEventListener('click', async () => {
          const roleName = document.getElementById('edit-role-name').value.trim();
          await updateDashboardRole(roleId, { name: roleName, color: selectedColor });
          const selected = [];
          document.querySelectorAll('.permission-toggle input').forEach(input => {
            if (input.checked) selected.push(input.closest('.permission-toggle').querySelector('span').textContent.trim());
          });
          await saveRolePermissions(roleId, selected);
          window.location.reload();
        });
      }, 50);
    });
  });
}