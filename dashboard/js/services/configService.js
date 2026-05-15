import { fetchSupabase } from '../api.js';
import { GUILD_ID, SUPABASE_KEY, SUPABASE_URL } from '../config.js';

export async function saveConfig(key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/config`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ guild_id: GUILD_ID, key, value })
  });
}

export async function loadConfigs() {
  return await fetchSupabase(`config?guild_id=eq.${GUILD_ID}`);
}

export function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value;
}