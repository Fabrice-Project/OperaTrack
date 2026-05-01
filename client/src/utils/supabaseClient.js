import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      detectSessionInUrl: true, // Supabase détecte et traite le token automatiquement
      autoRefreshToken:   true,
      persistSession:     true,
    },
  }
);
