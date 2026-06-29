// dashboard/js/config.js

export const SUPABASE_URL = 'https://eaiuibqpouwwkqdcwthl.supabase.co';

// Anon JWT — utilisé partout (Auth SDK + appels REST)
// La publishable key sb_publishable_... n'est pas compatible avec l'API REST legacy
export const SUPABASE_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXVpYnFwb3V3d2txZGN3dGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODkyNzMsImV4cCI6MjA5MzY2NTI3M30.QHjd47M2ODKkYLvkCed5Ay4a5bPxxoBsk2aXeWlNk6M';
export const SUPABASE_ANON_KEY = SUPABASE_KEY; // alias pour supabaseClient.js

export const BOT_URL  = 'https://warstack-bot.onrender.com';
export const API_KEY  = 'warstack-secret-2026';
export const GUILD_ID = '1501685144501620798';