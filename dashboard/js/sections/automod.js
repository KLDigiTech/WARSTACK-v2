import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';
import { callBotAPI, fetchSupabase }           from '../api.js';
import { showToast }                           from '../ui/toast.js';
import { getActiveGuildId }                    from '../services/guildService.js';

export async function initAutomod() {

  const [configs, channelsData, rolesData] = await Promise.all([
    loadConfigs(),
    callBotAPI('channels'),
    callBotAPI('roles'),
  ]);

  const textChannels = (channelsData?.channels || []).filter(c => c.type === 'text');
  const roles        = rolesData?.roles || [];

  // ── Exceptions salons ────────────────────────────────────
  const exceptChannels = document.getElementById('except-channels');
  exceptChannels.innerHTML = textChannels.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');

  // ── Exceptions rôles ─────────────────────────────────────
  const exceptRoles = document.getElementById('except-roles');
  exceptRoles.innerHTML = roles.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join('');

  // ── Salon logs automod ───────────────────────────────────
  document.getElementById('automod-logs-channel').innerHTML =
    `<option value="">Aucun</option>` +
    textChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // ── Charger config ───────────────────────────────────────
  document.getElementById('spam-enabled').checked     = getConfig(configs, 'automod_spam_enabled')     === 'true';
  document.getElementById('spam-max').value           = getConfig(configs, 'automod_spam_max')          || '5';
  document.getElementById('spam-period').value        = getConfig(configs, 'automod_spam_period')       || '10';
  document.getElementById('spam-action-1').value      = getConfig(configs, 'automod_spam_action1')      || 'warn';
  document.getElementById('spam-action-2').value      = getConfig(configs, 'automod_spam_action2')      || 'timeout';
  document.getElementById('spam-action-3').value      = getConfig(configs, 'automod_spam_action3')      || 'kick';

  document.getElementById('raid-enabled').checked     = getConfig(configs, 'automod_raid_enabled')     === 'true';
  document.getElementById('raid-age').value           = getConfig(configs, 'automod_raid_age')          || '7';
  document.getElementById('raid-no-avatar').checked   = getConfig(configs, 'automod_raid_no_avatar')   === 'true';
  document.getElementById('raid-action').value        = getConfig(configs, 'automod_raid_action')       || 'kick';

  document.getElementById('links-enabled').checked    = getConfig(configs, 'automod_links_enabled')    === 'true';
  document.getElementById('links-action').value       = getConfig(configs, 'automod_links_action')      || 'delete';
  document.getElementById('links-whitelist').value    = getConfig(configs, 'automod_links_whitelist')   || '';

  document.getElementById('mentions-enabled').checked = getConfig(configs, 'automod_mentions_enabled') === 'true';
  document.getElementById('mentions-max').value       = getConfig(configs, 'automod_mentions_max')      || '5';
  document.getElementById('mentions-action').value    = getConfig(configs, 'automod_mentions_action')   || 'delete';

  document.getElementById('caps-enabled').checked     = getConfig(configs, 'automod_caps_enabled')     === 'true';
  document.getElementById('caps-percent').value       = getConfig(configs, 'automod_caps_percent')      || '70';
  document.getElementById('caps-min-length').value    = getConfig(configs, 'automod_caps_min_length')   || '10';
  document.getElementById('caps-action').value        = getConfig(configs, 'automod_caps_action')       || 'delete';

  document.getElementById('words-enabled').checked    = getConfig(configs, 'automod_words_enabled')    === 'true';
  document.getElementById('words-list').value         = getConfig(configs, 'automod_words_list')        || '';
  document.getElementById('words-action').value       = getConfig(configs, 'automod_words_action')      || 'delete';

  document.getElementById('automod-logs-channel').value = getConfig(configs, 'automod_logs_channel') || '';

  // Exceptions sauvegardées
  const savedExceptChannels = JSON.parse(getConfig(configs, 'automod_except_channels') || '[]');
  const savedExceptRoles    = JSON.parse(getConfig(configs, 'automod_except_roles')    || '[]');
  Array.from(exceptChannels.options).forEach(o => { if (savedExceptChannels.includes(o.value)) o.selected = true; });
  Array.from(exceptRoles.options).forEach(o   => { if (savedExceptRoles.includes(o.value))    o.selected = true; });

  // ── Accordéon ────────────────────────────────────────────
  // Ouvre automatiquement les protections déjà activées
  document.querySelectorAll('.amd-item').forEach(item => {
    const key     = item.dataset.amd;
    const toggle  = item.querySelector('input[type="checkbox"][id$="-enabled"]');
    const isOnByDefault = ['exceptions', 'journal'].includes(key);
    if ((toggle && toggle.checked) || isOnByDefault) item.classList.add('open');

    item.querySelector('.amd-head').addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });

  // ── Score protection ─────────────────────────────────────
  updateScore();
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateScore);
  });

  // ── Sauvegarder ──────────────────────────────────────────
  document.getElementById('btn-save-automod').addEventListener('click', async () => {
    const exceptCh = Array.from(document.getElementById('except-channels').selectedOptions).map(o => o.value);
    const exceptRl = Array.from(document.getElementById('except-roles').selectedOptions).map(o => o.value);

    await Promise.all([
      saveConfig('automod_spam_enabled',     String(document.getElementById('spam-enabled').checked)),
      saveConfig('automod_spam_max',         document.getElementById('spam-max').value),
      saveConfig('automod_spam_period',      document.getElementById('spam-period').value),
      saveConfig('automod_spam_action1',     document.getElementById('spam-action-1').value),
      saveConfig('automod_spam_action2',     document.getElementById('spam-action-2').value),
      saveConfig('automod_spam_action3',     document.getElementById('spam-action-3').value),

      saveConfig('automod_raid_enabled',     String(document.getElementById('raid-enabled').checked)),
      saveConfig('automod_raid_age',         document.getElementById('raid-age').value),
      saveConfig('automod_raid_no_avatar',   String(document.getElementById('raid-no-avatar').checked)),
      saveConfig('automod_raid_action',      document.getElementById('raid-action').value),

      saveConfig('automod_links_enabled',    String(document.getElementById('links-enabled').checked)),
      saveConfig('automod_links_action',     document.getElementById('links-action').value),
      saveConfig('automod_links_whitelist',  document.getElementById('links-whitelist').value),

      saveConfig('automod_mentions_enabled', String(document.getElementById('mentions-enabled').checked)),
      saveConfig('automod_mentions_max',     document.getElementById('mentions-max').value),
      saveConfig('automod_mentions_action',  document.getElementById('mentions-action').value),

      saveConfig('automod_caps_enabled',     String(document.getElementById('caps-enabled').checked)),
      saveConfig('automod_caps_percent',     document.getElementById('caps-percent').value),
      saveConfig('automod_caps_min_length',  document.getElementById('caps-min-length').value),
      saveConfig('automod_caps_action',      document.getElementById('caps-action').value),

      saveConfig('automod_words_enabled',    String(document.getElementById('words-enabled').checked)),
      saveConfig('automod_words_list',       document.getElementById('words-list').value),
      saveConfig('automod_words_action',     document.getElementById('words-action').value),

      saveConfig('automod_logs_channel',     document.getElementById('automod-logs-channel').value),
      saveConfig('automod_except_channels',  JSON.stringify(exceptCh)),
      saveConfig('automod_except_roles',     JSON.stringify(exceptRl)),
    ]);

    showToast('✅ Configuration AutoMod sauvegardée !');
    updateScore();
  });

  // ── Journal violations ───────────────────────────────────
  document.getElementById('btn-refresh-violations').addEventListener('click', loadViolations);
  await loadViolations();
}

// ── Score protection ─────────────────────────────────────────────────────────

function updateScore() {
  const checks = [
    { id: 'spam-enabled',     label: 'Anti Spam',     points: 25 },
    { id: 'raid-enabled',     label: 'Anti Raid',     points: 25 },
    { id: 'links-enabled',    label: 'Anti Liens',    points: 20 },
    { id: 'mentions-enabled', label: 'Anti Mentions', points: 15 },
    { id: 'caps-enabled',     label: 'Anti Caps',     points: 10 },
    { id: 'words-enabled',    label: 'Mots interdits',points: 5  },
  ];

  let score = 0;
  const indicators = checks.map(c => {
    const enabled = document.getElementById(c.id)?.checked;
    if (enabled) score += c.points;
    return `<div class="protection-indicator ${enabled ? 'active' : ''}">
      ${enabled ? '✅' : '⚠️'} ${c.label}
    </div>`;
  });

  document.getElementById('protection-score').textContent = score;
  document.getElementById('protection-indicators').innerHTML = indicators.join('');

  const scoreEl = document.getElementById('protection-score');
  scoreEl.style.color = score >= 80 ? 'var(--green)' : score >= 50 ? '#ffbd2e' : 'var(--red)';
}

// ── Journal violations ────────────────────────────────────────────────────────

async function loadViolations() {
  const guildId = await getActiveGuildId();
  const data = await fetchSupabase(
    `sanctions?guild_id=eq.${guildId}&select=*&order=created_at.desc&limit=10&moderator_id=eq.automod`
  ) || [];

  const el = document.getElementById('violations-list');

  if (!data.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune violation récente.</div>`;
    return;
  }

  const icons = { warn: '⚠️', delete: '🗑️', timeout: '⏰', kick: '👢', ban: '🔨' };
  el.innerHTML = data.map(v => `
    <div class="violation-row">
      <div class="violation-icon">${icons[v.type] || '🤖'}</div>
      <div class="violation-content">
        <div class="violation-user">${v.username}</div>
        <div class="violation-reason">${v.reason || '—'}</div>
      </div>
      <div class="violation-time">${new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `).join('');
}