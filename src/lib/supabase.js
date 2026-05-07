import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// In admin mode (localhost), use the service_role key which bypasses RLS for writes.
// In public mode (Vercel), use the anon key which only allows reads.
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// True when running locally with the service_role key (can write)
export const isAdminMode = !!import.meta.env.VITE_SUPABASE_SERVICE_KEY
