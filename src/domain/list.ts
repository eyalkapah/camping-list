import type {
  BaselineEntry,
  Camper,
  CategoryId,
  DuplicateGroup,
  Family,
  FamilyCheck,
  FamilyObligation,
  Item,
} from './types'
import { CATEGORIES } from '../data/catalog'

/**
 * Pure list logic. No React, no network, no dates beyond what is passed in —
 * this module is the part of the app worth being sure about, and the part the
 * import prototype's reducer graduated into.
 */

const QUOTES = /[״"'׳’']/g
const NOISE = /[().,!?]/g

/** Loose comparison form. Used for matching, never for display. */
export function normalise(name: string): string {
  return name.trim().replace(QUOTES, '').replace(NOISE, '').replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Merge Keys are deliberately conservative (ADR-0004, amended): two Items share
 * one only when they are certainly the same thing. The real message contains
 * `סכין חדה` next to `סכינים חד״פ`, and `חלב` next to `חלב סויה` — a clever
 * matcher merges those and quietly deletes a real requirement. A missed
 * duplicate costs one spare bottle of cola; a false merge costs the coffee.
 */
export function sameThing(a: string, b: string): boolean {
  return normalise(a) === normalise(b)
}

/** Items nobody has promised to bring. The unit of "missing". */
export function unclaimed(items: Item[]): Item[] {
  return items.filter((i) => i.claimedBy === null)
}

export function claimedBy(items: Item[], camperId: string): Item[] {
  return items.filter((i) => i.claimedBy === camperId)
}

/**
 * The same thing being brought twice without anyone noticing. Only counts when
 * the claimants differ — one Camper listing cola twice is their own business.
 */
export function duplicateGroups(items: Item[]): DuplicateGroup[] {
  const buckets = new Map<string, Item[]>()
  for (const item of items) {
    if (item.claimedBy === null) continue
    const key = item.mergeKey ?? normalise(item.name)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const groups: DuplicateGroup[] = []
  for (const [mergeKey, bucket] of buckets) {
    const claimants = [...new Set(bucket.map((i) => i.claimedBy as string))]
    if (claimants.length > 1) groups.push({ mergeKey, items: bucket, claimants })
  }
  return groups
}

export interface Gap {
  entry: BaselineEntry
  /** `missing` — nobody listed it at all. `unclaimed` — listed, nobody took it. */
  kind: 'missing' | 'unclaimed'
  /** Lower is more urgent; derived from Baseline order. */
  rank: number
}

/**
 * The Baseline measured against the Trip's Items. Deterministic and always on;
 * the model layer only ever adds Suggestions on top of this (ADR-0004).
 */
export function findGaps(items: Item[], baseline: BaselineEntry[]): Gap[] {
  const gaps: Gap[] = []
  baseline.forEach((entry, rank) => {
    const accepted = [entry.mergeKey, entry.name, ...(entry.anyOf ?? [])]
    const matches = items.filter((item) =>
      accepted.some(
        (a) => sameThing(item.mergeKey ?? item.name, a) || sameThing(item.name, a),
      ),
    )
    if (matches.length === 0) gaps.push({ entry, kind: 'missing', rank })
    else if (matches.every((i) => i.claimedBy === null))
      gaps.push({ entry, kind: 'unclaimed', rank })
  })
  return gaps.sort((a, b) => a.rank - b.rank)
}

export interface FamilyGap {
  obligation: FamilyObligation
  /** How many Families have not confirmed it. Never *which* — ADR-0006. */
  outstanding: number
  total: number
}

export function findFamilyGaps(
  families: Family[],
  obligations: FamilyObligation[],
  checks: FamilyCheck[],
): FamilyGap[] {
  return obligations.map((obligation) => {
    const confirmed = new Set(
      checks.filter((c) => c.obligationId === obligation.id).map((c) => c.familyId),
    )
    return {
      obligation,
      outstanding: families.filter((f) => !confirmed.has(f.id)).length,
      total: families.length,
    }
  })
}

export interface Readiness {
  unclaimedCount: number
  gaps: Gap[]
  duplicates: DuplicateGroup[]
  /** One sentence, the whole readiness surface (A2-D). */
  headline: string
}

/**
 * A count with no next action gets ignored, so the headline always names the
 * single most urgent thing rather than reporting a percentage.
 *
 * An empty Trip is special-cased. A gap is the Baseline *measured against a
 * list*, so with no Items there is nothing to measure and `findGaps` would
 * correctly report all 45 entries at once. Correct, and useless: the first
 * thing a new Organiser saw was a wall of demands the group never made. An
 * empty list is not a list with gaps — it is a list that has not started.
 */
export function readiness(
  items: Item[],
  baseline: BaselineEntry[],
  familyGaps: FamilyGap[],
): Readiness {
  if (items.length === 0) {
    return {
      unclaimedCount: 0,
      gaps: [],
      duplicates: [],
      headline: 'הרשימה עוד ריקה. הדביקו את ההודעה מהוואטסאפ, או הוסיפו פריט ראשון.',
    }
  }

  const gaps = findGaps(items, baseline)
  const duplicates = duplicateGroups(items)
  const open = unclaimed(items)
  const behind = familyGaps.filter((g) => g.outstanding > 0)

  let headline: string
  if (gaps.length > 0) {
    const worst = gaps[0]
    headline =
      gaps.length === 1
        ? `חסר דבר אחד: ${worst.entry.name}.`
        : `חסרים ${gaps.length} דברים. הכי דחוף: ${worst.entry.name}.`
  } else if (open.length > 0) {
    headline =
      open.length === 1
        ? `הכול ברשימה. נשאר פריט אחד שאף אחד לא לקח: ${open[0].name}.`
        : `הכול ברשימה. ${open.length} פריטים עדיין בלי מי שיביא אותם.`
  } else if (behind.length > 0) {
    const worst = [...behind].sort((a, b) => b.outstanding - a.outstanding)[0]
    headline = `הרשימה סגורה. ${worst.outstanding} משפחות עוד לא אישרו ${worst.obligation.name}.`
  } else {
    headline = 'הכול מכוסה. נתראה בקמפינג.'
  }

  return { unclaimedCount: open.length, gaps, duplicates, headline }
}

export interface CategorySection {
  id: CategoryId
  name: string
  items: Item[]
  unclaimedCount: number
}

/** Category is the primary organisation of the list (ADR-0005). */
export function byCategory(items: Item[]): CategorySection[] {
  return CATEGORIES.map((c) => {
    const inCategory = items.filter((i) => i.categoryId === c.id)
    return {
      id: c.id,
      name: c.name,
      items: inCategory,
      unclaimedCount: inCategory.filter((i) => i.claimedBy === null).length,
    }
  }).filter((s) => s.items.length > 0)
}

/**
 * Renders the Trip back into the numbered per-person message the group has read
 * for years. It deliberately does not resemble any screen in the app — its job
 * is to be unremarkable to people who never open it (ADR-0005).
 */
export function exportToWhatsApp(items: Item[], campers: Camper[], gaps: Gap[]): string {
  const lines: string[] = []

  campers.forEach((camper) => {
    const mine = claimedBy(items, camper.id)
    if (mine.length === 0) return
    const listed = mine
      .map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name))
      .join(', ')
    lines.push(`${lines.length + 1}. ${camper.name} - ${listed}.`)
  })

  const open = unclaimed(items)
  if (open.length > 0) {
    lines.push('')
    lines.push('*עדיין בלי מי שיביא:*')
    lines.push(open.map((i) => i.name).join(', ') + '.')
  }

  if (gaps.length > 0) {
    lines.push('')
    lines.push('*לא מופיע ברשימה בכלל:*')
    lines.push(gaps.map((g) => g.entry.name).join(', ') + '.')
  }

  return lines.join('\n')
}
