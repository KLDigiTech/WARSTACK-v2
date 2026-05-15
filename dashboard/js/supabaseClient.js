import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL      = 'https://eaiuibqpouwwkqdcwthl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXVpYnFwb3V3d2txZGN3dGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODkyNzMsImV4cCI6MjA5MzY2NTI3M30.QHjd47M2ODKkYLvkCed5Ay4a5bPxxoBsk2aXeWlNk6M'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)