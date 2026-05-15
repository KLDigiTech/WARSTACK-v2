// auth.js — Session, user, dropdown, logout

import { supabase } from './supabaseClient.js';

// SESSION
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = '/dashboard/login.html';
}

const user       = session.user;
const userName   = user.user_metadata.full_name || user.user_metadata.name || 'Utilisateur';
const userAvatar = user.user_metadata.avatar_url || user.user_metadata.picture || './assets/default-avatar.png';

document.getElementById('user-name').textContent     = userName;
document.getElementById('user-avatar').src           = userAvatar;
document.getElementById('dropdown-name').textContent = userName;
document.getElementById('dropdown-avatar').src       = userAvatar;

// GUILD
try {
  const res   = await fetch('https://warstack-bot.onrender.com/api/guild');
  const guild = await res.json();
  document.getElementById('server-title').textContent = guild.name || 'WARSTACK';
  document.getElementById('server-name').textContent  = guild.name || 'WARSTACK';
  document.getElementById('server-logo').src          = guild.icon || './assets/warstack-logo.png';
} catch (err) {
  console.error('Guild fetch error:', err);
}

// DROPDOWN
const userMenu     = document.getElementById('user-menu');
const userDropdown = document.getElementById('user-dropdown');
const chevron      = document.querySelector('.user-chevron');

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

// LOGOUT
document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  await supabase.auth.signOut();
  window.location.href = '/dashboard/login.html';
});