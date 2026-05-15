import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';

export async function initTickets() {
  const configs = await loadConfigs();
  document.getElementById('tickets-category').value = getConfig(configs, 'tickets_category') || '';
  document.getElementById('tickets-channel').value  = getConfig(configs, 'tickets_channel')  || '';
  document.getElementById('tickets-role').value     = getConfig(configs, 'tickets_role')     || '';
  document.getElementById('tickets-logs').value     = getConfig(configs, 'tickets_logs')     || '';
  document.getElementById('tickets-message').value  = getConfig(configs, 'tickets_message')  || '';
  document.getElementById('save-tickets').addEventListener('click', async () => {
    await saveConfig('tickets_category', document.getElementById('tickets-category').value);
    await saveConfig('tickets_channel',  document.getElementById('tickets-channel').value);
    await saveConfig('tickets_role',     document.getElementById('tickets-role').value);
    await saveConfig('tickets_logs',     document.getElementById('tickets-logs').value);
    await saveConfig('tickets_message',  document.getElementById('tickets-message').value);
    alert('✅ Tickets sauvegardés');
  });
}