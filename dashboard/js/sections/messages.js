import { callBotAPI, fetchSupabase } from '../api.js';
import { showToast }                 from '../ui/toast.js';
import { getActiveGuildId }          from '../services/guildService.js';

let campaigns = [];
let editingId = null;
let channels  = [];

export async function initMessages() {
  const channelsData = await callBotAPI('channels');
  channels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const chOpts = `<option value="">Choisir un salon...</option>` +
    channels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('campaign-channel').innerHTML = chOpts;

  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta  = document.getElementById('campaign-message');
      const pos = ta.selectionStart;
      ta.value = ta.value.slice(0, pos) + btn.dataset.var + ta.value.slice(pos);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos + btn.dataset.var.length;
      updatePreview();
    });
  });

  document.getElementById('campaign-message').addEventListener('input', updatePreview);
  document.getElementById('campaign-frequency').addEventListener('change', () => {
    const freq = document.getElementById('campaign-frequency').value;
    document.getElementById('weekday-group').style.display = freq === 'weekly' ? '' : 'none';
  });

  document.getElementById('btn-new-campaign').addEventListener('click', openNewEditor);
  document.getElementById('btn-cancel-campaign').addEventListener('click', closeEditor);
  document.getElementById('btn-save-campaign').addEventListener('click', saveCampaign);
  document.getElementById('btn-delete-campaign').addEventListener('click', deleteCampaign);

  await loadCampaigns();
}

async function loadCampaigns() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(`recurring_messages?guild_id=eq.${guildId}&order=created_at.asc`) || [];
  campaigns = data;
  renderStats();
  renderList();
}

function renderStats() {
  const active    = campaigns.filter(c => c.enabled).length;
  const sentTotal = campaigns.reduce((acc, c) => acc + (c.send_count || 0), 0);
  document.getElementById('stat-msg-total').textContent  = campaigns.length;
  document.getElementById('stat-msg-active').textContent = active;
  document.getElementById('stat-msg-sent').textContent   = sentTotal;
  const next = campaigns.filter(c => c.enabled).map(c => nextSendTime(c)).sort((a, b) => a - b)[0];
  document.getElementById('stat-msg-next').textContent = next
    ? next.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function renderList() {
  const el = document.getElementById('campaigns-list');
  if (!campaigns.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">Aucune campagne. Crées-en une !</div>`;
    return;
  }
  el.innerHTML = campaigns.map(c => {
    const ch      = channels.find(x => x.id === c.channel_id);
    const nextSend = nextSendTime(c);
    return `
      <div class="campaign-card ${editingId === c.id ? 'active' : ''}" data-id="${c.id}">
        <div class="campaign-card-header">
          <div>
            <div class="campaign-name">${c.name}</div>
            <div class="campaign-meta">${ch ? `#${ch.name}` : '—'} · ${freqLabel(c.frequency)} · ${String(c.send_hour).padStart(2,'0')}:${String(c.send_minute).padStart(2,'0')}</div>
          </div>
          <label class="toggle-switch" style="flex-shrink:0">
            <input type="checkbox" ${c.enabled ? 'checked' : ''} class="toggle-campaign" data-id="${c.id}">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="campaign-card-footer">
          <span style="font-size:0.72rem;color:var(--text-muted)">
            ${c.send_count || 0} envoi${(c.send_count || 0) > 1 ? 's' : ''}
            ${c.last_sent ? '· Dernier : ' + new Date(c.last_sent).toLocaleDateString('fr-FR') : ''}
          </span>
          <span style="font-size:0.72rem;color:var(--green)">
            ⏰ ${nextSend ? nextSend.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.campaign-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.toggle-campaign')) return;
      openEditor(card.dataset.id);
    });
  });
  el.querySelectorAll('.toggle-campaign').forEach(chk => {
    chk.addEventListener('change', async () => {
      await fetchSupabase(`recurring_messages?id=eq.${chk.dataset.id}`, 'PATCH', { enabled: chk.checked });
      showToast(chk.checked ? '✅ Campagne activée' : '⚠️ Campagne désactivée');
      await loadCampaigns();
    });
  });
}

function openNewEditor() {
  editingId = null;
  document.getElementById('editor-title').textContent   = '✏️ Nouvelle campagne';
  document.getElementById('campaign-name').value        = '';
  document.getElementById('campaign-channel').value     = '';
  document.getElementById('campaign-frequency').value   = 'daily';
  document.getElementById('campaign-hour').value        = '9';
  document.getElementById('campaign-minute').value      = '0';
  document.getElementById('campaign-message').value     = '';
  document.getElementById('weekday-group').style.display = 'none';
  document.getElementById('btn-delete-campaign').style.display = 'none';
  updatePreview(); showEditor();
}

function openEditor(id) {
  const c = campaigns.find(x => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('editor-title').textContent   = '✏️ ' + c.name;
  document.getElementById('campaign-name').value        = c.name;
  document.getElementById('campaign-channel').value     = c.channel_id || '';
  document.getElementById('campaign-frequency').value   = c.frequency;
  document.getElementById('campaign-hour').value        = c.send_hour;
  document.getElementById('campaign-minute').value      = c.send_minute;
  document.getElementById('campaign-message').value     = c.message;
  document.getElementById('weekday-group').style.display = c.frequency === 'weekly' ? '' : 'none';
  document.getElementById('btn-delete-campaign').style.display = '';
  updatePreview(); showEditor(); renderList();
}

function showEditor() {
  document.getElementById('campaign-editor').style.display      = '';
  document.getElementById('campaign-placeholder').style.display = 'none';
}

function closeEditor() {
  editingId = null;
  document.getElementById('campaign-editor').style.display      = 'none';
  document.getElementById('campaign-placeholder').style.display = '';
  renderList();
}

async function saveCampaign() {
  const guildId = await getActiveGuildId();
  const name    = document.getElementById('campaign-name').value.trim();
  const channel = document.getElementById('campaign-channel').value;
  const freq    = document.getElementById('campaign-frequency').value;
  const hour    = parseInt(document.getElementById('campaign-hour').value)   || 9;
  const minute  = parseInt(document.getElementById('campaign-minute').value) || 0;
  const message = document.getElementById('campaign-message').value.trim();
  if (!name)    return showToast('❌ Donne un nom à la campagne', 'error');
  if (!channel) return showToast('❌ Choisis un salon', 'error');
  if (!message) return showToast('❌ Écris un message', 'error');
  const payload = { guild_id: guildId, name, channel_id: channel, frequency: freq, send_hour: hour, send_minute: minute, message };
  if (editingId) {
    await fetchSupabase(`recurring_messages?id=eq.${editingId}`, 'PATCH', payload);
    showToast('✅ Campagne mise à jour');
  } else {
    await fetchSupabase('recurring_messages', 'POST', { ...payload, enabled: true, send_count: 0 });
    showToast('✅ Campagne créée');
  }
  closeEditor();
  await loadCampaigns();
}

async function deleteCampaign() {
  if (!editingId) return;
  if (!confirm('Supprimer cette campagne ?')) return;
  await fetchSupabase(`recurring_messages?id=eq.${editingId}`, 'DELETE');
  showToast('🗑 Campagne supprimée');
  closeEditor();
  await loadCampaigns();
}

function updatePreview() {
  const msg = document.getElementById('campaign-message').value
    .replace(/{server}/g,      'WARSTACK-TEST')
    .replace(/{membercount}/g, '42')
    .replace(/{date}/g,        new Date().toLocaleDateString('fr-FR'))
    .replace(/{time}/g,        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    || 'Votre message apparaîtra ici...';
  document.getElementById('preview-text').innerHTML = msg.replace(/\n/g, '<br>');
}

function freqLabel(f) {
  return { hourly:'Toutes les heures', every3h:'Toutes les 3h', every6h:'Toutes les 6h', every12h:'Toutes les 12h', daily:'Tous les jours', every2d:'Tous les 2 jours', every3d:'Tous les 3 jours', weekly:'Toutes les semaines', every2w:'Toutes les 2 semaines', monthly:'Tous les mois' }[f] || f;
}

function nextSendTime(c) {
  const now  = new Date();
  const next = new Date();
  next.setHours(c.send_hour, c.send_minute, 0, 0);
  const freqMs = { hourly:3600000, every3h:10800000, every6h:21600000, every12h:43200000, daily:86400000, every2d:172800000, every3d:259200000, weekly:604800000, every2w:1209600000, monthly:2592000000 };
  if (next <= now) next.setTime(next.getTime() + (freqMs[c.frequency] || 86400000));
  return next;
}