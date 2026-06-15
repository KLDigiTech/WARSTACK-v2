import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';

let selectedMember  = null;
let currentFilter   = 'all';
let currentSanction = null;

export async function initModeration() {

  const [configs, channelsData, rolesData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  // ── Salons & rôles ───────────────────────────────────────
  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('mod-logs-channel').innerHTML      = chOpts;
  document.getElementById('mod-sanctions-channel').innerHTML = chOpts;

  const roles = rolesData?.roles || [];
  document.getElementById('mod-role').innerHTML =
    `<option value="">Aucun</option>` +
    roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  // ── Config sauvegardée ───────────────────────────────────
  document.getElementById('mod-logs-channel').value      = getConfig(configs, 'mod_logs_channel')      || '';
  document.getElementById('mod-sanctions-channel').value = getConfig(configs, 'mod_sanctions_channel') || '';
  document.getElementById('mod-role').value              = getConfig(configs, 'mod_role')              || '';

  // ── Save config ──────────────────────────────────────────
  document.getElementById('btn-save-modconfig').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('mod_logs_channel',      document.getElementById('mod-logs-channel').value),
      saveConfig('mod_sanctions_channel', document.getElementById('mod-sanctions-channel').value),
      saveConfig('mod_role',              document.getElementById('mod-role').value),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  // ── Recherche membre ─────────────────────────────────────
  let searchTimer;
  document.getElementById('mod-search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) {
      document.getElementById('mod-search-results').style.display = 'none';
      return;
    }
    searchTimer = setTimeout(() => searchMember(q), 400);
  });

  // ── Actions rapides ──────────────────────────────────────
  document.querySelectorAll('.mod-action-btn').forEach(btn => {
    btn.addEventListener('click', () => openSanctionForm(btn.dataset.type));
  });

  document.getElementById('sanction-cancel').addEventListener('click', closeSanctionForm);
  document.getElementById('sanction-confirm').addEventListener('click', confirmSanction);

  // ── Notes ────────────────────────────────────────────────
  document.getElementById('btn-add-note').addEventListener('click', addNote);
  document.getElementById('mod-note-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addNote();
  });

  // ── Filtres sanctions ────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadSanctions();
    });
  });

  await loadSanctions();
  await loadStats();
}

// ── Recherche membre ─────────────────────────────────────────────────────────

async function searchMember(query) {
  const result = await callBotAPI(`member/search?q=${encodeURIComponent(query)}`);
  const members = result?.members || [];
  const el = document.getElementById('mod-search-results');

  if (!members.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:0.5rem">Aucun membre trouvé.</div>`;
    el.style.display = 'block';
    return;
  }

  el.style.display = 'block';
  el.innerHTML = members.slice(0, 5).map(m => `
    <div class="mod-search-result" data-id="${m.id}" data-name="${m.username}" data-avatar="${m.avatar || ''}">
      <img src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="mod-result-avatar" alt="">
      <span>${m.username}</span>
    </div>
  `).join('');

  el.querySelectorAll('.mod-search-result').forEach(row => {
    row.addEventListener('click', () => {
      selectMember({
        id      : row.dataset.id,
        username: row.dataset.name,
        avatar  : row.dataset.avatar,
      });
      el.style.display = 'none';
      document.getElementById('mod-search').value = '';
    });
  });
}

async function selectMember(member) {
  selectedMember = member;
  document.getElementById('mod-member-card').style.display = 'block';
  document.getElementById('mod-member-name').textContent   = member.username;
  document.getElementById('mod-member-id').textContent     = member.id;
  document.getElementById('mod-member-avatar').src         =
    member.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';

  await loadMemberSanctions(member.id);
  await loadMemberNotes(member.id);
  closeSanctionForm();
}

// ── Formulaire sanction ──────────────────────────────────────────────────────

function openSanctionForm(type) {
  if (!selectedMember) return showToast('❌ Sélectionne un membre d\'abord', 'error');
  currentSanction = type;

  const durationGroup = document.getElementById('sanction-duration-group');
  durationGroup.style.display = ['mute', 'timeout', 'ban'].includes(type) ? 'block' : 'none';

  document.getElementById('sanction-form').style.display = 'block';
  document.getElementById('sanction-reason').focus();
}

function closeSanctionForm() {
  document.getElementById('sanction-form').style.display = 'none';
  document.getElementById('sanction-reason').value = '';
  currentSanction = null;
}

async function confirmSanction() {
  if (!selectedMember || !currentSanction) return;

  const reason   = document.getElementById('sanction-reason').value.trim() || 'Aucune raison';
  const duration = parseInt(document.getElementById('sanction-duration').value) || 0;

  const result = await callBotAPI('moderation/sanction', 'POST', {
    discord_id: selectedMember.id,
    username  : selectedMember.username,
    type      : currentSanction,
    reason,
    duration,
  });

  if (result?.success) {
    showToast(`✅ ${currentSanction.toUpperCase()} appliqué à ${selectedMember.username}`);
    closeSanctionForm();
    await loadMemberSanctions(selectedMember.id);
    await loadSanctions();
    await loadStats();
  } else {
    showToast(`❌ Erreur : ${result?.error || 'inconnu'}`, 'error');
  }
}

// ── Sanctions membre ─────────────────────────────────────────────────────────

async function loadMemberSanctions(discord_id) {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(
    `sanctions?guild_id=eq.${guildId}&discord_id=eq.${discord_id}&order=created_at.desc`
  ) || [];

  document.getElementById('mc-warns').textContent  = data.filter(s => s.type === 'warn').length;
  document.getElementById('mc-mutes').textContent  = data.filter(s => s.type === 'mute').length;
  document.getElementById('mc-kicks').textContent  = data.filter(s => s.type === 'kick').length;
  document.getElementById('mc-bans').textContent   = data.filter(s => s.type === 'ban').length;

  const el = document.getElementById('mod-member-history');
  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem">Aucune sanction.</div>`;
    return;
  }

  const icons = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨', timeout: '⏰', unban: '✅' };
  el.innerHTML = data.map(s => `
    <div class="mod-timeline-item">
      <div class="mod-timeline-icon">${icons[s.type] || '❓'}</div>
      <div class="mod-timeline-content">
        <div class="mod-timeline-type">${s.type.toUpperCase()} ${s.active ? '' : '<span class="mod-inactive">levé</span>'}</div>
        <div class="mod-timeline-reason">${s.reason || '—'}</div>
        <div class="mod-timeline-meta">par ${s.moderator_name || '?'} · ${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
      </div>
      ${s.active && ['mute','ban'].includes(s.type) ? `
        <button class="btn btn-sm btn-secondary" onclick="window.liftSanction('${s.id}')">Lever</button>
      ` : ''}
    </div>
  `).join('');

  window.liftSanction = async (id) => {
    await fetchSupabase(`sanctions?id=eq.${id}`, 'PATCH', { active: false });
    await callBotAPI('moderation/lift', 'POST', { sanction_id: id, discord_id: selectedMember.id });
    showToast('✅ Sanction levée');
    await loadMemberSanctions(selectedMember.id);
    await loadSanctions();
    await loadStats();
  };
}

// ── Notes staff ──────────────────────────────────────────────────────────────

async function loadMemberNotes(discord_id) {
  const data = await fetchSupabase(
    `mod_notes?discord_id=eq.${discord_id}&order=created_at.desc`
  ) || [];

  const el = document.getElementById('mod-notes-list');
  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem">Aucune note.</div>`;
    return;
  }

  el.innerHTML = data.map(n => `
    <div class="mod-note">
      <div class="mod-note-text">${n.note}</div>
      <div class="mod-note-meta">${n.author || '?'} · ${new Date(n.created_at).toLocaleDateString('fr-FR')}</div>
    </div>
  `).join('');
}

async function addNote() {
  if (!selectedMember) return;
  const note = document.getElementById('mod-note-input').value.trim();
  if (!note) return;

  await fetchSupabase('mod_notes', 'POST', {
    discord_id: selectedMember.id,
    note,
    author    : 'Admin',
  });

  document.getElementById('mod-note-input').value = '';
  showToast('✅ Note ajoutée');
  await loadMemberNotes(selectedMember.id);
}

// ── Liste globale sanctions ──────────────────────────────────────────────────

async function loadSanctions() {
  const el = document.getElementById('sanctions-list');
  el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Chargement...</div>`;

  const guildId = await getActiveGuildId();
  let url = `sanctions?guild_id=eq.${guildId}&select=*&order=created_at.desc`;
  if (currentFilter !== 'all') url += `&type=eq.${currentFilter}`;

  const data = await fetchSupabase(url) || [];

  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune sanction.</div>`;
    return;
  }

  const icons = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨', timeout: '⏰', unban: '✅' };
  el.innerHTML = data.map(s => `
    <div class="sanction-card">
      <div class="sanction-header">
        <div class="sanction-user">
          <span class="sanction-icon">${icons[s.type] || '❓'}</span>
          <div>
            <div class="sanction-username">${s.username}</div>
            <div class="sanction-type-badge type-${s.type}">${s.type.toUpperCase()}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="sanction-date">${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
          <div class="sanction-mod">par ${s.moderator_name || '?'}</div>
        </div>
      </div>
      <div class="sanction-reason">${s.reason || '—'}</div>
      ${!s.active ? '<div class="sanction-lifted">✅ Levée</div>' : ''}
    </div>
  `).join('');
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`sanctions?guild_id=eq.${guildId}&select=type,active`) || [];
  document.getElementById('stat-warns').textContent = data.filter(s => s.type === 'warn').length;
  document.getElementById('stat-mutes').textContent = data.filter(s => s.type === 'mute' && s.active).length;
  document.getElementById('stat-kicks').textContent = data.filter(s => s.type === 'kick').length;
  document.getElementById('stat-bans').textContent  = data.filter(s => s.type === 'ban'  && s.active).length;
}