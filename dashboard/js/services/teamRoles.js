// ── RÔLES & PERMISSIONS D'ÉQUIPE — DYNAMIQUE (par serveur) ──────────────────
// Les rôles ne sont plus en dur dans le code : ils sont stockés dans la
// table Supabase `team_roles`, propres à chaque guild. Le Fondateur peut
// créer / modifier / supprimer des rôles et choisir quels modules chaque
// rôle peut voir, depuis le dashboard (page Équipe → Gérer les rôles).

import { fetchSupabase, insertSupabase, updateSupabase, deleteSupabase } from '../api.js';

// Liste de tous les modules existants dans le dashboard (référence fixe,
// ce n'est pas une permission, juste le catalogue des pages).
export const MODULE_LABELS = {
  overview: 'Vue générale', players: 'Joueurs', tournament: 'Tournois',
  events: 'Événements', suggestions: 'Suggestions', tickets: 'Tickets',
  logs: 'Logs', moderation: 'Modération', analytics: 'Analytics',
  settings: 'Paramètres', channels: 'Salons', reactions: 'Réactions',
  messages: 'Messages', onboarding: 'Onboarding', access: 'Accès',
  welcome: 'Bienvenue', roles: 'Rôles auto', birthdays: 'Anniversaires',
  automod: 'Auto-Modération', 'ocr-test': 'Test OCR', origine: 'Origine', team: 'Équipe',
};

export const ALL_MODULES = Object.keys(MODULE_LABELS);

// Rôles posés par défaut la toute première fois qu'une guild ouvre la page Équipe.
const DEFAULT_ROLES = [
  { role_name: '👑 Fondateur', emoji: '👑', is_protected: true, modules: ALL_MODULES },
  { role_name: '⭐ Team Leader', emoji: '⭐', is_protected: false,
    modules: ['overview','players','tournament','events','suggestions','tickets','logs'] },
  { role_name: '🎮 Organisateur', emoji: '🎮', is_protected: false,
    modules: ['overview','events','tournament','suggestions'] },
  { role_name: '🛡 Modérateur', emoji: '🛡', is_protected: false,
    modules: ['overview','tickets','logs','suggestions','moderation'] },
];

let _cache = {}; // guildId -> roles[]

/** Charge les rôles d'une guild, les crée par défaut si aucun n'existe encore. */
export async function loadRoles(guildId, force = false) {
  if (!guildId) return [];
  if (!force && _cache[guildId]) return _cache[guildId];

  let rows = await fetchSupabase(`team_roles?guild_id=eq.${guildId}&order=created_at.asc`);

  if (!rows || !rows.length) {
    for (const r of DEFAULT_ROLES) {
      await insertSupabase('team_roles', { guild_id: guildId, ...r });
    }
    rows = await fetchSupabase(`team_roles?guild_id=eq.${guildId}&order=created_at.asc`);
  }

  _cache[guildId] = rows || [];
  return _cache[guildId];
}

export function clearRolesCache(guildId) {
  if (guildId) delete _cache[guildId];
  else _cache = {};
}

export async function getRoleModules(guildId, roleName) {
  const roles = await loadRoles(guildId);
  const role  = roles.find(r => r.role_name === roleName);
  return role?.modules || [];
}

/** Calcule la liste des modules accessibles pour un rôle + permissions cochées en plus. */
export async function computePermissions(guildId, roleName, extraPerms = []) {
  const base = await getRoleModules(guildId, roleName);
  return [...new Set([...base, ...extraPerms])];
}

export async function createRole(guildId, { role_name, emoji, modules }) {
  const result = await insertSupabase('team_roles', {
    guild_id: guildId, role_name, emoji: emoji || '🔰', modules, is_protected: false,
  });
  clearRolesCache(guildId);
  return result;
}

export async function updateRole(guildId, roleId, { role_name, emoji, modules }) {
  const body = {};
  if (role_name !== undefined) body.role_name = role_name;
  if (emoji     !== undefined) body.emoji     = emoji;
  if (modules   !== undefined) body.modules   = modules;
  const result = await updateSupabase(`team_roles?id=eq.${roleId}`, body);
  clearRolesCache(guildId);
  return result;
}

export async function deleteRole(guildId, roleId) {
  const result = await deleteSupabase(`team_roles?id=eq.${roleId}`);
  clearRolesCache(guildId);
  return result;
}