import { showModal, closeModal } from '../ui/modal.js';
import { callBotAPI }             from '../api.js';
import { showToast }              from '../ui/toast.js';

const CREATE_VALUE = '__create_new_role__';

// Ajoute une option "➕ Créer un nouveau rôle..." en haut d'un <select> de rôles.
// Quand elle est choisie, ouvre un petit formulaire, crée le rôle sur Discord via l'API,
// l'ajoute aux options du select, le sélectionne, et déclenche un vrai événement 'change'
// pour que la logique existante (ex: ajout à une liste) s'applique normalement.
// onCreated(role) est appelé en plus, utile pour mettre à jour un cache local de rôles.
export function enableRoleCreation(selectEl, onCreated) {
  if (!selectEl) return;

  if (!selectEl.querySelector(`option[value="${CREATE_VALUE}"]`)) {
    const opt = document.createElement('option');
    opt.value = CREATE_VALUE;
    opt.textContent = '➕ Créer un nouveau rôle...';
    selectEl.insertBefore(opt, selectEl.firstChild);
  }

  if (selectEl.dataset.roleCreationEnabled) return;
  selectEl.dataset.roleCreationEnabled = '1';

  selectEl.addEventListener('change', () => {
    if (selectEl.value !== CREATE_VALUE) return;
    selectEl.value = '';
    openCreateRoleModal(selectEl, onCreated);
  });
}

function openCreateRoleModal(selectEl, onCreated) {
  showModal({
    title: '➕ Créer un rôle Discord',
    body: `
      <div class="form-group">
        <label>Nom du rôle</label>
        <input type="text" id="new-role-name" class="form-input" placeholder="ex: Elite, Team X..." maxlength="80">
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input type="color" id="new-role-color" class="form-input" value="#00ff66" style="height:40px;padding:2px">
      </div>
      <button class="btn btn-primary" id="btn-confirm-new-role" style="width:100%">
        <i class="fas fa-check"></i> Créer sur Discord
      </button>
    `,
  });

  const nameEl  = document.getElementById('new-role-name');
  const colorEl = document.getElementById('new-role-color');
  const btn     = document.getElementById('btn-confirm-new-role');

  nameEl?.focus();

  btn.addEventListener('click', async () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';

    const result = await callBotAPI('role/create', 'POST', {
      name,
      color: colorEl.value,
    }).catch(() => null);

    if (!result?.success) {
      showToast('❌ Impossible de créer le rôle', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Créer sur Discord';
      return;
    }

    const role = { id: result.id, name: result.name, color: result.color };

    const opt = document.createElement('option');
    opt.value = role.id;
    opt.textContent = role.name;
    opt.style.color = role.color;
    selectEl.appendChild(opt);
    selectEl.value = role.id;

    closeModal();
    showToast(`✅ Rôle @${role.name} créé sur Discord`);

    if (onCreated) onCreated(role);
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  });
}