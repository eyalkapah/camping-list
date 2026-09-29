import { normalise } from './list'
import type { ParseResult, Suggestion } from './parse'
import type { Camper, Item } from './types'

/**
 * Turning a reviewed import into writes. Shared by creating a Trip and by
 * importing into one that already exists — the second is where the interesting
 * cases live.
 */

/** Same person, same thing. The unit of "we already have this". */
function key(owner: string, mergeKey: string): string {
  return `${normalise(owner)}::${mergeKey}`
}

export interface ImportPlan {
  /** Names in the message with no Camper on the Trip yet. */
  newNames: string[]
  /** Suggestion ids the Trip already holds, claimed by the same person. */
  alreadyHere: Set<string>
}

/**
 * What a paste would do to a Trip that already has a list.
 *
 * Pasting the same message twice is the obvious accident — someone re-sends it
 * to the group, a second organiser imports it again — and without this it
 * silently doubles every row. Matching is by person *and* Merge Key, so two
 * families both bringing cola stays two Items, as it should.
 */
export function planImport(
  result: Pick<ParseResult, 'suggestions' | 'people'>,
  campers: Camper[],
  items: Item[],
): ImportPlan {
  const known = new Set(campers.map((c) => normalise(c.name)))
  const nameOf = new Map(campers.map((c) => [c.id, c.name]))

  const held = new Set<string>()
  for (const item of items) {
    if (!item.claimedBy) continue
    const owner = nameOf.get(item.claimedBy)
    if (!owner) continue
    held.add(key(owner, item.mergeKey ?? normalise(item.name)))
  }

  return {
    newNames: result.people.filter((name) => !known.has(normalise(name))),
    alreadyHere: new Set(
      result.suggestions
        .filter((s) => held.has(key(s.owner, s.mergeKey)))
        .map((s) => s.id),
    ),
  }
}

/**
 * Accepted Suggestions into Items. The owner named on the WhatsApp line becomes
 * the Claim, because that is precisely what the line meant. A Suggestion whose
 * owner has no Camper is kept Unclaimed rather than dropped — losing an Item is
 * worse than losing who promised it — and falls back to `createdBy` for
 * authorship so the row still has a valid author.
 */
export function toItems(
  tripId: string,
  campers: Camper[],
  accepted: Suggestion[],
  createdBy: string,
): Item[] {
  const camperByName = new Map(campers.map((c) => [normalise(c.name), c.id]))
  const now = new Date().toISOString()

  return accepted.map((s) => {
    const owner = camperByName.get(normalise(s.owner)) ?? null
    return {
      id: crypto.randomUUID(),
      tripId,
      name: s.name,
      categoryId: s.categoryId,
      quantity: s.quantity,
      note: s.note,
      mergeKey: s.mergeKey,
      claimedBy: owner,
      claimedAt: owner ? now : null,
      createdBy: owner ?? createdBy,
      createdAt: now,
    }
  })
}
