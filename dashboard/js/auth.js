import { supabase } from './supabaseClient.js';

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = '/login';
}

const user = session.user;
const userName = user.user_metadata.full_name || user.user_metadata.name || 'Utilisateur';
const userAvatar = user.user_metadata.avatar_url || user.user_metadata.picture || './assets/default-avatar.png';

document.getElementById('user-name').textContent = userName;
document.getElementById('user-avatar').src = userAvatar;
document.getElementById('dropdown-name').textContent = userName;
document.getElementById('dropdown-avatar').src = userAvatar;

const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
if (avatarUrl) {
  const discordId = user.user_metadata.provider_id || user.user_metadata.sub;
  await supabase
    .from('players')
    .update({ avatar_url: avatarUrl })
    .eq('discord_id', discordId);
}

try {
  const res = await fetch('https://warstack-bot.onrender.com/api/guild');
  const guild = await res.json();
  document.getElementById('server-title').textContent = guild.name || 'WARSTACK';
  document.getElementById('server-name').textContent = guild.name || 'WARSTACK';
  document.getElementById('server-logo').src = guild.icon || userAvatar;
} catch (err) {
  console.error('Guild fetch error:', err);
}

const userMenu = document.getElementById('user-menu');
const userDropdown = document.getElementById('user-dropdown');
const chevron = document.querySelector('.user-chevron');

chevron.addEventListener('click', (e) => {
  e.stopPropagation();
  userDropdown.classList.toggle('open');
  userMenu.classList.toggle('user-menu-open');
});

document.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  userMenu.classList.remove('user-menu-open');
});

userDropdown.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  await supabase.auth.signOut();
  window.location.href = '/login';
});