/**
 * Supabase client — uses SERVICE_ROLE key to bypass RLS
 * This gives the server read/write access to all tables.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

export const supabase = createClient(url, key)
