// dashboard/js/services/permissionService.js
// Récupère le discord_id depuis la session Supabase Auth (plus de hardcode)

import { fetchSupabase } from '../api.js';
import { supabase }      from '../supabaseClient.js';
import { GUILD_ID }      from '../config.js';

const FOUNDER_DISCORD_ID = '1233271006236377180';

// Cache session pour éviter les appels répétés
let _cachedDiscordId  = null;
let _cachedRole       = null;
let _cachedPerms      = null;

export async function getCurrentDiscordId() {
  if (_cachedDiscordId) return _cachedDiscordId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  _cachedDiscordId = session.user?.user_metadata?.provider_id
                  || session.user?.user_metadata?.sub
                  || null;
  return _cachedDiscordId;
}

export function isFounder(discordId) {
  return discordId === FOUNDER_DISCORD_ID;
}

export async function getCurrentRole() {
  if (_cachedRole !== null) return _cachedRole;
  const discordId = await getCurrentDiscordId();
  if (!discordId) return null;
  if (isFounder(discordId)) {
    _cachedRole = { name: 'Fondateur', color: '#FFD700', is_system: true, priority: 0 };
    return _cachedRole;
  }
  const rows = await fetchSupabase(
    `dashboard_user_roles?guild_id=eq.${GUILD_ID}&discord_id=eq.${discordId}&select=role_id`
  );
  if (!rows?.length) return null;
  const roleId = rows[0].role_id;
  const roles  = await fetchSupabase(`dashboard_roles?id=eq.${roleId}`);
  _cachedRole  = roles?.[0] || null;
  return _cachedRole;
}

export async function getUserPermissions() {
  if (_cachedPerms !== null) return _cachedPerms;
  try {
    const discordId = await getCurrentDiscordId();
    if (!discordId) { _cachedPerms = []; return []; }

    // Fondateur = tout
    if (isFounder(discordId)) {
      _cachedPerms = [
        'overview','players','tournament','welcome','roles','birthdays',
        'suggestions','moderation','automod','tickets','logs','messages',
        'reactions','channels','access','settings','ocr-test','origine','team',
      ];
      return _cachedPerms;
    }

    // Récupère le role_id du user
    const userRoles = await fetchSupabase(
      `dashboard_user_roles?guild_id=eq.${GUILD_ID}&discord_id=eq.${discordId}&select=role_id`
    );
    if (!userRoles?.length) { _cachedPerms = []; return []; }

    const roleId = userRoles[0].role_id;
    const perms  = await fetchSupabase(
      `dashboard_role_permissions?role_id=eq.${roleId}&select=module_key`
    );
    _cachedPerms = (perms || []).map(p => p.module_key);
    return _cachedPerms;

  } catch (err) {
    console.error('Permission service error:', err);
    _cachedPerms = [];
    return [];
  }
}

// Vide le cache (utile après changement de rôle)
export function clearPermissionCache() {
  _cachedDiscordId = null;
  _cachedRole      = null;
  _cachedPerms     = null;
}