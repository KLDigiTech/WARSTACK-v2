import { supabase } from '../supabaseClient.js';

let _cachedGuildId = null;

export async function getActiveGuildId() {
  if (_cachedGuildId) return _cachedGuildId;

  const stored = sessionStorage.getItem('warstack_guild_id');
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

    const { data, error } = await supabase
      .from('guilds')
      .select('guild_id')
      .eq('owner_id', discordId)
      .eq('setup_complete', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    _cachedGuildId = data.guild_id;
    sessionStorage.setItem('warstack_guild_id', _cachedGuildId);
    return _cachedGuildId;

  } catch (err) {
    console.error('[guildService] Erreur résolution guild_id:', err);
    return null;
  }
}

export function clearGuildCache() {
  _cachedGuildId = null;
  sessionStorage.removeItem('warstack_guild_id');
}