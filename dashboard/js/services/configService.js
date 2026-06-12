import { fetchSupabase } from '../api.js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config.js';
import { getActiveGuildId } from './guildService.js';

export async function saveConfig(key, value) {
  const guildId = await getActiveGuildId();
  if (!guildId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/config`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ guild_id: guildId, key, value })
  });
}

export async function loadConfigs() {
  const guildId = await getActiveGuildId();
  if (!guildId) return [];
  return await fetchSupabase(`config?guild_id=eq.${guildId}`);
}

export function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value;
}