import { SUPABASE_URL, SUPABASE_KEY, BOT_URL, API_KEY } from './config.js';
import { getActiveGuildId } from './services/guildService.js';

// SUPABASE

export async function fetchSupabase(endpoint, method = 'GET', body = null, returnData = false) {
  const headers = {
    apikey       : SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer       : 'return=representation',
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);

  if (res.status === 204) return returnData ? { data: null } : null;

  const json = await res.json();

  // Erreur HTTP (400, 401, 404, 500...) → log + retour propre
  if (!res.ok) {
    console.warn(`⚠️ Supabase [${res.status}] ${endpoint}`, json?.message || json);
    return returnData ? { data: null, error: json } : null;
  }

  if (returnData) {
    if (Array.isArray(json)) return { data: json[0] || null, error: null };
    if (json?.code)          return { data: null, error: json };
    return { data: json, error: null };
  }

  return json;
}

export async function updateSupabase(endpoint, data) {
  return fetchSupabase(endpoint, 'PATCH', data);
}

export async function insertSupabase(endpoint, data) {
  return fetchSupabase(endpoint, 'POST', data);
}

export async function deleteSupabase(endpoint) {
  return fetchSupabase(endpoint, 'DELETE');
}

// BOT API

export async function callBotAPI(endpoint, method = 'GET', body = null) {
  try {
    const guildId = await getActiveGuildId();

    let url = `${BOT_URL}/api/${endpoint}`;
    const options = {
      method,
      headers: {
        'x-api-key'   : API_KEY,
        'Content-Type': 'application/json',
      }
    };

    if (method === 'GET') {
      if (guildId) {
        const sep = url.includes('?') ? '&' : '?';
        url += `${sep}guild_id=${encodeURIComponent(guildId)}`;
      }
    } else {
      const payload = { ...(body || {}) };
      if (guildId && !payload.guild_id) payload.guild_id = guildId;
      options.body = JSON.stringify(payload);
    }

    const res = await fetch(url, options);
    return res.json();
  } catch (error) {
    console.error('❌ Bot API error:', error);
    return null;
  }
}