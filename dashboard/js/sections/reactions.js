import { callBotAPI, fetchSupabase } from '../api.js';
import { showToast }                 from '../ui/toast.js';
import { GUILD_ID }                  from '../config.js';

let menus     = [];
let editingId = null;
let roleRows  = [];
let channels  = [];
let roles     = [];

// ── INIT ──────────────────────────────────────────────────────────────────────

export async function initReactions() {

  const [channelsData, rolesData] = await Promise.all([
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  channels = (channelsData?.channels || []).filter(c => c.type === 'text');
  roles    = rolesData?.roles || [];

  const chOpts = `<option value="">Choisir un salon...</option>` +
    channels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('rx-channel').innerHTML = chOpts;

  // Aperçu live
  document.getElementById('rx-message').addEventListener('input', updatePreview);
  document.getElementById('rx-component').addEventListener('change', updatePreview);

  // Boutons
  document.getElementById('btn-new-menu').addEventListener('click', openNewEditor);
  document.getElementById('btn-cancel-menu').addEventListener('click', closeEditor);
  document.getElementById('btn-save-menu').addEventListener('click', saveMenu);
  document.getElementById('btn-delete-menu').addEventListener('click', deleteMenu);
  document.getElementById('btn-add-role-row').addEventListener('click', addRoleRow);
  document.getElementById('btn-send-menu').addEventListener('click', sendMenuToDiscord);

  await loadMenus();
}

// ── CHARGER ───────────────────────────────────────────────────────────────────

async function loadMenus() {
  const data = await fetchSupabase(
    `reaction_menus?guild_id=eq.${GUILD_ID}&order=created_at.asc`
  ) || [];
  menus = data;

  // Charger les rôles pour chaque menu
  for (const m of menus) {
    const rxRoles = await fetchSupabase(
      `reaction_roles?menu_id=eq.${m.id}&order=position.asc`
    ) || [];
    m._roles = rxRoles;
  }

  renderStats();
  renderList();
}

// ── STATS ─────────────────────────────────────────────────────────────────────

function renderStats() {
  const active     = menus.filter(m => m.enabled).length;
  const totalRoles = menus.reduce((acc, m) => acc + (m._roles?.length || 0), 0);
  const sent       = menus.filter(m => m.message_id).length;

  document.getElementById('stat-rx-menus').textContent  = menus.length;
  document.getElementById('stat-rx-active').textContent = active;
  document.getElementById('stat-rx-roles').textContent  = totalRoles;
  document.getElementById('stat-rx-sent').textContent   = sent;
}

// ── LISTE ─────────────────────────────────────────────────────────────────────

function renderList() {
  const el = document.getElementById('menus-list');

  if (!menus.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">
      Aucun menu. Crées-en un !
    </div>`;
    return;
  }

  el.innerHTML = menus.map(m => `
    <div class="campaign-card ${editingId === m.id ? 'active' : ''}" data-id="${m.id}">
      <div class="campaign-card-header">
        <div>
          <div class="campaign-name">${m.name}</div>
          <div class="campaign-meta">
            ${channels.find(c => c.id === m.channel_id)?.name ? '#' + channels.find(c => c.id === m.channel_id).name : '—'}
            · ${typeLabel(m.type)} · ${componentLabel(m.component)}
          </div>
        </div>
        <label class="toggle-switch" style="flex-shrink:0">
          <input type="checkbox" ${m.enabled ? 'checked' : ''} class="toggle-menu" data-id="${m.id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="campaign-card-footer">
        <span style="font-size:0.72rem;color:var(--text-muted)">
          ${m._roles?.length || 0} rôle${(m._roles?.length || 0) > 1 ? 's' : ''}
        </span>
        <span style="font-size:0.72rem;color:${m.message_id ? 'var(--green)' : 'var(--text-muted)'}">
          ${m.message_id ? '✅ Envoyé sur Discord' : '⏳ Non envoyé'}
        </span>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.campaign-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.toggle-menu')) return;
      openEditor(card.dataset.id);
    });
  });

  el.querySelectorAll('.toggle-menu').forEach(chk => {
    chk.addEventListener('change', async () => {
      await fetchSupabase(`reaction_menus?id=eq.${chk.dataset.id}`, 'PATCH', { enabled: chk.checked });
      showToast(chk.checked ? '✅ Menu activé' : '⚠️ Menu désactivé');
      await loadMenus();
    });
  });
}

// ── ÉDITEUR ───────────────────────────────────────────────────────────────────

function openNewEditor() {
  editingId = null;
  roleRows  = [];
  document.getElementById('rx-editor-title').textContent = '✏️ Nouveau menu';
  document.getElementById('rx-name').value               = '';
  document.getElementById('rx-channel').value            = '';
  document.getElementById('rx-type').value               = 'multi';
  document.getElementById('rx-component').value          = 'buttons';
  document.getElementById('rx-message').value            = '';
  document.getElementById('btn-delete-menu').style.display = 'none';
  document.getElementById('btn-send-menu').style.display   = 'none';
  renderRoleRows();
  addRoleRow();
  updatePreview();
  showEditor();
}

function openEditor(id) {
  const m = menus.find(x => x.id === id);
  if (!m) return;

  editingId = id;
  roleRows  = (m._roles || []).map(r => ({ emoji: r.emoji, roleId: r.role_id, roleName: r.role_name }));

  document.getElementById('rx-editor-title').textContent = '✏️ ' + m.name;
  document.getElementById('rx-name').value               = m.name;
  document.getElementById('rx-channel').value            = m.channel_id || '';
  document.getElementById('rx-type').value               = m.type;
  document.getElementById('rx-component').value          = m.component;
  document.getElementById('rx-message').value            = m.message_text;
  document.getElementById('btn-delete-menu').style.display = '';
  document.getElementById('btn-send-menu').style.display   = '';

  renderRoleRows();
  updatePreview();
  showEditor();
  renderList();
}

function showEditor() {
  document.getElementById('menu-editor').style.display      = '';
  document.getElementById('menu-placeholder').style.display = 'none';
}

function closeEditor() {
  editingId = null;
  document.getElementById('menu-editor').style.display      = 'none';
  document.getElementById('menu-placeholder').style.display = '';
  renderList();
}

// ── LIGNES EMOJI→RÔLE ─────────────────────────────────────────────────────────

function addRoleRow() {
  roleRows.push({ emoji: '', roleId: '', roleName: '' });
  renderRoleRows();
}

function renderRoleRows() {
  const el = document.getElementById('rx-roles-list');
  const roleOpts = roles.map(r => `<option value="${r.id}" data-name="${r.name}">${r.name}</option>`).join('');

  el.innerHTML = roleRows.map((row, i) => `
    <div class="rx-role-row" data-index="${i}">
      <input type="text" class="form-input rx-emoji" value="${row.emoji}" placeholder="😀" style="width:60px;text-align:center" maxlength="8">
      <select class="form-select rx-role-select" style="flex:1">
        <option value="">Choisir un rôle...</option>
        ${roles.map(r => `<option value="${r.id}" data-name="${r.name}" ${r.id === row.roleId ? 'selected' : ''}>${r.name}</option>`).join('')}
      </select>
      <button class="btn btn-danger btn-sm rx-remove-row" data-index="${i}" style="padding:0.3rem 0.5rem">🗑</button>
    </div>
  `).join('');

  el.querySelectorAll('.rx-emoji').forEach((input, i) => {
    input.addEventListener('input', () => {
      roleRows[i].emoji = input.value;
      updatePreview();
    });
  });

  el.querySelectorAll('.rx-role-select').forEach((select, i) => {
    select.addEventListener('change', () => {
      const opt = select.options[select.selectedIndex];
      roleRows[i].roleId   = select.value;
      roleRows[i].roleName = opt.dataset.name || '';
      updatePreview();
    });
  });

  el.querySelectorAll('.rx-remove-row').forEach(btn => {
    btn.addEventListener('click', () => {
      roleRows.splice(parseInt(btn.dataset.index), 1);
      renderRoleRows();
      updatePreview();
    });
  });
}

// ── APERÇU ────────────────────────────────────────────────────────────────────

function updatePreview() {
  const msg       = document.getElementById('rx-message').value || 'Votre message apparaîtra ici...';
  const component = document.getElementById('rx-component').value;

  document.getElementById('rx-preview-text').innerHTML = msg.replace(/\n/g, '<br>');

  const btnContainer = document.getElementById('rx-preview-buttons');
  const validRows    = roleRows.filter(r => r.roleId);

  if (component === 'buttons') {
    btnContainer.innerHTML = validRows.map(r => `
      <div style="background:#4e5058;border-radius:4px;padding:0.3rem 0.75rem;font-size:0.8rem;color:#fff;display:inline-flex;align-items:center;gap:0.3rem">
        ${r.emoji} ${r.roleName}
      </div>
    `).join('');
  } else if (component === 'select') {
    btnContainer.innerHTML = validRows.length ? `
      <div style="background:#1e1f22;border:1px solid #3f4147;border-radius:4px;padding:0.4rem 0.75rem;font-size:0.8rem;color:#b9bbbe;min-width:180px">
        ${validRows[0]?.emoji || '🎭'} ${validRows[0]?.roleName || 'Choisir un rôle...'} ▾
      </div>
    ` : '';
  } else {
    btnContainer.innerHTML = validRows.map(r => `
      <span style="font-size:1.2rem" title="${r.roleName}">${r.emoji}</span>
    `).join(' ');
  }
}

// ── SAUVEGARDER ───────────────────────────────────────────────────────────────

async function saveMenu() {
  const name      = document.getElementById('rx-name').value.trim();
  const channelId = document.getElementById('rx-channel').value;
  const type      = document.getElementById('rx-type').value;
  const component = document.getElementById('rx-component').value;
  const message   = document.getElementById('rx-message').value.trim();

  if (!name)      return showToast('❌ Donne un nom au menu', 'error');
  if (!channelId) return showToast('❌ Choisis un salon', 'error');
  if (!message)   return showToast('❌ Écris un message', 'error');

  const validRows = roleRows.filter(r => r.emoji && r.roleId);
  if (!validRows.length) return showToast('❌ Ajoute au moins un rôle', 'error');

  const payload = { guild_id: GUILD_ID, name, channel_id: channelId, type, component, message_text: message };

  let menuId = editingId;

  if (editingId) {
    await fetchSupabase(`reaction_menus?id=eq.${editingId}`, 'PATCH', payload);
    await fetchSupabase(`reaction_roles?menu_id=eq.${editingId}`, 'DELETE');
  } else {
    const created = await fetchSupabase('reaction_menus', 'POST', { ...payload, enabled: true });
    menuId = created?.[0]?.id;
  }

  if (menuId) {
    for (let i = 0; i < validRows.length; i++) {
      await fetchSupabase('reaction_roles', 'POST', {
        menu_id  : menuId,
        emoji    : validRows[i].emoji,
        role_id  : validRows[i].roleId,
        role_name: validRows[i].roleName,
        position : i,
      });
    }
  }

  showToast('✅ Menu sauvegardé');
  closeEditor();
  await loadMenus();
}

// ── SUPPRIMER ─────────────────────────────────────────────────────────────────

async function deleteMenu() {
  if (!editingId) return;
  if (!confirm('Supprimer ce menu ? Le message Discord restera.')) return;
  await fetchSupabase(`reaction_menus?id=eq.${editingId}`, 'DELETE');
  showToast('🗑 Menu supprimé');
  closeEditor();
  await loadMenus();
}

// ── ENVOYER DANS DISCORD ──────────────────────────────────────────────────────

async function sendMenuToDiscord() {
  if (!editingId) return;
  const m = menus.find(x => x.id === editingId);
  if (!m) return;

  const validRows = roleRows.filter(r => r.emoji && r.roleId);
  if (!validRows.length) return showToast('❌ Ajoute au moins un rôle', 'error');

  const result = await callBotAPI('reaction-roles/send', 'POST', {
    menu_id    : m.id,
    channel_id : m.channel_id,
    message    : m.message_text,
    type       : m.type,
    component  : m.component,
    roles      : validRows,
  });

  if (result?.success) {
    showToast('✅ Panel envoyé dans Discord !');
    await loadMenus();
  } else {
    showToast('❌ Erreur envoi', 'error');
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function typeLabel(t) {
  return { multi: '✅ Multi', unique: '🔁 Unique' }[t] || t;
}

function componentLabel(c) {
  return { buttons: '🔘 Boutons', select: '📋 Select', reactions: '😀 Réactions' }[c] || c;
}