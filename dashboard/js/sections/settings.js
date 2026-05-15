import { BOT_URL, GUILD_ID } from '../config.js';
import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';

export async function initSettings() {
  document.getElementById('settings-bot-url').value  = BOT_URL;
  document.getElementById('settings-guild-id').value = GUILD_ID;
  const configs = await loadConfigs();
  document.getElementById('settings-language').value = getConfig(configs, 'settings_language') || 'fr';
  document.getElementById('settings-prefix').value   = getConfig(configs, 'settings_prefix')   || '!';
  document.getElementById('save-settings').addEventListener('click', async () => {
    await saveConfig('settings_language', document.getElementById('settings-language').value);
    await saveConfig('settings_prefix',   document.getElementById('settings-prefix').value);
    alert('✅ Paramètres sauvegardés');
  });
}