import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';

const TICKET_TYPES = [
  { id: 'support',      emoji: '🔧', label: 'Support Technique', color: '#5865f2' },
  { id: 'bug',          emoji: '🐛', label: 'Signaler un Bug',    color: '#ff4444' },
  { id: 'appeal',       emoji: '⚖️', label: 'Appel de Sanction',  color: '#ffbd2e' },
  { id: 'partnership',  emoji: '🤝', label: 'Partenariat',        color: '#00ff66' },
  { id: 'application',  emoji: '📝', label: 'Candidature Staff',  color: '#ff6b35' },
  { id: 'other',        emoji: '❓', label: 'Autre',              color: '#7fa38a' },
];

let currentTicket  = null;
let currentFilter  = 'all';
let allMembers     = [];

export async function initTickets() {

  const [configs, channelsData, rolesData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const categories   = (channelsData?.channels || []).filter(c => c.type === 'category');
  const roles        = rolesData?.roles || [];

  // ── Dropdowns ────────────────────────────────────────────
  const chOpts  = `<option value="">Aucun</option>` + textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const catOpts = `<option value="">Aucune</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('ticket-create-channel').innerHTML = chOpts;
  document.getElementById('ticket-logs-channel').innerHTML   = chOpts;
  document.getElementById('ticket-category').innerHTML       = catOpts;
  document.getElementById('ticket-staff-role').innerHTML     =
    `<option value="">Aucun</option>` + roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  // Assignation modal
  const membersData = await callBotAPI('channels'); // on utilisera les roles pour assigner
  document.getElementById('ticket-assign-select').innerHTML =
    `<option value="">Non assigné</option>` + roles.map(r => `<option value="${r.name}">${r.name}</option>`).join('');

  // ── Config sauvegardée ───────────────────────────────────
  document.getElementById('ticket-create-channel').value = getConfig(configs, 'ticket_create_channel') || '';
  document.getElementById('ticket-category').value       = getConfig(configs, 'ticket_category')       || '';
  document.getElementById('ticket-logs-channel').value   = getConfig(configs, 'ticket_logs_channel')   || '';
  document.getElementById('ticket-staff-role').value     = getConfig(configs, 'ticket_staff_role')     || '';
  document.getElementById('ticket-transcript').checked   = getConfig(configs, 'ticket_transcript') !== 'false';

  // ── Types de tickets ─────────────────────────────────────
  renderTicketTypes();

  // ── Sauvegarder ──────────────────────────────────────────
  document.getElementById('btn-save-tickets').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('ticket_create_channel', document.getElementById('ticket-create-channel').value),
      saveConfig('ticket_category',       document.getElementById('ticket-category').value),
      saveConfig('ticket_logs_channel',   document.getElementById('ticket-logs-channel').value),
      saveConfig('ticket_staff_role',     document.getElementById('ticket-staff-role').value),
      saveConfig('ticket_transcript',     String(document.getElementById('ticket-transcript').checked)),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  // ── Envoyer panel ─────────────────────────────────────────
  document.getElementById('btn-send-panel').addEventListener('click', async () => {
    const channelId = document.getElementById('ticket-create-channel').value;
    if (!channelId) return showToast('❌ Choisis un salon d\'abord', 'error');
    const result = await callBotAPI('ticket/panel', 'POST', { channel_id: channelId });
    if (result?.success) showToast('✅ Panel de tickets envoyé !');
    else showToast('❌ Erreur', 'error');
  });

  // ── Filtres ──────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadTickets();
    });
  });

  // ── Modal ────────────────────────────────────────────────
  document.getElementById('modal-ticket-close').addEventListener('click', closeTicketModal);

  document.getElementById('btn-close-ticket').addEventListener('click', async () => {
    if (!currentTicket) return;
    if (!confirm('Fermer ce ticket ?')) return;

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

// ── Types de tickets ─────────────────────────────────────────────────────────

function renderTicketTypes() {
  const el = document.getElementById('ticket-types-list');
  el.innerHTML = TICKET_TYPES.map(t => `
    <div class="ticket-type-row">
      <span class="ticket-type-emoji">${t.emoji}</span>
      <span class="ticket-type-label">${t.label}</span>
      <label class="toggle-switch" style="flex-shrink:0">
        <input type="checkbox" checked data-type="${t.id}">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

// ── Charger tickets ──────────────────────────────────────────────────────────

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

  const typeMap = Object.fromEntries(TICKET_TYPES.map(t => [t.id, t]));
  const priorityColors = { low: '#00ff66', normal: '#ffbd2e', high: '#ff6b35', critical: '#ff4444' };

  el.innerHTML = data.map(t => {
    const type = typeMap[t.type] || { emoji: '🎫', label: t.type };
    return `
      <div class="ticket-card" data-id="${t.id}">
        <div class="ticket-card-header">
          <div class="ticket-card-info">
            <span class="ticket-emoji">${type.emoji}</span>
            <div>
              <div class="ticket-username">${t.username}</div>
              <div class="ticket-type-name">${type.label}</div>
            </div>
          </div>
          <div style="text-align:right">
            <span class="ticket-status-badge status-${t.status}">${statusLabel(t.status)}</span>
            ${t.priority ? `<div class="ticket-priority" style="color:${priorityColors[t.priority] || '#fff'}">${priorityLabel(t.priority)}</div>` : ''}
          </div>
        </div>
        <div class="ticket-card-meta">
          <span>📅 ${new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
          ${t.assigned_to ? `<span>👤 ${t.assigned_to}</span>` : '<span style="color:var(--text-muted)">Non assigné</span>'}
          ${t.reason ? `<span style="color:var(--text-muted);font-size:0.75rem">${t.reason.slice(0, 40)}...</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => openTicket(card.dataset.id, data));
  });
}

// ── Ouvrir ticket ────────────────────────────────────────────────────────────

async function openTicket(id, list) {
  currentTicket = list.find(t => t.id === id);
  if (!currentTicket) return;

  const type = TICKET_TYPES.find(t => t.id === currentTicket.type) || { emoji: '🎫', label: currentTicket.type };

  document.getElementById('modal-ticket-title').textContent = `${type.emoji} Ticket — ${currentTicket.username}`;
  document.getElementById('modal-ticket').style.display = 'flex';

  document.getElementById('ticket-assign-select').value = currentTicket.assigned_to || '';

  // Priorité active
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === currentTicket.priority);
  });

  // Meta
  document.getElementById('ticket-detail-meta').innerHTML = `
    <div class="ticket-meta-grid">
      <div><span class="meta-label">Type</span><span>${type.emoji} ${type.label}</span></div>
      <div><span class="meta-label">Statut</span><span>${statusLabel(currentTicket.status)}</span></div>
      <div><span class="meta-label">Ouvert le</span><span>${new Date(currentTicket.created_at).toLocaleString('fr-FR')}</span></div>
      ${currentTicket.reason ? `<div><span class="meta-label">Raison</span><span>${currentTicket.reason}</span></div>` : ''}
    </div>
  `;

  // Notes
  await loadTicketNotes(currentTicket.id);
}

function closeTicketModal() {
  document.getElementById('modal-ticket').style.display = 'none';
  currentTicket = null;
}

// ── Notes ticket ─────────────────────────────────────────────────────────────

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

// ── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  const data = await fetchSupabase('tickets?select=status,created_at,closed_at') || [];

  const open   = data.filter(t => t.status === 'open').length;
  const closed = data.filter(t => t.status === 'closed');

  let avgTime = '—';
  if (closed.length) {
    const times = closed
      .filter(t => t.closed_at)
      .map(t => new Date(t.closed_at) - new Date(t.created_at));
    if (times.length) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const mins = Math.round(avg / 60000);
      avgTime = mins < 60 ? `${mins}min` : `${Math.round(mins/60)}h`;
    }
  }

  document.getElementById('stat-tickets-total').textContent  = data.length;
  document.getElementById('stat-tickets-open').textContent   = open;
  document.getElementById('stat-tickets-closed').textContent = closed.length;
  document.getElementById('stat-tickets-time').textContent   = avgTime;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s) {
  return { open: '🟢 Ouvert', in_progress: '🔵 En cours', closed: '✅ Fermé' }[s] || s;
}

function priorityLabel(p) {
  return { low: '🟢 Faible', normal: '🟡 Normale', high: '🟠 Haute', critical: '🔴 Critique' }[p] || p;
}