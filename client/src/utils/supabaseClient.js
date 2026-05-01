import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType:           'pkce',
      detectSessionInUrl: false, // On gère manuellement pour intercepter les invitations
      autoRefreshToken:   true,
      persistSession:     true,
    },
  }
);
