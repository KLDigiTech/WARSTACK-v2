import { fetchSupabase, callBotAPI } from '../api.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { isFounder, getCurrentDiscordId } from './permissionService.js';
import { getActiveGuildId } from './guildService.js';

const FOUNDER_DISCORD_ID = '1233271006236377180';

async function sbFetch(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
}

async function sbPost(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function sbPatch(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function sbDelete(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
}

export async function getDashboardRoles() {
  const guildId = await getActiveGuildId();
  return sbFetch(`dashboard_roles?guild_id=eq.${guildId}&order=priority.asc,created_at.asc`);
}

export async function createDashboardRole(name, color = '#ffffff') {
  const guildId = await getActiveGuildId();
  return sbPost('dashboard_roles', { guild_id: guildId, name, color, is_system: false, priority: 99 });
}

export async function updateDashboardRole(roleId, data) {
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system) throw new Error('Le rôle Fondateur ne peut pas être modifié.');
  return sbPatch(`dashboard_roles?id=eq.${roleId}`, data);
}

export async function deleteDashboardRole(roleId) {
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system) throw new Error('Le rôle Fondateur ne peut pas être supprimé.');
  await sbDelete(`dashboard_role_channels?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_role_permissions?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_user_roles?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_roles?id=eq.${roleId}`);
}

export async function getRolePermissions(roleId) {
  return sbFetch(`dashboard_role_permissions?role_id=eq.${roleId}&select=module_key`);
}

export async function saveRolePermissions(roleId, modules) {
  await sbDelete(`dashboard_role_permissions?role_id=eq.${roleId}`);
  for (const module_key of modules) {
    await sbPost('dashboard_role_permissions', { role_id: roleId, module_key });
  }
}

export async function getRoleChannels(roleId) {
  return sbFetch(`dashboard_role_channels?role_id=eq.${roleId}&select=channel_id`);
}

export async function saveRoleChannels(roleId, channelIds) {
  await sbDelete(`dashboard_role_channels?role_id=eq.${roleId}`);
  for (const channel_id of channelIds) {
    await sbPost('dashboard_role_channels', { role_id: roleId, channel_id });
  }
}

export async function getDiscordChannels() {
  return callBotAPI('channels', 'GET');
}

export async function getGuildMembers() {
  const guildId = await getActiveGuildId();
  const players = await sbFetch(
    `players?select=discord_id,username,pseudo_bf6,avatar_url&order=username.asc`
  );
  const userRoles = await sbFetch(
    `dashboard_user_roles?guild_id=eq.${guildId}&select=discord_id,role_id`
  );
  const roleMap = {};
  (userRoles || []).forEach(ur => { roleMap[ur.discord_id] = ur.role_id; });
  return (players || []).map(p => ({ ...p, role_id: roleMap[p.discord_id] || null }));
}

export async function assignRoleToMember(discordId, roleId) {
  const guildId   = await getActiveGuildId();
  const currentId = await getCurrentDiscordId();
  if (discordId === FOUNDER_DISCORD_ID && !isFounder(currentId)) {
    throw new Error('Impossible de modifier le rôle du Fondateur.');
  }
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system && discordId !== FOUNDER_DISCORD_ID) {
    throw new Error('Le rôle Fondateur est réservé.');
  }
  const existing = await sbFetch(
    `dashboard_user_roles?guild_id=eq.${guildId}&discord_id=eq.${discordId}`
  );
  if (existing?.length) {
    await sbPatch(
      `dashboard_user_roles?guild_id=eq.${guildId}&discord_id=eq.${discordId}`,
      { role_id: roleId, assigned_by: currentId }
    );
  } else {
    await sbPost('dashboard_user_roles', {
      guild_id: guildId, discord_id: discordId, role_id: roleId, assigned_by: currentId
    });
  }
}

export async function removeRoleFromMember(discordId) {
  const guildId = await getActiveGuildId();
  if (discordId === FOUNDER_DISCORD_ID) {
    throw new Error('Impossible de retirer le rôle du Fondateur.');
  }
  await sbDelete(`dashboard_user_roles?guild_id=eq.${guildId}&discord_id=eq.${discordId}`);
}

export async function searchMember(query) {
  return callBotAPI(`member/search?q=${encodeURIComponent(query)}`, 'GET');
}