import { supabase } from './supabaseClient.js';
import { BOT_URL, API_KEY } from './config.js';
import { switchActiveGuild } from './services/guildService.js';

const STORAGE_KEY = 'warstack_guild_id';
const PREF_KEY    = 'warstack_active_guild';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '/login.html'; }

const user      = session.user;
const userName  = user.user_metadata.full_name || user.user_metadata.name || 'Utilisateur';
const userAvatar= user.user_metadata.avatar_url || '';
const discordId = user.user_metadata.provider_id || user.user_metadata.sub;

// ── Affichage user ────────────────────────────────────────────
document.getElementById('user-name').textContent    = userName;
document.getElementById('user-avatar').src          = userAvatar;
document.getElementById('dropdown-name').textContent = userName;
document.getElementById('dropdown-avatar').src       = userAvatar;
const mobileAvatar = document.getElementById('mobile-user-avatar');
if (mobileAvatar) mobileAvatar.src = userAvatar;

// ── Sync avatar Supabase ──────────────────────────────────────
if (userAvatar) {
  await supabase.from('players').update({ avatar_url: userAvatar }).eq('discord_id', discordId);
}

// ── Récupérer guild_id via Supabase (multi-serveur) ───────────
const urlParams  = new URLSearchParams(window.location.search);
const guildParam = urlParams.get('guild');
const preferred  = localStorage.getItem(PREF_KEY);

let guildId    = null;
let guildData  = null;
let myGuilds   = [];

try {
  const { data, error } = await supabase
    .from('guilds')
    .select('guild_id, name, icon')
    .eq('owner_id', discordId)
    .eq('setup_complete', true)
    .order('joined_at', { ascending: true });

  if (error || !data || !data.length) {
    window.location.href = '/setup.html';
  } else {
    myGuilds = data;

    // Priorité : ?guild= dans l'URL > préférence sauvegardée > 1er serveur configuré
    const wanted = [guildParam, preferred].find(
      id => id && myGuilds.some(g => g.guild_id === id)
    );

    guildData = wanted
      ? myGuilds.find(g => g.guild_id === wanted)
      : myGuilds[0];

    guildId = guildData.guild_id;

    document.getElementById('server-title').textContent = guildData.name;
    document.getElementById('server-logo').src          = guildData.icon || userAvatar;
    if (document.getElementById('server-name'))
      document.getElementById('server-name').textContent = guildData.name;
  }
} catch (err) {
  console.error('Guild fetch error:', err);
  window.location.href = '/setup.html';
}

// Stocker guild_id (session = page courante, local = préférence persistante)
if (guildId) {
  sessionStorage.setItem(STORAGE_KEY, guildId);
  localStorage.setItem(PREF_KEY, guildId);
}

window.WARSTACK_GUILD_ID    = guildId;
window.WARSTACK_DISCORD_ID  = discordId;

// Le lien "Lien inscription" doit transporter le serveur ciblé
if (guildId) {
  document.querySelectorAll('a[href^="/inscription.html"]').forEach(a => {
    a.href = `/inscription.html?guild=${guildId}`;
  });
  document.querySelectorAll('a[href^="/portail.html"]').forEach(a => {
    a.href = `/portail.html?guild=${guildId}`;
  });
}

// Nettoyer l'URL (le guild_id est désormais stocké)
if (guildParam) {
  urlParams.delete('guild');
  const newUrl = window.location.pathname
    + (urlParams.toString() ? `?${urlParams.toString()}` : '')
    + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

// ── SÉLECTEUR DE SERVEUR (si l'owner gère plusieurs serveurs) ─
const guildSwitcher  = document.getElementById('guild-switcher');
const switcherChevron = document.getElementById('guild-switcher-chevron');
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

// ── DROPDOWN UTILISATEUR ───────────────────────────────────────
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

document.querySelector('[data-action="mon-profil"]')?.addEventListener('click', async () => {
  const { data: players } = await supabase.from('players').select('discord_id').eq('discord_id', discordId).single();
  if (players?.discord_id) window.open(`/profil.html?id=${players.discord_id}&guild=${guildId}`, '_blank');
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