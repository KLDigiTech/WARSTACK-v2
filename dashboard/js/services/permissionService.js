import { fetchSupabase } from '../api.js';
import { supabase }      from '../supabaseClient.js';
import { getActiveGuildId }   from './guildService.js';
import { computePermissions } from './teamRoles.js';

const FOUNDER_DISCORD_ID = '1233271006236377180';

let _cachedDiscordId = null;
let _cachedRole      = null;
let _cachedPerms     = null;

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

// Renvoie le membre d'équipe (rôle + permissions supplémentaires) tel que
// défini dans la page Équipe — c'est la SEULE source de vérité.
async function getTeamMember(discordId, guildId) {
  const rows = await fetchSupabase(
    `team_members?guild_id=eq.${guildId}&discord_id=eq.${discordId}&select=role,extra_perms`
  );
  return rows?.[0] || null;
}

export async function getCurrentRole() {
  if (_cachedRole !== null) return _cachedRole;
  const discordId = await getCurrentDiscordId();
  if (!discordId) return null;
  if (isFounder(discordId)) {
    _cachedRole = { name: '👑 Fondateur', is_system: true, priority: 0 };
    return _cachedRole;
  }
  const guildId = await getActiveGuildId();
  if (!guildId) return null;
  const member = await getTeamMember(discordId, guildId);
  if (!member) return null;
  _cachedRole = { name: member.role, is_system: false, priority: 1 };
  return _cachedRole;
}

export async function getUserPermissions() {
  if (_cachedPerms !== null) return _cachedPerms;
  try {
    const discordId = await getCurrentDiscordId();
    if (!discordId) { _cachedPerms = []; return []; }

    const guildId = await getActiveGuildId();
    if (!guildId) { _cachedPerms = []; return []; }

    if (isFounder(discordId)) {
      _cachedPerms = await computePermissions(guildId, '👑 Fondateur');
      return _cachedPerms;
    }

    const member = await getTeamMember(discordId, guildId);
    if (!member) { _cachedPerms = []; return []; }

    const extra = member.extra_perms ? JSON.parse(member.extra_perms) : [];
    _cachedPerms = await computePermissions(guildId, member.role, extra);
    return _cachedPerms;

  } catch (err) {
    console.error('Permission service error:', err);
    _cachedPerms = [];
    return [];
  }
}

export function clearPermissionCache() {
  _cachedDiscordId = null;
  _cachedRole      = null;
  _cachedPerms     = null;
}