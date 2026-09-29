import type {
  Announcement,
  Camper,
  Family,
  FamilyCheck,
  FamilyObligationId,
  Item,
  Trip,
} from '../domain/types'
import { SEED_CAMPERS, SEED_FAMILIES, SEED_ITEMS, SEED_TRIP } from './seedTrip'
import { activeClient, clientForCode, isRemote } from './supabase'

/** Everything one Trip screen needs, fetched together. */
export interface TripSnapshot {
  trip: Trip
  families: Family[]
  campers: Camper[]
  items: Item[]
  checks: FamilyCheck[]
  announcements: Announcement[]
}

export interface CreateTripInput {
  name: string
  location: string
  startsOn: string
  endsOn: string
  code: string
  /** One Family per name. A household is represented by whoever writes in the chat. */
  camperNames: string[]
}

export interface Repo {
  load(code: string): Promise<TripSnapshot | null>
  create(input: CreateTripInput): Promise<TripSnapshot>
  /** `camperId === null` releases the Claim. */
  setClaim(itemId: string, camperId: string | null): Promise<void>
  addItem(item: Item): Promise<void>
  /** Bulk write, used only by import. One insert, not ninety round trips. */
  addItems(items: Item[]): Promise<void>
  /**
   * New arrivals found in a pasted message. One Family per name, matching
   * `create` — a household is represented by whoever writes in the chat.
   */
  addCampers(tripId: string, names: string[]): Promise<{ families: Family[]; campers: Camper[] }>
  /**
   * Claiming the Organiser role. Done once, by the person who just created the
   * Trip, as soon as they say which of the names is theirs.
   */
  setOrganiser(tripId: string, camperId: string): Promise<void>
  setFamilyCheck(
    tripId: string,
    familyId: string,
    obligationId: FamilyObligationId,
    confirmed: boolean,
  ): Promise<void>
}

const STORAGE_KEY = 'camping/local-trips'

type LocalStore = Record<string, TripSnapshot>

function readStore(): LocalStore {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as LocalStore
    } catch {
      // A corrupt blob is not worth recovering; fall through to the seed.
    }
  }
  return {
    [SEED_TRIP.code]: {
      trip: SEED_TRIP,
      families: SEED_FAMILIES,
      campers: SEED_CAMPERS,
      items: SEED_ITEMS,
      checks: [],
      announcements: [],
    },
  }
}

function writeStore(store: LocalStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function mutate(code: string, change: (snapshot: TripSnapshot) => TripSnapshot): void {
  const store = readStore()
  const key = Object.keys(store).find((k) => k.toUpperCase() === code.toUpperCase())
  if (!key) return
  store[key] = change(store[key])
  writeStore(store)
}

/** The Trip a local write belongs to, remembered so writes need no code argument. */
let activeCode: string | null = null

/**
 * Runs the whole app against localStorage and the seeded real list. This is a
 * development convenience, not the offline story — offline is read-only from
 * the last synced snapshot (ADR-0003).
 */
export const localRepo: Repo = {
  async load(code) {
    const store = readStore()
    const key = Object.keys(store).find((k) => k.toUpperCase() === code.toUpperCase())
    if (!key) return null
    activeCode = key
    return store[key]
  },
  async create(input) {
    const tripId = `t-${Date.now()}`
    const families = input.camperNames.map((name, i) => ({
      id: `${tripId}-f${i + 1}`,
      name,
      adults: 2,
      children: 0,
    }))
    const snapshot: TripSnapshot = {
      trip: {
        id: tripId,
        name: input.name,
        location: input.location,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        code: input.code,
        organiserId: null,
        archivedAt: null,
      },
      families,
      campers: input.camperNames.map((name, i) => ({
        id: `${tripId}-c${i + 1}`,
        name,
        familyId: families[i].id,
      })),
      items: [],
      checks: [],
      announcements: [],
    }
    const store = readStore()
    store[input.code] = snapshot
    writeStore(store)
    activeCode = input.code
    return snapshot
  },
  async setClaim(itemId, camperId) {
    if (!activeCode) return
    mutate(activeCode, (snapshot) => ({
      ...snapshot,
      items: snapshot.items.map((i) =>
        i.id === itemId
          ? { ...i, claimedBy: camperId, claimedAt: camperId ? new Date().toISOString() : null }
          : i,
      ),
    }))
  },
  async addItem(item) {
    if (!activeCode) return
    mutate(activeCode, (snapshot) => ({ ...snapshot, items: [...snapshot.items, item] }))
  },
  async addItems(items) {
    if (!activeCode || items.length === 0) return
    mutate(activeCode, (snapshot) => ({ ...snapshot, items: [...snapshot.items, ...items] }))
  },
  async addCampers(tripId, names) {
    const stamp = Date.now()
    const families = names.map((name, i) => ({
      id: `${tripId}-f${stamp}-${i}`,
      name,
      adults: 2,
      children: 0,
    }))
    const campers = names.map((name, i) => ({
      id: `${tripId}-c${stamp}-${i}`,
      name,
      familyId: families[i].id,
    }))
    if (activeCode && names.length > 0) {
      mutate(activeCode, (snapshot) => ({
        ...snapshot,
        families: [...snapshot.families, ...families],
        campers: [...snapshot.campers, ...campers],
      }))
    }
    return { families, campers }
  },
  async setOrganiser(tripId, camperId) {
    // By Trip id rather than `activeCode`: this runs straight after `create`,
    // before anyone has joined, so there is no active Trip yet.
    const store = readStore()
    const key = Object.keys(store).find((k) => store[k].trip.id === tripId)
    if (!key) return
    store[key] = { ...store[key], trip: { ...store[key].trip, organiserId: camperId } }
    writeStore(store)
  },
  async setFamilyCheck(tripId, familyId, obligationId, confirmed) {
    if (!activeCode) return
    mutate(activeCode, (snapshot) => {
      const others = snapshot.checks.filter(
        (c) => !(c.familyId === familyId && c.obligationId === obligationId),
      )
      return {
        ...snapshot,
        checks: confirmed
          ? [...others, { tripId, familyId, obligationId, confirmedAt: new Date().toISOString() }]
          : others,
      }
    })
  },
}

export const supabaseRepo: Repo = {
  async load(code) {
    const db = clientForCode(code.toUpperCase())
    const { data: trip } = await db
      .from('trips')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle()
    if (!trip) return null

    const [families, campers, items, checks, announcements] = await Promise.all([
      db.from('families').select('*').eq('trip_id', trip.id),
      db.from('campers').select('*').eq('trip_id', trip.id),
      db.from('items').select('*').eq('trip_id', trip.id),
      db.from('family_checks').select('*').eq('trip_id', trip.id),
      db.from('announcements').select('*').eq('trip_id', trip.id).order('created_at'),
    ])

    return {
      trip: fromRow<Trip>(trip),
      families: (families.data ?? []).map(fromRow<Family>),
      campers: (campers.data ?? []).map(fromRow<Camper>),
      items: (items.data ?? []).map(fromRow<Item>),
      checks: (checks.data ?? []).map(fromRow<FamilyCheck>),
      announcements: (announcements.data ?? []).map(fromRow<Announcement>),
    }
  },
  async create(input) {
    const db = clientForCode(input.code.toUpperCase())
    const { data: trip, error } = await db
      .from('trips')
      .insert({
        name: input.name,
        location: input.location,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        code: input.code,
      })
      .select()
      .single()
    if (error || !trip) throw error ?? new Error('trip insert failed')

    const { data: familyRows } = await db
      .from('families')
      .insert(input.camperNames.map((name) => ({ trip_id: trip.id, name })))
      .select()

    const rows = familyRows ?? []
    const { data: camperRows } = await db
      .from('campers')
      .insert(
        input.camperNames.map((name, i) => ({
          trip_id: trip.id,
          family_id: rows[i].id,
          name,
        })),
      )
      .select()

    return {
      trip: fromRow<Trip>(trip),
      families: rows.map(fromRow<Family>),
      campers: (camperRows ?? []).map(fromRow<Camper>),
      items: [],
      checks: [],
      announcements: [],
    }
  },
  async setClaim(itemId, camperId) {
    await activeClient()
      .from('items')
      .update({
        claimed_by: camperId,
        claimed_at: camperId ? new Date().toISOString() : null,
      })
      .eq('id', itemId)
  },
  async addItem(item) {
    await activeClient().from('items').insert(toRow(item))
  },
  async addItems(items) {
    if (items.length === 0) return
    await activeClient().from('items').insert(items.map(toRow))
  },
  async addCampers(tripId, names) {
    if (names.length === 0) return { families: [], campers: [] }
    const db = activeClient()
    const { data: familyRows } = await db
      .from('families')
      .insert(names.map((name) => ({ trip_id: tripId, name })))
      .select()

    const rows = familyRows ?? []
    const { data: camperRows } = await db
      .from('campers')
      .insert(
        names.map((name, i) => ({ trip_id: tripId, family_id: rows[i].id, name })),
      )
      .select()

    return {
      families: rows.map(fromRow<Family>),
      campers: (camperRows ?? []).map(fromRow<Camper>),
    }
  },
  async setOrganiser(tripId, camperId) {
    // A row-level security denial on UPDATE is not an error: Postgres matches
    // no rows, PostgREST returns 200, and the write vanishes. So check the
    // affected rows rather than just `error`, or the next missing policy will
    // be just as invisible as this one was.
    const { data, error } = await activeClient()
      .from('trips')
      .update({ organiser_id: camperId })
      .eq('id', tripId)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new Error('setOrganiser changed nothing (row-level security?)')
  },
  async setFamilyCheck(tripId, familyId, obligationId, confirmed) {
    if (confirmed) {
      await activeClient().from('family_checks').upsert({
        trip_id: tripId,
        family_id: familyId,
        obligation_id: obligationId,
        confirmed_at: new Date().toISOString(),
      })
    } else {
      await activeClient()
        .from('family_checks')
        .delete()
        .match({ trip_id: tripId, family_id: familyId, obligation_id: obligationId })
    }
  },
}

/** Postgres is snake_case, the domain is camelCase. The seam lives here only. */
function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v
  }
  return out as T
}

function toRow(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    out[k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())] = v
  }
  return out
}

export const repo: Repo = isRemote ? supabaseRepo : localRepo
