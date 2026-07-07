import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill both in.',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Hash-based routing on GitHub Pages: the magic-link token arrives in the
    // URL fragment; supabase-js picks it up from window.location automatically.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Human-readable message from a Supabase/PostgREST error. RPC exceptions
 * raised with errcode P0001 carry user-friendly text written for end users. */
export function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string; error_description?: string }
    return e.message ?? e.error_description ?? 'Something went wrong.'
  }
  return 'Something went wrong.'
}
