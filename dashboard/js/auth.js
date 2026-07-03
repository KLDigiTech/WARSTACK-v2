// dashboard/js/auth.js — FICHIER COMPLET

import { supabase } from './supabaseClient.js';
import { BOT_URL, API_KEY } from './config.js';
import { switchActiveGuild } from './services/guildService.js';

const STORAGE_KEY = 'warstack_guild_id';
const PREF_KEY    = 'warstack_active_guild';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '/login.html'; }

const user       = session.user;
const userName   = user.user_metadata.full_name || user.user_metadata.name || 'Utilisateur';
const userAvatar = user.user_metadata.avatar_url || '';
const discordId  = user.user_metadata.provider_id || user.user_metadata.sub;

document.getElementById('user-name').textContent      = userName;
document.getElementById('user-avatar').src            = userAvatar;
document.getElementById('dropdown-name').textContent  = userName;
document.getElementById('dropdown-avatar').src        = userAvatar;
const mobileAvatar = document.getElementById('mobile-user-avatar');
if (mobileAvatar) mobileAvatar.src = userAvatar;

if (userAvatar) {
  await supabase.from('players').update({ avatar_url: userAvatar }).eq('discord_id', discordId);
}

const urlParams  = new URLSearchParams(window.location.search);
const guildParam = urlParams.get('guild');
const preferred  = localStorage.getItem(PREF_KEY);

let guildId   = null;
let guildData = null;
let myGuilds  = [];

try {
  const { data: ownerGuilds } = await supabase
    .from('guilds')
    .select('guild_id, name, icon')
    .eq('owner_id', discordId)
    .eq('setup_complete', true)
    .order('joined_at', { ascending: true });

  if (ownerGuilds && ownerGuilds.length) {
    myGuilds = ownerGuilds;

    const wanted = [guildParam, preferred].find(
      id => id && myGuilds.some(g => g.guild_id === id)
    );

    guildData = wanted ? myGuilds.find(g => g.guild_id === wanted) : myGuilds[0];
    guildId   = guildData.guild_id;

    window.WARSTACK_IS_MEMBER = false;

  } else {
    const targetGuild = guildParam || preferred;
    if (!targetGuild) { window.location.href = '/login.html'; throw new Error(); }

    const botRes = await fetch(`${BOT_URL}/api/member/${discordId}?guild_id=${targetGuild}`, {
      headers: { 'x-api-key': API_KEY },
    });
    const botData = await botRes.json();

    if (!botData.isMember) { window.location.href = '/login.html'; throw new Error(); }

    const { data: guildRow } = await supabase
      .from('guilds')
      .select('guild_id, name, icon')
      .eq('guild_id', targetGuild)
      .eq('setup_complete', true)
      .single();

    if (!guildRow) { window.location.href = '/login.html'; throw new Error(); }

    guildId   = guildRow.guild_id;
    guildData = guildRow;
    myGuilds  = [guildRow];

    window.WARSTACK_IS_MEMBER = true;
  }

} catch (err) {
  console.error('Auth error:', err);
}

if (!guildId) { window.location.href = '/login.html'; }

sessionStorage.setItem(STORAGE_KEY, guildId);
localStorage.setItem(PREF_KEY, guildId);

window.WARSTACK_GUILD_ID   = guildId;
window.WARSTACK_DISCORD_ID = discordId;

document.getElementById('server-title').textContent = guildData?.name || '';
document.getElementById('server-logo').src          = guildData?.icon || userAvatar;
if (document.getElementById('server-name'))
  document.getElementById('server-name').textContent = guildData?.name || '';

if (guildId) {
  document.querySelectorAll('a[href^="/inscription.html"]').forEach(a => {
    a.href = `/inscription.html?guild=${guildId}`;
  });
  document.querySelectorAll('a[href^="/portail.html"]').forEach(a => {
    a.href = `/portail.html?guild=${guildId}`;
  });
}

if (guildParam) {
  urlParams.delete('guild');
  const newUrl = window.location.pathname
    + (urlParams.toString() ? `?${urlParams.toString()}` : '')
    + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

const guildSwitcher    = document.getElementById('guild-switcher');
const switcherChevron  = document.getElementById('guild-switcher-chevron');
const switcherDropdown = document.getElementById('guild-switcher-dropdown');

if (guildSwitcher && switcherDropdown && myGuilds.length > 1) {
  guildSwitcher.classList.add('has-switcher');
  if (switcherChevron) switcherChevron.style.display = 'inline-block';

  switcherDropdown.innerHTML = myGuilds.map(g => `
    <button class="guild-switcher-item ${g.guild_id === guildId ? 'active' : ''}" data-guild="${g.guild_id}">
      <img src="${g.icon || ''}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" alt="">
      <span>${g.name}</span>
      ${g.guild_id === guildId ? '<i class="fas fa-check"></i>' : ''}
    </button>
  `).join('');

  guildSwitcher.addEventListener('click', (e) => {
    e.stopPropagation();
    switcherDropdown.classList.toggle('open');
    guildSwitcher.classList.toggle('switcher-open');
  });

  document.addEventListener('click', () => {
    switcherDropdown.classList.remove('open');
    guildSwitcher.classList.remove('switcher-open');
  });

  switcherDropdown.addEventListener('click', (e) => e.stopPropagation());

  switcherDropdown.querySelectorAll('.guild-switcher-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.guild;
      if (target !== guildId) switchActiveGuild(target);
    });
  });
}

const userMenu     = document.getElementById('user-menu');
const userDropdown = document.getElementById('user-dropdown');

userMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  userDropdown.classList.toggle('open');
  userMenu.classList.toggle('user-menu-open');
});

document.addEventListener('click', () => {
  userDropdown?.classList.remove('open');
  userMenu?.classList.remove('user-menu-open');
});

userDropdown?.addEventListener('click', (e) => e.stopPropagation());

document.querySelector('[data-action="mon-profil"]')?.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  window.location.hash = 'profil';
  document.querySelector('[data-section="profil"]')?.click();
});

document.querySelector('[data-action="parametres"]')?.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  window.location.hash = 'settings';
  document.querySelector('[data-section="settings"]')?.click();
});

document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  sessionStorage.removeItem(STORAGE_KEY);
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});