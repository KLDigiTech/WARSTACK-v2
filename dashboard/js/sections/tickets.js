import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';

let currentTicket    = null;
let currentFilter    = 'all';
let ticketCategories = [];

const GUILD_ID = '1501685144501620798';

// ── INIT ──────────────────────────────────────────────────────────────────────

export async function initTickets() {

  const [configs, channelsData, rolesData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const categories   = (channelsData?.channels || []).filter(c => c.type === 'category');
  const roles        = rolesData?.roles || [];

  const chOpts   = `<option value="">Aucun</option>`  + textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const catOpts  = `<option value="">Aucune</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const roleOpts = `<option value="">Aucun</option>`  + roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  document.getElementById('ticket-create-channel').innerHTML   = chOpts;
  document.getElementById('ticket-logs-channel').innerHTML     = chOpts;
  document.getElementById('ticket-staff-role').innerHTML       = roleOpts;
  document.getElementById('ticket-leader-role').innerHTML      = roleOpts;
  document.getElementById('ticket-category-waiting').innerHTML = catOpts;
  document.getElementById('ticket-category-active').innerHTML  = catOpts;
  document.getElementById('ticket-category-closed').innerHTML  =
    `<option value="">Aucune (suppression auto)</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('ticket-assign-select').innerHTML =
    `<option value="">Non assigné</option>` + roles.map(r => `<option value="${r.name}">${r.name}</option>`).join('');

  document.getElementById('ticket-create-channel').value   = getConfig(configs, 'ticket_create_channel')   || '';
  document.getElementById('ticket-logs-channel').value     = getConfig(configs, 'ticket_logs_channel')     || '';
  document.getElementById('ticket-staff-role').value       = getConfig(configs, 'ticket_staff_role')       || '';
  document.getElementById('ticket-leader-role').value      = getConfig(configs, 'ticket_leader_role')      || '';
  document.getElementById('ticket-category-waiting').value = getConfig(configs, 'ticket_category_waiting') || '';
  document.getElementById('ticket-category-active').value  = getConfig(configs, 'ticket_category_active')  || '';
  document.getElementById('ticket-category-closed').value  = getConfig(configs, 'ticket_category_closed')  || '';
  document.getElementById('ticket-transcript').checked     = getConfig(configs, 'ticket_transcript') !== 'false';

  await loadTicketCategories();

  document.getElementById('btn-add-ticket-type').addEventListener('click', addTicketCategory);

  document.getElementById('btn-save-tickets').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('ticket_create_channel',   document.getElementById('ticket-create-channel').value),
      saveConfig('ticket_logs_channel',     document.getElementById('ticket-logs-channel').value),
      saveConfig('ticket_staff_role',       document.getElementById('ticket-staff-role').value),
      saveConfig('ticket_leader_role',      document.getElementById('ticket-leader-role').value),
      saveConfig('ticket_category_waiting', document.getElementById('ticket-category-waiting').value),
      saveConfig('ticket_category_active',  document.getElementById('ticket-category-active').value),
      saveConfig('ticket_category_closed',  document.getElementById('ticket-category-closed').value),
      saveConfig('ticket_transcript',       String(document.getElementById('ticket-transcript').checked)),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  document.getElementById('btn-send-panel').addEventListener('click', async () => {
    const channelId = document.getElementById('ticket-create-channel').value;
    if (!channelId) return showToast('❌ Choisis un salon d\'abord', 'error');
    const result = await callBotAPI('ticket/panel', 'POST', { channel_id: channelId });
    if (result?.success) showToast('✅ Panel de tickets envoyé !');
    else showToast('❌ Erreur', 'error');
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadTickets();
    });
  });

  document.getElementById('modal-ticket-close').addEventListener('click', closeTicketModal);

  document.getElementById('btn-close-ticket').addEventListener('click', async () => {
    if (!currentTicket) return;
    if (!confirm('Fermer ce ticket ? Le salon Discord sera supprimé.')) return;

    await fetchSupabase(`tickets?id=eq.${currentTicket.id}`, 'PATCH', {
      status   : 'closed',
      closed_at: new Date().toISOString(),
    });

    await callBotAPI('ticket/close', 'POST', {
      ticket_id : currentTicket.id,
      channel_id: currentTicket.channel_id,
      transcript: document.getElementById('ticket-transcript').checked,
    });

    showToast('✅ Ticket fermé');
    closeTicketModal();
    await loadTickets();
    await loadStats();
  });

  document.getElementById('btn-assign-ticket').addEventListener('click', async () => {
    if (!currentTicket) return;
    const assigned = document.getElementById('ticket-assign-select').value;
    await fetchSupabase(`tickets?id=eq.${currentTicket.id}`, 'PATCH', {
      assigned_to: assigned || null,
      status     : assigned ? 'in_progress' : 'open',
    });
    showToast('✅ Ticket assigné');
    await loadTickets();
  });

  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentTicket) return;
      document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await fetchSupabase(`tickets?id=eq.${currentTicket.id}`, 'PATCH', { priority: btn.dataset.priority });
      showToast('✅ Priorité mise à jour');
    });
  });

  document.getElementById('btn-add-ticket-note').addEventListener('click', addTicketNote);
  document.getElementById('ticket-note-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTicketNote();
  });

  document.getElementById('btn-transcript').addEventListener('click', () => {
    if (!currentTicket) return;
    showToast('📄 Transcription en cours...');
    callBotAPI('ticket/transcript', 'POST', { ticket_id: currentTicket.id, channel_id: currentTicket.channel_id });
  });

  await loadTickets();
  await loadStats();
}

// ── CATÉGORIES CUSTOM ─────────────────────────────────────────────────────────

async function loadTicketCategories() {
  const data = await fetchSupabase(`ticket_categories?guild_id=eq.${GUILD_ID}&order=position.asc`) || [];
  ticketCategories = data;
  renderTicketCategories();
}

function renderTicketCategories() {
  const el = document.getElementById('ticket-types-list');

  if (!ticketCategories.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">Aucun type configuré. Ajoute-en un ci-dessous.</div>`;
    return;
  }

  el.innerHTML = ticketCategories.map(t => `
    <div class="ticket-type-row" data-id="${t.id}">
      <span class="ticket-type-emoji">${t.emoji}</span>
      <span class="ticket-type-label" style="flex:1">${t.label}</span>
      <span style="width:12px;height:12px;border-radius:50%;background:${t.color};display:inline-block;margin-right:0.5rem;flex-shrink:0"></span>
      <label class="toggle-switch" style="flex-shrink:0;margin-right:0.4rem">
        <input type="checkbox" ${t.active ? 'checked' : ''} data-id="${t.id}" class="toggle-category">
        <span class="toggle-slider"></span>
      </label>
      <button class="btn btn-danger btn-sm btn-delete-category" data-id="${t.id}" style="padding:0.2rem 0.5rem;font-size:0.75rem">🗑</button>
    </div>
  `).join('');

  el.querySelectorAll('.toggle-category').forEach(chk => {
    chk.addEventListener('change', async () => {
      await fetchSupabase(`ticket_categories?id=eq.${chk.dataset.id}`, 'PATCH', { active: chk.checked });
      showToast(chk.checked ? '✅ Type activé' : '⚠️ Type désactivé');
      await loadTicketCategories();
    });
  });

  el.querySelectorAll('.btn-delete-category').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce type de ticket ?')) return;
      await fetchSupabase(`ticket_categories?id=eq.${btn.dataset.id}`, 'DELETE');
      showToast('🗑 Type supprimé');
      await loadTicketCategories();
    });
  });
}

async function addTicketCategory() {
  const emoji = document.getElementById('new-ticket-emoji').value.trim() || '🎫';
  const label = document.getElementById('new-ticket-label').value.trim();
  const color = document.getElementById('new-ticket-color').value       || '#5865f2';

  if (!label) return showToast('❌ Donne un nom au type', 'error');

  await fetchSupabase('ticket_categories', 'POST', {
    guild_id: GUILD_ID,
    emoji,
    label,
    color,
    active  : true,
    position: ticketCategories.length,
  });

  document.getElementById('new-ticket-emoji').value = '';
  document.getElementById('new-ticket-label').value = '';
  document.getElementById('new-ticket-color').value = '#5865f2';

  showToast('✅ Type ajouté');
  await loadTicketCategories();
}

// ── TICKETS LIST ──────────────────────────────────────────────────────────────

async function loadTickets() {
  const el = document.getElementById('tickets-list');
  el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Chargement...</div>`;

  let url = `tickets?select=*&order=created_at.desc`;
  if (currentFilter !== 'all') url += `&status=eq.${currentFilter}`;

  const data = await fetchSupabase(url) || [];

  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun ticket.</div>`;
    return;
  }

  const catMap = {};
  ticketCategories.forEach(t => { catMap[t.id] = t; });

  const priorityColors = { low: '#00ff66', normal: '#ffbd2e', high: '#ff6b35', critical: '#ff4444' };

  el.innerHTML = data.map(t => {
    const cat = catMap[t.type] || { emoji: '🎫', label: t.type };
    return `
      <div class="ticket-card" data-id="${t.id}">
        <div class="ticket-card-header">
          <div class="ticket-card-info">
            <span class="ticket-emoji">${cat.emoji}</span>
            <div>
              <div class="ticket-username">${t.username}</div>
              <div class="ticket-type-name">${cat.label}</div>
            </div>
          </div>
          <div style="text-align:right">
            <span class="ticket-status-badge status-${t.status}">${statusLabel(t.status)}</span>
            ${t.priority ? `<div class="ticket-priority" style="color:${priorityColors[t.priority] || '#fff'}">${priorityLabel(t.priority)}</div>` : ''}
          </div>
        </div>
        <div class="ticket-card-meta">
          <span>📅 ${new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
          ${t.assigned_to ? `<span>🎖️ ${t.assigned_to}</span>` : '<span style="color:var(--text-muted)">Non assigné</span>'}
          ${t.taken_by_id ? `<span style="color:var(--green);font-size:0.72rem">✅ Pris en charge</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => openTicket(card.dataset.id, data));
  });
}

// ── MODAL TICKET ──────────────────────────────────────────────────────────────

async function openTicket(id, list) {
  currentTicket = list.find(t => t.id === id);
  if (!currentTicket) return;

  const catMap = {};
  ticketCategories.forEach(t => { catMap[t.id] = t; });
  const cat = catMap[currentTicket.type] || { emoji: '🎫', label: currentTicket.type };

  document.getElementById('modal-ticket-title').textContent = `${cat.emoji} Ticket — ${currentTicket.username}`;
  document.getElementById('modal-ticket').style.display = 'flex';
  document.getElementById('ticket-assign-select').value = currentTicket.assigned_to || '';

  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === currentTicket.priority);
  });

  document.getElementById('ticket-detail-meta').innerHTML = `
    <div class="ticket-meta-grid">
      <div><span class="meta-label">Type</span><span>${cat.emoji} ${cat.label}</span></div>
      <div><span class="meta-label">Statut</span><span>${statusLabel(currentTicket.status)}</span></div>
      <div><span class="meta-label">Ouvert le</span><span>${new Date(currentTicket.created_at).toLocaleString('fr-FR')}</span></div>
      ${currentTicket.assigned_to ? `<div><span class="meta-label">Assigné à</span><span>🎖️ ${currentTicket.assigned_to}</span></div>` : ''}
      ${currentTicket.taken_at    ? `<div><span class="meta-label">Pris en charge le</span><span>${new Date(currentTicket.taken_at).toLocaleString('fr-FR')}</span></div>` : ''}
      ${currentTicket.closed_at   ? `<div><span class="meta-label">Fermé le</span><span>${new Date(currentTicket.closed_at).toLocaleString('fr-FR')}</span></div>` : ''}
    </div>
  `;

  const btnClose = document.getElementById('btn-close-ticket');
  btnClose.disabled     = currentTicket.status === 'closed';
  btnClose.style.opacity = currentTicket.status === 'closed' ? '0.4' : '';

  await loadTicketNotes(currentTicket.id);
}

function closeTicketModal() {
  document.getElementById('modal-ticket').style.display = 'none';
  currentTicket = null;
}

// ── NOTES ─────────────────────────────────────────────────────────────────────

async function loadTicketNotes(ticketId) {
  const data = await fetchSupabase(`mod_notes?discord_id=eq.ticket_${ticketId}&order=created_at.desc`) || [];
  const el   = document.getElementById('ticket-notes-list');

  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem">Aucune note.</div>`;
    return;
  }

  el.innerHTML = data.map(n => `
    <div class="mod-note">
      <div class="mod-note-text">${n.note}</div>
      <div class="mod-note-meta">${n.author} · ${new Date(n.created_at).toLocaleDateString('fr-FR')}</div>
    </div>
  `).join('');
}

async function addTicketNote() {
  if (!currentTicket) return;
  const note = document.getElementById('ticket-note-input').value.trim();
  if (!note) return;

  await fetchSupabase('mod_notes', 'POST', {
    discord_id: `ticket_${currentTicket.id}`,
    note,
    author    : 'Staff',
  });

  document.getElementById('ticket-note-input').value = '';
  showToast('✅ Note ajoutée');
  await loadTicketNotes(currentTicket.id);
}

// ── STATS ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  const data = await fetchSupabase('tickets?select=status,created_at,closed_at') || [];

  const open       = data.filter(t => t.status === 'open').length;
  const inProgress = data.filter(t => t.status === 'in_progress').length;
  const closed     = data.filter(t => t.status === 'closed');

  let avgTime = '—';
  if (closed.length) {
    const times = closed
      .filter(t => t.closed_at)
      .map(t => new Date(t.closed_at) - new Date(t.created_at));
    if (times.length) {
      const avg  = times.reduce((a, b) => a + b, 0) / times.length;
      const mins = Math.round(avg / 60000);
      avgTime = mins < 60 ? `${mins}min` : `${Math.round(mins / 60)}h`;
    }
  }

  document.getElementById('stat-tickets-total').textContent      = data.length;
  document.getElementById('stat-tickets-open').textContent       = open;
  document.getElementById('stat-tickets-inprogress').textContent = inProgress;
  document.getElementById('stat-tickets-closed').textContent     = closed.length;
  document.getElementById('stat-tickets-time').textContent       = avgTime;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function statusLabel(s) {
  return { open: '🟢 Ouvert', in_progress: '🔵 En cours', closed: '✅ Fermé' }[s] || s;
}

function priorityLabel(p) {
  return { low: '🟢 Faible', normal: '🟡 Normale', high: '🟠 Haute', critical: '🔴 Critique' }[p] || p;
}