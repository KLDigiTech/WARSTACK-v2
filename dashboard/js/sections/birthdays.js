import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI }                          from '../api.js';
import { fetchSupabase, deleteSupabase }       from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';

export async function initBirthdays() {

  const [configs, channelsData, rolesData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  // ── Salons texte ────────────────────────────────────────
  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  document.getElementById('birthday-channel').innerHTML =
    `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // ── Rôles ───────────────────────────────────────────────
  const roles = rolesData?.roles || [];
  document.getElementById('birthday-role').innerHTML =
    `<option value="">Aucun</option>` +
    roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  // ── Heures ──────────────────────────────────────────────
  document.getElementById('birthday-hour').innerHTML =
    Array.from({ length: 24 }, (_, i) =>
      `<option value="${i}">${String(i).padStart(2, '0')}:00</option>`
    ).join('');

  // ── Config sauvegardée ──────────────────────────────────
  document.getElementById('birthday-enabled').checked   = getConfig(configs, 'birthday_enabled') === 'true';
  document.getElementById('birthday-channel').value     = getConfig(configs, 'birthday_channel') || '';
  document.getElementById('birthday-hour').value        = getConfig(configs, 'birthday_hour')    || '9';
  document.getElementById('birthday-tz').value          = getConfig(configs, 'birthday_tz')      || 'Europe/Paris';
  document.getElementById('birthday-role').value        = getConfig(configs, 'birthday_role')    || '';
  document.getElementById('birthday-message').value     = getConfig(configs, 'birthday_message') || '';

  // ── Variables cliquables ────────────────────────────────
  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById(btn.dataset.target);
      if (!textarea) return;
      const pos = textarea.selectionStart ?? textarea.value.length;
      const ins = btn.dataset.var;
      textarea.value = textarea.value.slice(0, pos) + ins + textarea.value.slice(pos);
      textarea.focus();
      textarea.setSelectionRange(pos + ins.length, pos + ins.length);
      updatePreview();
    });
  });

  // ── Preview live ────────────────────────────────────────
  document.getElementById('birthday-message').addEventListener('input', updatePreview);
  updatePreview();
  updateClock();
  setInterval(updateClock, 1000);

  // ── Sauvegarder ─────────────────────────────────────────
  document.getElementById('btn-save-birthday').addEventListener('click', async () => {
    await Promise.all([
      saveConfig('birthday_enabled', String(document.getElementById('birthday-enabled').checked)),
      saveConfig('birthday_channel', document.getElementById('birthday-channel').value),
      saveConfig('birthday_hour',    document.getElementById('birthday-hour').value),
      saveConfig('birthday_tz',      document.getElementById('birthday-tz').value),
      saveConfig('birthday_role',    document.getElementById('birthday-role').value),
      saveConfig('birthday_message', document.getElementById('birthday-message').value),
    ]);
    showToast('✅ Configuration sauvegardée !');
  });

  // ── Tester ──────────────────────────────────────────────
  document.getElementById('btn-test-birthday').addEventListener('click', async () => {
    const channel_id = document.getElementById('birthday-channel').value;
    const message    = document.getElementById('birthday-message').value;
    if (!channel_id) return showToast('❌ Choisis un salon d\'abord', 'error');
    const result = await callBotAPI('birthday/test', 'POST', { channel_id, message });
    if (result?.success) showToast('✅ Message de test envoyé !');
    else showToast('❌ Erreur lors du test', 'error');
  });

  // ── Charger les anniversaires ───────────────────────────
  await loadBirthdays();
}

// ── Preview ─────────────────────────────────────────────────────────────────

function updatePreview() {
  const msg = document.getElementById('birthday-message').value
    || '🎂 Joyeux anniversaire {mention} ! 🎉';
  const filled = msg
    .replace(/{mention}/g, '<span class="dp-mention">@Kevin</span>')
    .replace(/{user}/g,    'Kevin')
    .replace(/{age}/g,     '26')
    .replace(/{server}/g,  'WARSTACK');
  document.getElementById('dp-birthday-text').innerHTML = filled;
}

function updateClock() {
  const now = new Date();
  const t   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const el  = document.getElementById('dp-bday-time');
  if (el) el.textContent = t;
}

// ── Liste anniversaires ──────────────────────────────────────────────────────

async function loadBirthdays() {
  const guildId = await getActiveGuildId();
  const [data, xpRows] = await Promise.all([
    fetchSupabase('birthdays?select=*&order=month.asc,day.asc'),
    fetchSupabase(`warstack_xp?guild_id=eq.${guildId}&select=discord_id`),
  ]);

  // 'birthdays' est une table globale (identité Discord) — on ne garde que
  // les membres rattachés à CE serveur (présents dans warstack_xp).
  const memberIds = new Set((xpRows || []).map(x => x.discord_id));
  const list = (data || []).filter(b => memberIds.has(b.discord_id));

  document.getElementById('birthday-count').textContent = `${list.length} membre${list.length > 1 ? 's' : ''}`;

  // Prochains anniversaires
  const upcoming  = getUpcoming(list);
  const upcomingEl = document.getElementById('upcoming-birthdays');
  if (!upcoming.length) {
    upcomingEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun anniversaire enregistré.</div>`;
  } else {
    upcomingEl.innerHTML = upcoming.slice(0, 5).map(b => `
      <div class="birthday-row">
        <div class="birthday-info">
          <span class="birthday-name">${b.username}</span>
          <span class="birthday-date">${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}</span>
        </div>
        <span class="birthday-days ${b.days === 0 ? 'today' : ''}">
          ${b.days === 0 ? '🎂 Aujourd\'hui !' : `dans ${b.days} jour${b.days > 1 ? 's' : ''}`}
        </span>
      </div>
    `).join('');
  }

  // Liste complète
  const listEl = document.getElementById('birthday-list');
  if (!list.length) {
    listEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun anniversaire enregistré.</div>`;
  } else {
    listEl.innerHTML = list.map(b => `
      <div class="birthday-row">
        <div class="birthday-info">
          <span class="birthday-name">${b.username}</span>
          <span class="birthday-date">${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}${b.year ? `/${b.year}` : ''}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.deleteBirthday('${b.discord_id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
  }

  window.deleteBirthday = async (discord_id) => {
    if (!confirm('Supprimer cet anniversaire ?')) return;
    await deleteSupabase(`birthdays?discord_id=eq.${discord_id}`);
    showToast('✅ Supprimé');
    await loadBirthdays();
  };
}

function getUpcoming(list) {
  const now   = new Date();
  const today = { month: now.getMonth() + 1, day: now.getDate() };

  return list.map(b => {
    let days;
    const bMonth = b.month;
    const bDay   = b.day;

    const thisYear = new Date(now.getFullYear(), bMonth - 1, bDay);
    if (thisYear < now && !(bMonth === today.month && bDay === today.day)) {
      thisYear.setFullYear(now.getFullYear() + 1);
    }
    days = Math.round((thisYear - now) / (1000 * 60 * 60 * 24));
    if (days < 0) days = 0;

    return { ...b, days };
  }).sort((a, b) => a.days - b.days);
}