import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Next.js requires the NEXT_PUBLIC_ prefix to safely expose environment 
// variables directly to the client-side browser bundle.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment')
}

export const supabase: SupabaseClient = createClient(supabaseUrl!, supabaseAnonKey!)

export default supabase