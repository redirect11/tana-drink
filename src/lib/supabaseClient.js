import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Avvisa chiaramente in console se la configurazione manca, così l'app
// non fallisce in modo silenzioso quando le variabili non sono impostate.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti. ' +
      'Copia .env.example in .env e inserisci i valori del tuo progetto.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'public-anon-key-placeholder',
  {
    realtime: { params: { eventsPerSecond: 10 } },
  }
)
