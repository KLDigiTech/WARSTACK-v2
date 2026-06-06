import { callBotAPI, fetchSupabase } from '../api.js';
import { showToast }                 from '../ui/toast.js';

let currentEvent  = null;
let currentFilter = 'all';
let contactTarget = 'present';

export async function initEvents() {

  const channelsData  = await callBotAPI('channels');
  const textChannels  = (channelsData?.channels || []).filter(c => c.type === 'text');
  const voiceChannels = (channelsData?.channels || []).filter(c => c.type === 'voice');

  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const vcOpts = `<option value="">Aucun</option>` +
    voiceChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('event-channel').innerHTML = chOpts;
  document.getElementById('event-voice').innerHTML   = vcOpts;

  // ── Preview live ─────────────────────────────────────────
  ['event-title', 'event-description', 'event-date', 'event-time', 'event-max'].forEach(id => {
    document.getElementById(id).addEventListener('input', updatePreview);
  });
  updatePreview();
  updateClock();
  setInterval(updateClock, 1000);

  // ── Toggle form ─────────────────────────────────────────
  document.getElementById('btn-toggle-form').addEventListener('click', () => {
    const form = document.getElementById('event-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  // ── Aperçu local ─────────────────────────────────────────
  document.getElementById('btn-preview-event').addEventListener('click', () => {
    updatePreview();
    document.getElementById('event-preview-panel').style.display = 'block';
    document.getElementById('event-preview-panel').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-close-preview').addEventListener('click', () => {
    document.getElementById('event-preview-panel').style.display = 'none';
  });

  // ── Bouton TEST Discord ──────────────────────────────────
  document.getElementById('btn-test-event').addEventListener('click', async () => {
    const channelId = document.getElementById('event-channel').value;
    if (!channelId) return showToast('❌ Choisis un salon annonces d\'abord', 'error');
    const result = await callBotAPI('event/test', 'POST', { channel_id: channelId });
    if (result?.success) showToast('✅ Événement de test envoyé !');
    else showToast('❌ Erreur lors du test', 'error');
  });

  // ── Filtres ─────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadEvents();
    });
  });

  // ── Créer événement ─────────────────────────────────────
  document.getElementById('btn-create-event').addEventListener('click', createEvent);

  // ── Recherche participants ───────────────────────────────
  document.getElementById('participant-search').addEventListener('input', e => {
    filterParticipants(e.target.value);
  });

  // ── Fermer détail ────────────────────────────────────────
  document.getElementById('btn-close-event').addEventListener('click', () => {
    currentEvent = null;
    document.getElementById('event-detail').style.display      = 'none';
    document.getElementById('event-placeholder').style.display = 'block';
  });

  // ── Export CSV ───────────────────────────────────────────
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // ── Contact participants ─────────────────────────────────
  document.getElementById('btn-msg-participants').addEventListener('click', () => {
    contactTarget = 'present';
    document.getElementById('modal-contact-title').textContent = '📢 Message aux présents';
    document.getElementById('modal-contact').style.display = 'flex';
  });

  document.getElementById('btn-msg-maybe').addEventListener('click', () => {
    contactTarget = 'maybe';
    document.getElementById('modal-contact-title').textContent = '❔ Relancer les indécis';
    document.getElementById('modal-contact').style.display = 'flex';
  });

  document.getElementById('modal-contact-close').addEventListener('click',  closeContactModal);
  document.getElementById('modal-contact-cancel').addEventListener('click', closeContactModal);
  document.getElementById('modal-contact-send').addEventListener('click',   sendContactMessage);

  // ── Annuler événement ────────────────────────────────────
  document.getElementById('btn-cancel-event').addEventListener('click', async () => {
    if (!currentEvent) return;
    if (!confirm('Annuler cet événement ? Les participants seront notifiés.')) return;
    await fetchSupabase(`events?id=eq.${currentEvent.id}`, 'PATCH', { status: 'cancelled' });
    await callBotAPI('event/cancel', 'POST', { event_id: currentEvent.id });
    showToast('✅ Événement annulé');
    currentEvent = null;
    document.getElementById('event-detail').style.display      = 'none';
    document.getElementById('event-placeholder').style.display = 'block';
    await loadEvents();
    await loadStats();
  });

  await loadEvents();
  await loadStats();
}

// ── Preview Discord live ─────────────────────────────────────────────────────

function updatePreview() {
  const title = document.getElementById('event-title').value       || 'Nouvel événement';
  const desc  = document.getElementById('event-description').value || 'Description de l\'événement...';
  const date  = document.getElementById('event-date').value;
  const time  = document.getElementById('event-time').value;
  const max   = document.getElementById('event-max').value;

  const el = (id) => document.getElementById(id);
  if (el('ev-dp-title'))  el('ev-dp-title').textContent  = `🎯 ${title}`;
  if (el('ev-dp-desc'))   el('ev-dp-desc').textContent   = desc;
  if (el('ev-dp-date'))   el('ev-dp-date').textContent   = date ? formatDate(date) : '—';
  if (el('ev-dp-heure'))  el('ev-dp-heure').textContent  = time ? time             : '—';
  if (el('ev-dp-max'))    el('ev-dp-max').textContent    = max  ? `${max} places`  : 'Illimitées';
}

function updateClock() {
  const now = new Date();
  const t   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const el  = document.getElementById('ev-dp-time');
  if (el) el.textContent = t;
}

// ── Créer événement ──────────────────────────────────────────────────────────

async function createEvent() {
  const title       = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const date        = document.getElementById('event-date').value;
  const time        = document.getElementById('event-time').value;
  const max         = parseInt(document.getElementById('event-max').value) || null;
  const channelId   = document.getElementById('event-channel').value;
  const voiceId     = document.getElementById('event-voice').value;
  const r24h        = document.getElementById('reminder-24h').checked;
  const r1h         = document.getElementById('reminder-1h').checked;
  const r15min      = document.getElementById('reminder-15min').checked;
  const checkin     = document.getElementById('event-checkin').checked;

  if (!title) return showToast('❌ Nom de l\'événement obligatoire', 'error');
  if (!date)  return showToast('❌ Date obligatoire', 'error');
  if (!time)  return showToast('❌ Heure obligatoire', 'error');

  const { data: event, error } = await fetchSupabase('events', 'POST', {
    title,
    description,
    date,
    time,
    max_players    : max,
    voice_channel  : voiceId || null,
    status         : 'open',
    reminders      : JSON.stringify({ r24h, r1h, r15min }),
    checkin_enabled: checkin,
  }, true);

  if (error) return showToast('❌ Erreur création', 'error');

  if (channelId && event) {
    await callBotAPI('event/announce', 'POST', {
      event_id: event.id,
      channel_id: channelId,
      title, description, date, time, max,
    });
  }

  showToast('✅ Événement créé !');

  ['event-title','event-description','event-date','event-time','event-max'].forEach(id => {
    document.getElementById(id).value = '';
  });

  document.getElementById('event-preview-panel').style.display = 'none';
  updatePreview();

  await loadEvents();
  await loadStats();
}

// ── Charger événements ───────────────────────────────────────────────────────

async function loadEvents() {
  const container = document.getElementById('events-list');
  container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Chargement...</div>`;

  let url = `events?select=*&order=date.desc,time.desc`;
  if (currentFilter !== 'all') url += `&status=eq.${currentFilter}`;

  const list = await fetchSupabase(url) || [];

  if (!list.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun événement.</div>`;
    return;
  }

  container.innerHTML = list.map(e => `
    <div class="event-card ${currentEvent?.id === e.id ? 'active' : ''}" data-id="${e.id}">
      <div class="event-card-header">
        <span class="event-card-title">${e.title}</span>
        <span class="event-status status-${e.status}">${statusLabel(e.status)}</span>
      </div>
      <div class="event-card-meta">
        <span>📅 ${formatDate(e.date)} à ${e.time}</span>
        ${e.max_players ? `<span>👥 ${e.max_players} places</span>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', () => selectEvent(card.dataset.id, list));
  });
}

// ── Sélectionner événement ───────────────────────────────────────────────────

async function selectEvent(id, list) {
  currentEvent = list.find(e => e.id === id);
  if (!currentEvent) return;

  document.getElementById('event-placeholder').style.display = 'none';
  document.getElementById('event-detail').style.display      = 'block';
  document.getElementById('detail-title').textContent        = currentEvent.title;

  await loadParticipants();

  document.querySelectorAll('.event-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
}

// ── Participants ─────────────────────────────────────────────────────────────

let allParticipants = [];

async function loadParticipants() {
  if (!currentEvent) return;

  const data = await fetchSupabase(
    `event_participants?event_id=eq.${currentEvent.id}&order=created_at.asc`
  ) || [];

  allParticipants = data;
  renderParticipants(data);

  const present = data.filter(p => p.status === 'present').length;
  const maybe   = data.filter(p => p.status === 'maybe').length;
  const absent  = data.filter(p => p.status === 'absent').length;
  const reserve = data.filter(p => p.status === 'reserve').length;
  const max     = currentEvent.max_players || 0;

  document.getElementById('ec-present').textContent = present;
  document.getElementById('ec-maybe').textContent   = maybe;
  document.getElementById('ec-absent').textContent  = absent;
  document.getElementById('ec-reserve').textContent = reserve;

  const pct = max ? Math.min(100, Math.round((present / max) * 100)) : 0;
  document.getElementById('event-progress').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent  = max
    ? `${present} / ${max} places`
    : `${present} inscrits`;
}

function renderParticipants(list) {
  const el = document.getElementById('participants-list');
  if (!list.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun participant.</div>`;
    return;
  }

  const statusIcons = { present: '✅', maybe: '❔', absent: '❌', reserve: '🎮' };

  el.innerHTML = list.map(p => `
    <div class="participant-row">
      <div class="participant-info">
        <span class="participant-status">${statusIcons[p.status] || '❓'}</span>
        <span class="participant-name">${p.username}</span>
        ${p.checked_in ? '<span class="checkin-badge">CHECK-IN</span>' : ''}
      </div>
      <div style="display:flex;gap:0.3rem">
        <button class="btn btn-sm sug-btn" onclick="window.checkinParticipant('${p.id}')" title="Check-in">✔️</button>
        <button class="btn btn-danger btn-sm" onclick="window.removeParticipant('${p.id}')" title="Retirer">🗑️</button>
      </div>
    </div>
  `).join('');

  window.checkinParticipant = async (pid) => {
    await fetchSupabase(`event_participants?id=eq.${pid}`, 'PATCH', { checked_in: true });
    showToast('✅ Check-in effectué');
    await loadParticipants();
  };

  window.removeParticipant = async (pid) => {
    if (!confirm('Retirer ce participant ?')) return;
    await fetchSupabase(`event_participants?id=eq.${pid}`, 'DELETE');
    showToast('✅ Participant retiré');
    await loadParticipants();
  };
}

function filterParticipants(query) {
  const filtered = query
    ? allParticipants.filter(p => p.username.toLowerCase().includes(query.toLowerCase()))
    : allParticipants;
  renderParticipants(filtered);
}

// ── Stats globales ───────────────────────────────────────────────────────────

async function loadStats() {
  const events = await fetchSupabase('events?select=status') || [];
  const parts  = await fetchSupabase('event_participants?select=status') || [];

  const present = parts.filter(p => p.status === 'present').length;
  const total   = parts.length;

  document.getElementById('stat-events-total').textContent        = events.length;
  document.getElementById('stat-events-participants').textContent = present;
  document.getElementById('stat-events-open').textContent         = events.filter(e => e.status === 'open').length;
  document.getElementById('stat-events-presence').textContent     = total
    ? `${Math.round((present / total) * 100)}%` : '0%';
}

// ── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV() {
  if (!allParticipants.length) return showToast('❌ Aucun participant', 'error');

  const rows = [
    ['Pseudo', 'Statut', 'Check-in', 'Date inscription'],
    ...allParticipants.map(p => [
      p.username,
      p.status,
      p.checked_in ? 'Oui' : 'Non',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ])
  ];

  const csv  = rows.map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${currentEvent.title}_participants.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Modal contact ────────────────────────────────────────────────────────────

function closeContactModal() {
  document.getElementById('modal-contact').style.display = 'none';
  document.getElementById('contact-message').value = '';
}

async function sendContactMessage() {
  const message = document.getElementById('contact-message').value.trim();
  if (!message) return showToast('❌ Message vide', 'error');
  if (!currentEvent) return;

  const targets = allParticipants
    .filter(p => p.status === contactTarget)
    .map(p => p.discord_id);

  if (!targets.length) return showToast('❌ Aucun participant dans cette catégorie', 'error');

  const result = await callBotAPI('event/contact', 'POST', {
    discord_ids: targets,
    message,
    event_title: currentEvent.title,
  });

  if (result?.success) showToast(`✅ Message envoyé à ${targets.length} membre(s)`);
  else showToast('❌ Erreur envoi', 'error');

  closeContactModal();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status) {
  const map = {
    open     : '🔓 Ouvert',
    closed   : '🔒 Fermé',
    finished : '✅ Terminé',
    cancelled: '❌ Annulé',
  };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}