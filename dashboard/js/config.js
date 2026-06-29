// dashboard/js/config.js
// Dashboard JS statique (pas de Vite) — les valeurs sont hardcodées ici
// SUPABASE_ANON_KEY  → SDK Auth uniquement (supabaseClient.js)
// SUPABASE_PUB_KEY   → appels REST directs (api.js fetchSupabase)
// Ne jamais mettre la secret/service_role key ici

export const SUPABASE_URL     = 'https://eaiuibqpouwwkqdcwthl.supabase.co';

// Anon JWT — pour Supabase Auth SDK (Discord OAuth)
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXVpYnFwb3V3d2txZGN3dGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODkyNzMsImV4cCI6MjA5MzY2NTI3M30.QHjd47M2ODKkYLvkCed5Ay4a5bPxxoBsk2aXeWlNk6M';

// Publishable key — pour les appels REST Supabase (fetchSupabase dans api.js)
export const SUPABASE_KEY      = 'sb_publishable_zx3kjNANqkc44FRK24KICQ_hmhRl_TxMd';

export const BOT_URL  = 'https://warstack-bot.onrender.com';
export const API_KEY  = 'warstack-secret-2026';
export const GUILD_ID = '1501685144501620798';