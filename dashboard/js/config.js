// dashboard/js/config.js
// Les vraies valeurs sont dans les variables d'environnement Vercel
// Ne jamais mettre de clés secrètes ici — ce fichier est public

export const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL
  || 'https://eaiuibqpouwwkqdcwthl.supabase.co';

// Publishable key uniquement (safe côté browser si RLS est activée)
export const SUPABASE_KEY = import.meta?.env?.VITE_SUPABASE_KEY
  || 'sb_publishable_zx3kjNANqkc44FRK24KICQ_hmhRl_TxMd';

export const BOT_URL  = import.meta?.env?.VITE_BOT_URL
  || 'https://warstack-bot.onrender.com';

export const API_KEY  = import.meta?.env?.VITE_API_KEY
  || 'warstack-secret-2026';

export const GUILD_ID = import.meta?.env?.VITE_GUILD_ID
  || '1501685144501620798';