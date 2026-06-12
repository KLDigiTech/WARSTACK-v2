import { supabase } from './supabaseClient.js';
import { BOT_URL, API_KEY } from './config.js';

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

// ── Récupérer guild_id via Supabase ───────────────────────────
let guildId = null;

try {
  // Cherche le serveur configuré de cet admin
  const { data: guildData } = await supabase
    .from('guilds')
    .select('guild_id, name, icon')
    .eq('owner_id', discordId)
    .eq('setup_complete', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (guildData) {
    guildId = guildData.guild_id;
    document.getElementById('server-title').textContent = guildData.name;
    document.getElementById('server-logo').src          = guildData.icon || userAvatar;
    if (document.getElementById('server-name'))
      document.getElementById('server-name').textContent = guildData.name;
  } else {
    // Aucun serveur configuré → setup
    window.location.href = '/setup.html';
  }
} catch (err) {
  console.error('Guild fetch error:', err);
  window.location.href = '/setup.html';
}

// Stocker guild_id dans sessionStorage pour toute l'app
if (guildId) sessionStorage.setItem('warstack_guild_id', guildId);

window.WARSTACK_GUILD_ID    = guildId;
window.WARSTACK_DISCORD_ID  = discordId;

// ── DROPDOWN ─────────────────────────────────────────────────
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
  if (players?.discord_id) window.open(`/profil.html?id=${players.discord_id}`, '_blank');
});

document.querySelector('[data-action="parametres"]')?.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  window.location.hash = 'settings';
  document.querySelector('[data-section="settings"]')?.click();
});

document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  sessionStorage.removeItem('warstack_guild_id');
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});