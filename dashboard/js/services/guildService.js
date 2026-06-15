import { supabase } from '../supabaseClient.js';

const STORAGE_KEY = 'warstack_guild_id';   // sessionStorage - guild actif pour cette page
const PREF_KEY    = 'warstack_active_guild'; // localStorage - dernier choix de l'utilisateur sur ce navigateur

let _cachedGuildId = null;

export async function getActiveGuildId() {
  if (_cachedGuildId) return _cachedGuildId;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    _cachedGuildId = stored;
    return _cachedGuildId;
  }

  if (window.WARSTACK_GUILD_ID) {
    _cachedGuildId = window.WARSTACK_GUILD_ID;
    return _cachedGuildId;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const discordId = session.user?.user_metadata?.provider_id
                   || session.user?.user_metadata?.sub;
    if (!discordId) return null;

    // Préférence sauvegardée par l'utilisateur (sélecteur de serveur)
    const preferred = localStorage.getItem(PREF_KEY);

    let query = supabase
      .from('guilds')
      .select('guild_id')
      .eq('owner_id', discordId)
      .eq('setup_complete', true);

    if (preferred) query = query.eq('guild_id', preferred);

    let { data, error } = await query
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    // Préférence introuvable/invalide pour cet owner → fallback sur le 1er serveur configuré
    if ((error || !data) && preferred) {
      const fallback = await supabase
        .from('guilds')
        .select('guild_id')
        .eq('owner_id', discordId)
        .eq('setup_complete', true)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();
      data  = fallback.data;
      error = fallback.error;
    }

    if (error || !data) return null;

    _cachedGuildId = data.guild_id;
    sessionStorage.setItem(STORAGE_KEY, _cachedGuildId);
    return _cachedGuildId;

  } catch (err) {
    console.error('[guildService] Erreur résolution guild_id:', err);
    return null;
  }
}

// Change le serveur actif (sélecteur de serveur dans la sidebar) et recharge la page
export function switchActiveGuild(guildId) {
  if (!guildId) return;
  localStorage.setItem(PREF_KEY, guildId);
  sessionStorage.setItem(STORAGE_KEY, guildId);
  _cachedGuildId = guildId;
  window.location.reload();
}

export function clearGuildCache() {
  _cachedGuildId = null;
  sessionStorage.removeItem(STORAGE_KEY);
}