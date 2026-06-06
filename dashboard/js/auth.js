import { supabase } from './supabaseClient.js';

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = '/login.html';
}

const user       = session.user;
const userName   = user.user_metadata.full_name || user.user_metadata.name || 'Utilisateur';
const userAvatar = user.user_metadata.avatar_url || user.user_metadata.picture || './assets/default-avatar.png';
const discordId  = user.user_metadata.provider_id || user.user_metadata.sub;

document.getElementById('user-name').textContent     = userName;
document.getElementById('user-avatar').src           = userAvatar;
document.getElementById('dropdown-name').textContent  = userName;
document.getElementById('dropdown-avatar').src        = userAvatar;

const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
if (avatarUrl) {
  await supabase.from('players').update({ avatar_url: avatarUrl }).eq('discord_id', discordId);
}

try {
  const res   = await fetch('https://warstack-bot.onrender.com/api/guild');
  const guild = await res.json();
  document.getElementById('server-title').textContent = guild.name || 'WARSTACK';
  document.getElementById('server-name').textContent  = guild.name || 'WARSTACK';
  document.getElementById('server-logo').src          = guild.icon || userAvatar;

  // ── Sync icône serveur → topbar mobile ──
  const mobileAvatar = document.getElementById('mobile-user-avatar');
  if (mobileAvatar) mobileAvatar.src = guild.icon || userAvatar;
} catch (err) {
  console.error('Guild fetch error:', err);
}

// ── DROPDOWN ─────────────────────────────────────────────────
const userMenu     = document.getElementById('user-menu');
const userDropdown = document.getElementById('user-dropdown');

userMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  userDropdown.classList.toggle('open');
  userMenu.classList.toggle('user-menu-open');
});

document.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  userMenu.classList.remove('user-menu-open');
});

userDropdown.addEventListener('click', (e) => e.stopPropagation());

// ── BOUTONS DROPDOWN ─────────────────────────────────────────

document.querySelector('[data-action="mon-profil"]')?.addEventListener('click', async () => {
  const { data: players } = await supabase
    .from('players')
    .select('discord_id')
    .eq('discord_id', discordId)
    .single();
  if (players?.discord_id) {
    window.open(`/profil.html?id=${players.discord_id}`, '_blank');
  }
});

document.querySelector('[data-action="parametres"]')?.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  window.location.hash = 'settings';
  document.querySelector('[data-section="settings"]')?.click();
});

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});