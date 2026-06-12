import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';

const PAGE_SIZE = 25;
let currentFilter = 'all';
let currentPage   = 0;
let currentSearch = '';
let searchTimeout = null;
let allLogs       = [];

export async function initLogs() {
  const [configs, channelsData] = await Promise.all([loadConfigs(), callBotAPI('channels')]);
  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  ['message', 'moderation', 'member', 'ticket', 'suggestion'].forEach(type => {
    const el = document.getElementById(`log-channel-${type}`);
    if (el) { el.innerHTML = chOpts; el.value = getConfig(configs, `log_channel_${type}`) || ''; }
  });

  document.getElementById('btn-save-logs').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('log_channel_message',    document.getElementById('log-channel-message').value),
      saveConfig('log_channel_moderation', document.getElementById('log-channel-moderation').value),
      saveConfig('log_channel_member',     document.getElementById('log-channel-member').value),
      saveConfig('log_channel_ticket',     document.getElementById('log-channel-ticket').value),
      saveConfig('log_channel_suggestion', document.getElementById('log-channel-suggestion').value),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      currentPage   = 0;
      renderLogs();
    });
  });

  document.getElementById('log-search').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.toLowerCase().trim();
      currentPage   = 0;
      renderLogs();
    }, 300);
  });

  document.getElementById('btn-logs-prev').addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderLogs(); }
  });
  document.getElementById('btn-logs-next').addEventListener('click', () => { currentPage++; renderLogs(); });
  document.getElementById('modal-log-close').addEventListener('click', () => {
    document.getElementById('modal-log').style.display = 'none';
  });

  await loadLogs();
}

async function loadLogs() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`audit_logs?guild_id=eq.${guildId}&order=created_at.desc&limit=500`) || [];
  allLogs = data;
  await loadStats(data);
  renderLogs();
}

async function loadStats(data) {
  document.getElementById('stat-logs-total').textContent      = data.length;
  document.getElementById('stat-logs-message').textContent    = data.filter(l => l.type === 'message').length;
  document.getElementById('stat-logs-moderation').textContent = data.filter(l => l.type === 'moderation').length;
  document.getElementById('stat-logs-member').textContent     = data.filter(l => l.type === 'member').length;
  document.getElementById('stat-logs-ticket').textContent     = data.filter(l => l.type === 'ticket').length;
}

function renderLogs() {
  let filtered = allLogs;
  if (currentFilter !== 'all') filtered = filtered.filter(l => l.type === currentFilter);
  if (currentSearch) {
    filtered = filtered.filter(l =>
      (l.author_name || '').toLowerCase().includes(currentSearch) ||
      (l.action || '').toLowerCase().includes(currentSearch) ||
      (l.channel_name || '').toLowerCase().includes(currentSearch) ||
      (l.content || '').toLowerCase().includes(currentSearch)
    );
  }
  const total      = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  const page = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  document.getElementById('logs-page-info').textContent = `Page ${currentPage + 1} / ${totalPages}`;
  document.getElementById('btn-logs-prev').disabled = currentPage === 0;
  document.getElementById('btn-logs-next').disabled = currentPage >= totalPages - 1;
  const container = document.getElementById('logs-table-container');
  if (!page.length) { container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun log trouvé.</div>`; return; }
  container.innerHTML = `
    <table class="logs-table">
      <thead><tr><th>Heure</th><th>Type</th><th>Action</th><th>Auteur</th><th>Salon</th><th></th></tr></thead>
      <tbody>
        ${page.map(l => `
          <tr class="log-row" data-id="${l.id}">
            <td class="log-time">${formatTime(l.created_at)}</td>
            <td><span class="log-type-badge log-type-${l.type}">${typeLabel(l.type)}</span></td>
            <td class="log-action">${actionLabel(l.action)}</td>
            <td class="log-author">${l.author_name || '—'}</td>
            <td class="log-channel">${l.channel_name ? `#${l.channel_name}` : '—'}</td>
            <td><button class="btn btn-secondary btn-sm btn-log-detail" data-id="${l.id}" style="padding:0.15rem 0.5rem;font-size:0.7rem">👁</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.querySelectorAll('.btn-log-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const log = allLogs.find(l => l.id === btn.dataset.id);
      if (log) openLogDetail(log);
    });
  });
}

function openLogDetail(log) {
  document.getElementById('modal-log-title').textContent = actionLabel(log.action);
  document.getElementById('modal-log').style.display     = 'flex';
  const extra = log.extra || {};
  document.getElementById('modal-log-body').innerHTML = `
    <div class="ticket-meta-grid" style="margin-bottom:0.75rem">
      <div><span class="meta-label">Type</span><span>${typeLabel(log.type)}</span></div>
      <div><span class="meta-label">Action</span><span>${actionLabel(log.action)}</span></div>
      <div><span class="meta-label">Auteur</span><span>${log.author_name || '—'}</span></div>
      <div><span class="meta-label">Date</span><span>${new Date(log.created_at).toLocaleString('fr-FR')}</span></div>
      ${log.channel_name ? `<div><span class="meta-label">Salon</span><span>#${log.channel_name}</span></div>` : ''}
      ${log.target_name  ? `<div><span class="meta-label">Cible</span><span>${log.target_name}</span></div>` : ''}
    </div>
    ${log.content ? `<div class="welcome-section-title">Contenu</div><div style="background:var(--surface-3);border:1px solid var(--border);border-radius:var(--radius);padding:0.6rem 0.75rem;font-size:0.82rem;color:var(--text-dim);margin-bottom:0.5rem;word-break:break-word">${log.content}</div>` : ''}
    ${extra.new_content ? `<div class="welcome-section-title">Nouveau contenu</div><div style="background:var(--surface-3);border:1px solid var(--border);border-radius:var(--radius);padding:0.6rem 0.75rem;font-size:0.82rem;color:var(--green);margin-bottom:0.5rem;word-break:break-word">${extra.new_content}</div>` : ''}
    ${extra.roles?.length ? `<div class="welcome-section-title">Rôles</div><div style="font-size:0.82rem;color:var(--text-dim)">${extra.roles.join(', ')}</div>` : ''}
  `;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' ' + d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
}

function typeLabel(t) {
  return { message:'📨 Message', moderation:'🛡 Modération', member:'👥 Membre', ticket:'🎫 Ticket', suggestion:'💡 Suggestion' }[t] || t;
}

function actionLabel(a) {
  return { message_delete:'🗑 Message supprimé', message_edit:'✏️ Message modifié', member_join:'➕ Membre rejoint', member_leave:'➖ Membre parti', automod_kick:'🤖 AutoMod Kick', automod_ban:'🤖 AutoMod Ban', automod_timeout:'🤖 AutoMod Timeout', ticket_open:'🎫 Ticket ouvert', ticket_close:'🔒 Ticket fermé', suggestion_post:'💡 Suggestion postée', ban:'🔨 Ban', kick:'👢 Kick', warn:'⚠️ Warn', mute:'🔇 Mute' }[a] || a;
}