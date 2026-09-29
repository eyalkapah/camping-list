import { adminClient, isRemote } from './supabase'
import type { Trip } from '../domain/types'

/**
 * The super admin's view of the world (ADR-0009): every Trip, across every
 * code. Kept out of `repo.ts` on purpose — that file is the Trip-Code world,
 * where the only reachable Trip is the one whose code you hold. This one needs
 * a signed-in person, and says so by failing loudly when there is no backend.
 */

/** One row of the admin's Trip list. Counts come from the database, not a load. */
export interface TripSummary extends Trip {
  campers: number
  items: number
}

export class NoBackendError extends Error {
  constructor() {
    super('Supabase is not configured')
  }
}

function db() {
  if (!isRemote) throw new NoBackendError()
  return adminClient()
}

export interface AdminSession {
  email: string
  isSuperAdmin: boolean
}

/**
 * Who, if anyone, is signed in — and whether the database agrees they are an
 * admin. The second half matters: a valid Supabase account is not authority.
 * Authority is a row in `super_admins`, checked server-side by RLS, so a forged
 * client-side `true` buys nothing.
 */
export async function currentAdmin(): Promise<AdminSession | null> {
  if (!isRemote) return null
  const client = adminClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return null

  const { data: rows } = await client
    .from('super_admins')
    .select('user_id')
    .eq('user_id', data.user.id)

  return {
    email: data.user.email ?? '',
    isSuperAdmin: (rows?.length ?? 0) > 0,
  }
}

/**
 * Magic link, not a password. There is exactly one admin account in this
 * project's life, used a few times a year; a password would be written down.
 * `emailRedirectTo` must also be listed in the Supabase project's redirect
 * allow-list, or the link lands nowhere.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const redirect = `${location.origin}${location.pathname}?admin=1`
  const { error } = await db().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await db().auth.signOut()
}

/**
 * Every Trip, newest first, with enough counts to tell them apart.
 *
 * The counts come from `trip_stats()` rather than an embedded `campers(count)`.
 * Embedding fails twice over: the admin holds no Trip Code, so row-level
 * security would report 0 for every Trip, and two foreign keys join trips to
 * campers, so PostgREST rejects the embed as ambiguous. See `schema.sql`.
 */
export async function listTrips(): Promise<TripSummary[]> {
  const [{ data, error }, stats] = await Promise.all([
    db().from('trips').select('*').order('created_at', { ascending: false }),
    db().rpc('trip_stats'),
  ])
  if (error) throw error
  if (stats.error) throw stats.error

  const counts = new Map<string, { campers: number; items: number }>()
  for (const s of (stats.data ?? []) as {
    trip_id: string
    campers: number
    items: number
  }[]) {
    counts.set(s.trip_id, { campers: Number(s.campers), items: Number(s.items) })
  }

  type Row = Record<string, unknown>

  return (data ?? []).map((row: Row) => ({
    id: row.id as string,
    name: row.name as string,
    location: row.location as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
    code: row.code as string,
    organiserId: (row.organiser_id as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    campers: counts.get(row.id as string)?.campers ?? 0,
    items: counts.get(row.id as string)?.items ?? 0,
  }))
}

export interface TripEdit {
  name: string
  location: string
  startsOn: string
  endsOn: string
}

export async function updateTrip(id: string, edit: TripEdit): Promise<void> {
  const { error } = await db()
    .from('trips')
    .update({
      name: edit.name,
      location: edit.location,
      starts_on: edit.startsOn,
      ends_on: edit.endsOn,
    })
    .eq('id', id)
  if (error) throw error
}

/**
 * Archiving is the reversible one and should be the reflex. The Trip stays
 * intact and keeps working for anyone holding the code; it is simply marked as
 * over.
 */
export async function setArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await db()
    .from('trips')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

/**
 * The irreversible one. Cascades through families, campers, items, checks and
 * announcements. The UI makes the caller retype the Trip Code first — not as
 * security, but because a list of a hundred promises is worth one deliberate
 * act to destroy.
 */
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await db().from('trips').delete().eq('id', id)
  if (error) throw error
}
