// dashboard/js/supabaseClient.js
// Utilise la publishable key (remplace l'ancienne anon JWT legacy désactivée)
// Ne jamais mettre la secret key ici — ce fichier est chargé dans le browser

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession    : true,
      autoRefreshToken  : true,
      detectSessionInUrl: true,
    }
  }
);