import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://pfljdqjtkqrvbmfuynug.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGpkcWp0a3FydmJtZnV5bnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTE3NzksImV4cCI6MjEwODE2Nzc3OX0.Np4MutIfmXxaUmQ6lq0WUvbdZolV2kvlYWRzC6EjHUk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORAGE_BUCKET = 'recipe-images';
