import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';

export async function initWelcome() {
  const configs = await loadConfigs();
  document.getElementById('welcome-channel').value = getConfig(configs, 'welcome_channel') || '';
  document.getElementById('leave-channel').value   = getConfig(configs, 'leave_channel')   || '';
  document.getElementById('welcome-message').value = getConfig(configs, 'welcome_message') || '';
  document.getElementById('leave-message').value   = getConfig(configs, 'leave_message')   || '';
  document.getElementById('save-welcome').addEventListener('click', async () => {
    await saveConfig('welcome_channel', document.getElementById('welcome-channel').value);
    await saveConfig('leave_channel',   document.getElementById('leave-channel').value);
    await saveConfig('welcome_message', document.getElementById('welcome-message').value);
    await saveConfig('leave_message',   document.getElementById('leave-message').value);
    alert('✅ Config sauvegardée');
  });
}