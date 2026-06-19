// ── RÔLES & PERMISSIONS D'ÉQUIPE — SOURCE UNIQUE ──────────────────────────────
// Utilisé à la fois par la page Équipe (team.js) et par le système de
// permissions (permissionService.js) pour que les deux soient TOUJOURS
// synchronisés : modifier un rôle dans Équipe change immédiatement ce que
// la personne peut voir dans le dashboard.

export const ROLES = ['👑 Fondateur', '⭐ Team Leader', '🎮 Organisateur', '🛡 Modérateur'];

export const ROLE_PERMS = {
  '👑 Fondateur'   : ['overview','players','tournament','events','suggestions','tickets','logs','moderation','analytics','settings','channels','reactions','messages','onboarding','access','welcome','roles','birthdays','automod','ocr-test','origine','team'],
  '⭐ Team Leader' : ['overview','players','tournament','events','suggestions','tickets','logs'],
  '🎮 Organisateur': ['overview','events','tournament','suggestions'],
  '🛡 Modérateur'  : ['overview','tickets','logs','suggestions','moderation'],
};

export const PERMS_LIST = ['logs','tickets','suggestions','events','tournament','moderation','analytics','settings'];

export const PERMS_LABELS = {
  logs: 'Logs', tickets: 'Tickets', suggestions: 'Suggestions', events: 'Événements',
  tournament: 'Tournois', moderation: 'Modération', analytics: 'Analytics', settings: 'Paramètres',
};

export const MODULE_LABELS = {
  overview: 'Vue générale', players: 'Joueurs', tournament: 'Tournois',
  events: 'Événements', suggestions: 'Suggestions', tickets: 'Tickets',
  logs: 'Logs', moderation: 'Modération', analytics: 'Analytics',
  settings: 'Paramètres', channels: 'Salons', reactions: 'Réactions',
  messages: 'Messages', onboarding: 'Onboarding', access: 'Accès',
  welcome: 'Bienvenue', roles: 'Rôles auto', birthdays: 'Anniversaires',
  automod: 'Auto-Modération', 'ocr-test': 'Test OCR', origine: 'Origine', team: 'Équipe',
};

/** Calcule la liste des modules accessibles pour un rôle + ses permissions cochées en plus. */
export function computePermissions(role, extraPerms = []) {
  const base = ROLE_PERMS[role] || [];
  return [...new Set([...base, ...extraPerms])];
}