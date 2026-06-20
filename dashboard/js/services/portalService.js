import { loadConfigs, saveConfig, getConfig } from './configService.js';

// ── WHITELIST VERROUILLÉE ───────────────────────────────────────────────────
// Seules ces sections peuvent apparaître sur le portail membre.
// Les sections sensibles (modération, automod, tickets, logs, rulebuilder,
// ocr-test, settings, team, access, analytics, messages, reactions, channels)
// ne figurent JAMAIS dans cette liste et ne peuvent pas être activées,
// même depuis Paramètres.
export const PORTAL_ELIGIBLE_SECTIONS = [
  { id: 'overview',    label: "Vue d'ensemble", icon: 'fa-chart-line' },
  { id: 'players',     label: 'Joueurs',         icon: 'fa-users' },
  { id: 'tournament',  label: 'Tournoi',         icon: 'fa-trophy' },
  { id: 'welcome',     label: 'Arrivées/Départs',icon: 'fa-door-open' },
  { id: 'onboarding',  label: 'Onboarding',      icon: 'fa-user-check' },
  { id: 'roles',       label: 'Rôles auto',      icon: 'fa-tags' },
  { id: 'birthdays',   label: 'Anniversaires',   icon: 'fa-birthday-cake' },
  { id: 'suggestions', label: 'Suggestions',     icon: 'fa-lightbulb' },
  { id: 'events',      label: 'Événements',      icon: 'fa-calendar-alt' },
  { id: 'origine',     label: 'Carte Membres',   icon: 'fa-globe' },
];

const CONFIG_KEY = 'portal_sections';

const DEFAULT_ENABLED = ['overview', 'players', 'tournament', 'events', 'origine'];

export async function getPortalSections() {
  const configs = await loadConfigs();
  const raw = getConfig(configs, CONFIG_KEY);
  if (!raw) return DEFAULT_ENABLED;
  try {
    const parsed = JSON.parse(raw);
    // Filtre de sécurité : même si une valeur corrompue/injectée traîne en base,
    // seules les sections de la whitelist peuvent ressortir.
    return parsed.filter(id => PORTAL_ELIGIBLE_SECTIONS.some(s => s.id === id));
  } catch {
    return DEFAULT_ENABLED;
  }
}

export async function savePortalSections(enabledIds) {
  const safe = enabledIds.filter(id => PORTAL_ELIGIBLE_SECTIONS.some(s => s.id === id));
  await saveConfig(CONFIG_KEY, JSON.stringify(safe));
  return safe;
}