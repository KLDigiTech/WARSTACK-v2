// dashboard/js/services/accessService.js
// CRUD complet : rôles, permissions modules, permissions salons, assignation membres

import { fetchSupabase, callBotAPI } from '../api.js';
import { SUPABASE_URL, SUPABASE_KEY, GUILD_ID } from '../config.js';
import { isFounder, getCurrentDiscordId } from './permissionService.js';

const FOUNDER_DISCORD_ID = '1233271006236377180';

// ─── HELPERS ─────────────────────────────────────────────────

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

// ─── RÔLES ───────────────────────────────────────────────────

export async function getDashboardRoles() {
  return sbFetch(`dashboard_roles?guild_id=eq.${GUILD_ID}&order=priority.asc,created_at.asc`);
}

export async function createDashboardRole(name, color = '#ffffff') {
  return sbPost('dashboard_roles', {
    guild_id: GUILD_ID,
    name,
    color,
    is_system: false,
    priority: 99
  });
}

export async function updateDashboardRole(roleId, data) {
  // Protège le rôle Fondateur — ne peut pas être modifié
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system) throw new Error('Le rôle Fondateur ne peut pas être modifié.');
  return sbPatch(`dashboard_roles?id=eq.${roleId}`, data);
}

export async function deleteDashboardRole(roleId) {
  // Protège le rôle Fondateur
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system) throw new Error('Le rôle Fondateur ne peut pas être supprimé.');
  await sbDelete(`dashboard_role_channels?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_role_permissions?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_user_roles?role_id=eq.${roleId}`);
  await sbDelete(`dashboard_roles?id=eq.${roleId}`);
}

// ─── PERMISSIONS MODULES ─────────────────────────────────────

export async function getRolePermissions(roleId) {
  return sbFetch(`dashboard_role_permissions?role_id=eq.${roleId}&select=module_key`);
}

export async function saveRolePermissions(roleId, modules) {
  await sbDelete(`dashboard_role_permissions?role_id=eq.${roleId}`);
  for (const module_key of modules) {
    await sbPost('dashboard_role_permissions', { role_id: roleId, module_key });
  }
}

// ─── PERMISSIONS SALONS DISCORD ──────────────────────────────

export async function getRoleChannels(roleId) {
  return sbFetch(`dashboard_role_channels?role_id=eq.${roleId}&select=channel_id`);
}

export async function saveRoleChannels(roleId, channelIds) {
  await sbDelete(`dashboard_role_channels?role_id=eq.${roleId}`);
  for (const channel_id of channelIds) {
    await sbPost('dashboard_role_channels', { role_id: roleId, channel_id });
  }
}

// Récupère la liste des salons Discord depuis le bot
export async function getDiscordChannels() {
  return callBotAPI('channels', 'GET');
}

// ─── MEMBRES ─────────────────────────────────────────────────

export async function getGuildMembers() {
  // Récupère les membres depuis Supabase (players inscrits)
  const players = await sbFetch(
    `players?select=discord_id,username,pseudo_bf6,avatar_url&order=username.asc`
  );
  // Récupère les assignations de rôles
  const userRoles = await sbFetch(
    `dashboard_user_roles?guild_id=eq.${GUILD_ID}&select=discord_id,role_id`
  );
  const roleMap = {};
  (userRoles || []).forEach(ur => { roleMap[ur.discord_id] = ur.role_id; });
  return (players || []).map(p => ({
    ...p,
    role_id: roleMap[p.discord_id] || null
  }));
}

export async function assignRoleToMember(discordId, roleId) {
  const currentId = await getCurrentDiscordId();

  // Le Fondateur ne peut pas se voir retirer son rôle par quelqu'un d'autre
  if (discordId === FOUNDER_DISCORD_ID && !isFounder(currentId)) {
    throw new Error('Impossible de modifier le rôle du Fondateur.');
  }

  // Vérifie que le rôle cible n'est pas le rôle Fondateur système
  const roles = await sbFetch(`dashboard_roles?id=eq.${roleId}`);
  if (roles?.[0]?.is_system && discordId !== FOUNDER_DISCORD_ID) {
    throw new Error('Le rôle Fondateur est réservé.');
  }

  // Upsert
  const existing = await sbFetch(
    `dashboard_user_roles?guild_id=eq.${GUILD_ID}&discord_id=eq.${discordId}`
  );
  if (existing?.length) {
    await sbPatch(
      `dashboard_user_roles?guild_id=eq.${GUILD_ID}&discord_id=eq.${discordId}`,
      { role_id: roleId, assigned_by: currentId }
    );
  } else {
    await sbPost('dashboard_user_roles', {
      guild_id: GUILD_ID,
      discord_id: discordId,
      role_id: roleId,
      assigned_by: currentId
    });
  }
}

export async function removeRoleFromMember(discordId) {
  const currentId = await getCurrentDiscordId();
  if (discordId === FOUNDER_DISCORD_ID) {
    throw new Error('Impossible de retirer le rôle du Fondateur.');
  }
  await sbDelete(
    `dashboard_user_roles?guild_id=eq.${GUILD_ID}&discord_id=eq.${discordId}`
  );
}

// Recherche un membre Discord par username (via bot API)
export async function searchMember(query) {
  return callBotAPI(`member/search?q=${encodeURIComponent(query)}`, 'GET');
}