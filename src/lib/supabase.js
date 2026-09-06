import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ekjmzozryodivzuafumo.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4GPtGvI5gIENovXX7vexjg_ijw3TEEu'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
