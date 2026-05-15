import { loadConfigs, saveConfig, getConfig } from '../services/configService.js';

function bindToggle(id) {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById(id).classList.toggle('on');
  });
}

function setToggle(id, value) {
  if (value === true) document.getElementById(id)?.classList.add('on');
}

export async function initAutomod() {
  const configs = await loadConfigs();
  setToggle('toggle-antispam', getConfig(configs, 'automod_antispam'));
  setToggle('toggle-links',    getConfig(configs, 'automod_links'));
  setToggle('toggle-caps',     getConfig(configs, 'automod_caps'));
  document.getElementById('banned-words').value = getConfig(configs, 'automod_words') || '';
  bindToggle('toggle-antispam');
  bindToggle('toggle-links');
  bindToggle('toggle-caps');
  document.getElementById('save-automod').addEventListener('click', async () => {
    await saveConfig('automod_antispam', document.getElementById('toggle-antispam').classList.contains('on'));
    await saveConfig('automod_links',    document.getElementById('toggle-links').classList.contains('on'));
    await saveConfig('automod_caps',     document.getElementById('toggle-caps').classList.contains('on'));
    await saveConfig('automod_words',    document.getElementById('banned-words').value);
    alert('✅ AutoMod sauvegardé');
  });
}