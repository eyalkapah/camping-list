/** Domain types. Names follow CONTEXT.md exactly — change the glossary first. */

export type CategoryId =
  | 'meat'
  | 'produce'
  | 'bread'
  | 'spreads'
  | 'staples'
  | 'drinks'
  | 'alcohol'
  | 'disposables'
  | 'grill'
  | 'kitchen'
  | 'cleaning'
  | 'snacks'
  | 'breakfast'
  | 'other'

export interface Category {
  id: CategoryId
  /** Hebrew label. The app has no second language. */
  name: string
  /** Sort order on the list screen. */
  order: number
}

export interface Camper {
  id: string
  name: string
  familyId: string
}

export interface Family {
  id: string
  name: string
  adults: number
  children: number
}

export interface Item {
  id: string
  tripId: string
  name: string
  categoryId: CategoryId
  /** Free text as written by a human: "2 ק״ג", "15", "שישייה". Never parsed into a number. */
  quantity: string | null
  note: string | null
  /**
   * Canonical grouping name. Two Items share a Merge Key only when they are
   * certainly the same thing — see ADR-0004.
   */
  mergeKey: string | null
  /** The Claim, inlined. `null` means Unclaimed, which is the unit of "missing". */
  claimedBy: string | null
  claimedAt: string | null
  createdBy: string
  createdAt: string
}

/** Two or more Items sharing a Merge Key but claimed by different Campers. */
export interface DuplicateGroup {
  mergeKey: string
  items: Item[]
  claimants: string[]
}

export type FamilyObligationId =
  | 'water'
  | 'familySnacks'
  | 'personalGear'
  | 'warmClothes'
  | 'trailGear'

export interface FamilyObligation {
  id: FamilyObligationId
  name: string
  hint: string | null
}

/** One Family's confirmation of one obligation. Absence means "not confirmed yet". */
export interface FamilyCheck {
  tripId: string
  familyId: string
  obligationId: FamilyObligationId
  confirmedAt: string
}

export interface Announcement {
  id: string
  tripId: string
  body: string
  author: string
  createdAt: string
  pinned: boolean
}

export interface Trip {
  id: string
  name: string
  location: string
  startsOn: string
  endsOn: string
  /** The only credential. No accounts, no passwords — ADR-0002. */
  code: string
  /**
   * The Camper who created the Trip. The one role in the app: they alone can
   * import a WhatsApp message, because import is a bulk write over everyone
   * else's list. Null until they pick their own name, and never transferable —
   * a trip that outlives its organiser is next year's trip.
   */
  organiserId: string | null
  archivedAt: string | null
}

/** One line of the Baseline: what a trip of this kind is expected to have. */
export interface BaselineEntry {
  mergeKey: string
  name: string
  categoryId: CategoryId
  /** Why it matters, shown when the gap is reported. */
  reason: string
  /**
   * Concrete things that count as satisfying this entry. Some Baseline lines
   * are abstract — nobody writes "בשר למנגל" on a list, they write קבב and
   * פרגיות. Without this, the gap detector reports missing meat at a barbecue.
   */
  anyOf?: string[]
  /** Scales with head count rather than being a single yes/no. */
  perHead?: boolean
}
