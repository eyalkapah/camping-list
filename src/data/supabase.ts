import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The anon key is public by design and protected by row-level security.
 * The *model* key is not here and must never be — it lives in the Edge
 * Function that proxies the LLM (ADR-0001, ADR-0004).
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when the app is running against the real system of record. */
export const isRemote = Boolean(url && anonKey)

let client: SupabaseClient | null = null
let activeCode = ''

/**
 * The Trip Code travels as a request header, because every row-level security
 * policy checks it (see `supabase/schema.sql`). Headers are fixed when a
 * client is created, so changing Trip means a new client — which happens once
 * per session, not per request.
 */
export function clientForCode(code: string): SupabaseClient {
  if (!url || !anonKey) throw new Error('Supabase is not configured')
  if (!client || code !== activeCode) {
    activeCode = code
    client = createClient(url, anonKey, {
      global: { headers: { 'x-trip-code': code } },
    })
  }
  return client
}

/** For writes, which always follow a load or a create. */
export function activeClient(): SupabaseClient {
  if (!client) throw new Error('No Trip is open')
  return client
}

let admin: SupabaseClient | null = null

/**
 * The super admin's client (ADR-0009). Deliberately separate from the Trip
 * clients above: it sends no `x-trip-code` header, because its authority comes
 * from a real Supabase Auth session rather than from holding a code. It also
 * keeps its own `storageKey`, so signing in as an admin never disturbs — or is
 * disturbed by — whichever Trip the same browser has open.
 */
export function adminClient(): SupabaseClient {
  if (!url || !anonKey) throw new Error('Supabase is not configured')
  if (!admin) {
    admin = createClient(url, anonKey, {
      auth: {
        storageKey: 'camping/admin-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return admin
}
