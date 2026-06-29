// dashboard/js/supabaseClient.js
// SDK Supabase — utilise l'anon JWT pour Discord OAuth Auth
// La publishable key (sb_publishable_...) ne fonctionne pas avec le SDK Auth

import { createClient }      from 'https://esm.sh/@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession    : true,
      autoRefreshToken  : true,
      detectSessionInUrl: true,
    }
  }
);