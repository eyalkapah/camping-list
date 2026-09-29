import { useCallback, useEffect, useState } from 'react'
import { repo, type TripSnapshot } from '../data/repo'
import { planImport, toItems } from '../domain/importPlan'
import type { Suggestion } from '../domain/parse'
import type { FamilyObligationId, Item } from '../domain/types'

const SESSION_KEY = 'camping/session'

export interface Session {
  code: string
  camperId: string
}

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

/**
 * The whole app's state. One Trip is loaded at a time, kept in memory, and
 * written through to the repo — the group is eleven families, so there is
 * nothing here worth a cache layer.
 */
export function useTrip() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [result, setResult] = useState<{ code: string; snapshot: TripSnapshot | null } | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    void repo.load(session.code).then((snapshot) => {
      if (!cancelled) setResult({ code: session.code, snapshot })
    })
    return () => {
      cancelled = true
    }
  }, [session])

  // Derived rather than stored, so a session change reads as "loading" on the
  // same render that caused it.
  const status: 'idle' | 'loading' | 'ready' | 'missing' = !session
    ? 'idle'
    : result?.code !== session.code
      ? 'loading'
      : result.snapshot
        ? 'ready'
        : 'missing'

  const snapshot = result?.code === session?.code ? (result?.snapshot ?? null) : null

  const setSnapshot = useCallback(
    (update: (current: TripSnapshot) => TripSnapshot) => {
      setResult((current) =>
        current?.snapshot ? { ...current, snapshot: update(current.snapshot) } : current,
      )
    },
    [],
  )

  const join = useCallback((code: string, camperId: string) => {
    const next = { code: code.toUpperCase(), camperId }
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setSession(next)
  }, [])

  const leave = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setResult(null)
  }, [])

  /** Optimistic: the claim appears instantly, then persists. */
  const setClaim = useCallback(
    (itemId: string, camperId: string | null) => {
      setSnapshot((current) => ({
        ...current,
        items: current.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                claimedBy: camperId,
                claimedAt: camperId ? new Date().toISOString() : null,
              }
            : i,
        ),
      }))
      void repo.setClaim(itemId, camperId)
    },
    [setSnapshot],
  )

  const addItem = useCallback(
    (item: Item) => {
      setSnapshot((current) => ({ ...current, items: [...current.items, item] }))
      void repo.addItem(item)
    },
    [setSnapshot],
  )

  /**
   * A reviewed paste, landing on a Trip that already exists. People named in the
   * message who are not on the Trip get a Family and a Camper first, so their
   * lines arrive already claimed rather than as an anonymous pile.
   */
  const importSuggestions = useCallback(
    async (accepted: Suggestion[], people: string[]) => {
      const current = result?.snapshot
      if (!current) return
      const tripId = current.trip.id

      const { newNames } = planImport(
        { suggestions: accepted, people },
        current.campers,
        current.items,
      )

      const added =
        newNames.length > 0
          ? await repo.addCampers(tripId, newNames)
          : { families: [], campers: [] }

      const campers = [...current.campers, ...added.campers]
      const items = toItems(tripId, campers, accepted, session?.camperId ?? 'import')
      await repo.addItems(items)

      setSnapshot((snapshot) => ({
        ...snapshot,
        families: [...snapshot.families, ...added.families],
        campers,
        items: [...snapshot.items, ...items],
      }))
    },
    [result?.snapshot, session?.camperId, setSnapshot],
  )

  const setFamilyCheck = useCallback(
    (familyId: string, obligationId: FamilyObligationId, confirmed: boolean) => {
      setSnapshot((current) => {
        const others = current.checks.filter(
          (c) => !(c.familyId === familyId && c.obligationId === obligationId),
        )
        return {
          ...current,
          checks: confirmed
            ? [
                ...others,
                {
                  tripId: current.trip.id,
                  familyId,
                  obligationId,
                  confirmedAt: new Date().toISOString(),
                },
              ]
            : others,
        }
      })
      const tripId = snapshot?.trip.id
      if (tripId) void repo.setFamilyCheck(tripId, familyId, obligationId, confirmed)
    },
    [setSnapshot, snapshot?.trip.id],
  )

  return {
    session,
    snapshot,
    status,
    join,
    leave,
    setClaim,
    addItem,
    importSuggestions,
    setFamilyCheck,
  }
}
