import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

/**
 * Generate a 6-char room code via Supabase function
 */
export async function generateRoomCode() {
  const { data, error } = await supabase.rpc('generate_room_code')
  if (error) throw error
  return data
}

/**
 * Get a round by room code (for joining another group)
 */
export async function getRoundByRoomCode(code) {
  const { data, error } = await supabase
    .from('rounds')
    .select('*, round_members(*), game_configs(*)')
    .eq('room_code', code.toUpperCase())
    .single()
  if (error) throw error
  return data
}
