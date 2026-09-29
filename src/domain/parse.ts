import type { CategoryId } from './types'
import { normalise } from './list'

/**
 * Deterministic parser for the group's WhatsApp message (SPEC §4.2).
 *
 * SPEC §4.2 describes an LLM doing this. A regex has no semantics, so where the
 * LLM would guess, this parser *flags* and leaves the decision to the mandatory
 * review screen (ADR-0004). That trade is deliberate: a parser that silently
 * fabricates `קטנות חד״פ` out of `צלחות גדולות וקטנות חד״פ` is worse than one
 * that admits it cannot tell. The model layer can be added later as a second
 * opinion feeding the same review screen.
 *
 * Nothing here is remote, keyed or billable. Import works offline.
 */

export type SuggestionFlag =
  /** `או` or `/` — a choice the bringer makes, never two Items. */
  | 'alt'
  /** An embedded `ו` that might be a separator. Reviewer splits explicitly. */
  | 'compound'
  /** Had parentheses; their content is a quantity or a qualifier. */
  | 'paren'
  /** No quantity on something where the amount decides whether it is enough. */
  | 'vague'
  /** No Category matched, so it landed in `אחר`. */
  | 'catgap'

export interface Suggestion {
  id: string
  /** The name as written on the line that carried it. */
  owner: string
  name: string
  quantity: string | null
  note: string | null
  categoryId: CategoryId
  mergeKey: string
  flags: SuggestionFlag[]
  /** The chunk exactly as it appeared, for the reviewer to check against. */
  raw: string
}

export interface ParseResult {
  /** Owner names, in message order. These become Campers and Families. */
  people: string[]
  suggestions: Suggestion[]
  /** The trailing `באחריות כל משפחה` block — not anyone's Items. */
  familyChecklist: string[]
  /** Lines that looked like content but yielded nothing. Shown, never dropped. */
  unparsed: string[]
}

/**
 * Flags that mean *the parser may have got this wrong* — it might have merged
 * two things, split one thing, or swallowed a qualifier. These need a human.
 *
 * `vague` is deliberately not among them. "How many snacks?" is a question
 * about the group's habits, not about the parse, and the group has run this
 * list for years without answering it. Making it block acceptance would put a
 * third of the message behind a decision nobody needs to make.
 */
export const BLOCKING_FLAGS: SuggestionFlag[] = ['alt', 'compound', 'paren', 'catgap']

export function needsAttention(suggestion: Suggestion): boolean {
  return suggestion.flags.some((f) => BLOCKING_FLAGS.includes(f))
}

export const FLAG_LABEL: Record<SuggestionFlag, string> = {
  alt: 'בחירה — לא לפצל',
  compound: 'אולי שני פריטים',
  paren: 'היה בסוגריים',
  vague: 'בלי כמות',
  catgap: 'בלי קטגוריה',
}

/** WhatsApp sprinkles these through copied text; U+2060 sits before `אייל`. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

const PERSON_LINE = /^(\d+)\s*[.)\]]\s*(.+)$/
const NAME_SPLIT = /\s*[-–—]\s+|\s+[-–—]\s*/
const FAMILY_HEADING = /באחריות\s+כל\s+משפחה/
const BULLET = /^\s*[-–—•*]\s*/

const COUNTED_UNITS = [
  'ק״ג',
  'ק"ג',
  'קילו',
  'גרם',
  'ליטר',
  'מ״ל',
  'יחידות',
  'יחידה',
  'יח׳',
  "יח'",
  'בקבוקים',
  'בקבוקי',
  'בקבוק',
  'קרטוני',
  'קרטון',
  'חבילות',
  'חבילת',
  'חבילה',
  'קופסאות',
  'קופסת',
  'שקיות',
  'שקית',
  'מארז',
  'צנצנת',
]

/**
 * Unit words that carry an implied "one", so they lead without a number.
 * `ערכת` is deliberately absent: `ערכת קפה` is a coffee *kit*, one thing, and
 * treating it as a unit turns it into a second, duplicate `קפה`.
 */
const BARE_UNITS = [
  'חבילה של',
  'חבילת',
  'חבילה',
  'שישיית',
  'שישייה',
  'קרטון',
  'בקבוק',
  'קופסת',
  'שקית',
  'מארז',
  'צנצנת',
]

/**
 * Hebrew final forms. `חטיף` ends in `ף`, but its plural `חטיפים` carries a
 * medial `פ`, so a keyword never matches its own plural unless both sides are
 * folded. This is why eighteen obvious Items first landed in `אחר`.
 *
 * Folding happens here and not in `normalise`, because `normalise` builds Merge
 * Keys and ADR-0004 keeps those conservative.
 */
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' }

function foldFinals(value: string): string {
  return value.replace(/[ךםןףץ]/g, (c) => FINALS[c])
}

/**
 * Ordered — first match wins, so the specific sits above the general.
 * A leading `=` means whole-word: `תה`, `מים` and `לחם` are substrings of too
 * much Hebrew to be trusted loose. Everything else matches as a prefix, so
 * write the stem (`חטיפ`), not the dictionary form (`חטיף`).
 */
const CATEGORY_HINTS: [string, CategoryId][] = [
  // Disposability wins over what the thing is: `סכינים חד״פ` is cutlery to
  // throw away, `סכין חדה` is the knife someone has to remember to bring back.
  ['חדפ', 'disposables'],
  ['רב פעמי', 'disposables'],

  // Grill kit before meat, so `שיפודים` are skewers rather than food.
  ['מנגל', 'grill'],
  ['פחמ', 'grill'],
  ['=רשת', 'grill'],
  ['מלקח', 'grill'],
  ['קוביות הדלקה', 'grill'],
  ['מצית', 'grill'],
  ['שיפוד', 'grill'],
  ['מדורה', 'grill'],
  ['גחל', 'grill'],

  // Equipment before its contents: `ווק לצ׳יפס` is a wok, `ערכת קפה` a kit.
  ['ערכת', 'kitchen'],
  ['=ווק', 'kitchen'],
  ['מחבת', 'kitchen'],
  ['=סיר', 'kitchen'],
  ['קרש חיתוך', 'kitchen'],
  ['סכינ', 'kitchen'],
  ['קער', 'kitchen'],
  ['כפות הגשה', 'kitchen'],
  ['מגבת', 'kitchen'],
  ['פותחנ', 'kitchen'],
  ['אלומיניו', 'kitchen'],
  ['פרנצ', 'kitchen'],

  ['ערק', 'alcohol'],
  ['=יין', 'alcohol'],
  ['ביר', 'alcohol'],
  ['בריזר', 'alcohol'],
  ['ברייזר', 'alcohol'],
  ['וודקה', 'alcohol'],
  ['ויסקי', 'alcohol'],
  ['אלכוהול', 'alcohol'],

  ['קבב', 'meat'],
  ['המבורגר', 'meat'],
  ['נקניק', 'meat'],
  ['פרגי', 'meat'],
  ['לבבות', 'meat'],
  ['בשר', 'meat'],
  ['סטייק', 'meat'],
  ['כנפי', 'meat'],
  ['שווארמה', 'meat'],

  ['פלטת ירקות', 'produce'],
  ['ירק', 'produce'],
  ['פיר', 'produce'],
  ['עגבני', 'produce'],
  ['מלפפונ', 'produce'],
  ['ענב', 'produce'],
  ['לימונ', 'produce'],
  ['אדממה', 'produce'],
  ['חסה', 'produce'],
  ['=בצל', 'produce'],
  ['אבוקדו', 'produce'],
  ['תירס', 'produce'],

  ['קורנפלקס', 'breakfast'],
  ['חלב', 'breakfast'],
  ['שוקו', 'breakfast'],
  ['ביצ', 'breakfast'],
  ['גבינ', 'breakfast'],
  ['ריבה', 'breakfast'],
  ['דגנ', 'breakfast'],
  ['ארוחת הבוקר', 'breakfast'],
  ['ארוחת בוקר', 'breakfast'],
  ['לבוקר', 'breakfast'],

  ['לחמני', 'bread'],
  ['פית', 'bread'],
  ['=לחם', 'bread'],
  ['בגט', 'bread'],
  ['=חלה', 'bread'],

  ['טחינה', 'spreads'],
  ['חומוס', 'spreads'],
  ['ממרח', 'spreads'],
  ['נוטלה', 'spreads'],
  ['קטשופ', 'spreads'],
  ['מיונז', 'spreads'],
  ['חרדל', 'spreads'],
  ['עמבה', 'spreads'],
  ['חריף', 'spreads'],
  ['חציל', 'spreads'],
  ['חמוצ', 'spreads'],

  ['חטיפ', 'snacks'],
  ['ציטוס', 'snacks'],
  ['במבה', 'snacks'],
  ['ביסלי', 'snacks'],
  ['עוג', 'snacks'],
  ['וופל', 'snacks'],
  ['מרשמלו', 'snacks'],
  ['שוקולד', 'snacks'],
  ['קרקר', 'snacks'],
  ['ממתק', 'snacks'],
  ['ציפס', 'snacks'],

  ['קולה', 'drinks'],
  ['סודה', 'drinks'],
  ['תירוש', 'drinks'],
  ['לימונדה', 'drinks'],
  ['מיצ', 'drinks'],
  ['שתיי', 'drinks'],
  ['משקה', 'drinks'],
  ['קפה', 'drinks'],
  ['=תה', 'drinks'],
  ['=מים', 'drinks'],
  ['=קרח', 'drinks'],

  ['צלח', 'disposables'],
  ['כוס', 'disposables'],
  ['מזלג', 'disposables'],
  ['כפי', 'disposables'],
  ['סכומ', 'disposables'],
  ['מפי', 'disposables'],

  ['שקיות אשפה', 'cleaning'],
  ['אשפה', 'cleaning'],
  ['סבונ', 'cleaning'],
  ['סקוצ', 'cleaning'],
  ['נייר סופג', 'cleaning'],
  ['מגבונ', 'cleaning'],
  ['ניקוי', 'cleaning'],

  ['סוכר', 'staples'],
  ['=מלח', 'staples'],
  ['פלפל', 'staples'],
  ['=שמנ', 'staples'],
  ['אורז', 'staples'],
  ['פסטה', 'staples'],
  ['פתית', 'staples'],
  ['=קמח', 'staples'],
  ['תבלינ', 'staples'],
]

/** Categories where "how much" decides whether it is enough. */
const AMOUNT_MATTERS: CategoryId[] = [
  'meat',
  'produce',
  'bread',
  'spreads',
  'snacks',
  'drinks',
  'alcohol',
  'breakfast',
  'disposables',
]

export function categoriseItem(name: string): CategoryId | null {
  const text = foldFinals(normalise(name))
  for (const [keyword, category] of CATEGORY_HINTS) {
    const wholeWord = keyword.startsWith('=')
    const key = foldFinals(normalise(wholeWord ? keyword.slice(1) : keyword))
    if (wholeWord) {
      if (new RegExp(`(^|\\s)${escapeRegExp(key)}($|\\s)`).test(text)) return category
    } else if (text.includes(key)) {
      return category
    }
  }
  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The Hebrew `ו` that closes a comma list ("א, ב וג") is a separator almost
 * every time; the same letter mid-list ("צלחות גדולות וקטנות") usually is not.
 * So it splits in the final chunk only, and flags everywhere else.
 */
function splitTrailingVav(chunk: string): string[] {
  const match = /^(.*\S)\s+ו(?!ו)(\S.*)$/.exec(chunk)
  if (!match) return [chunk]
  if (match[2].replace(/\s+/g, '').length < 2) return [chunk]
  return [match[1], match[2]]
}

function hasEmbeddedVav(chunk: string): boolean {
  return /\S\s+ו(?!ו)\S{2,}/.test(chunk)
}

/** A leading `ו` on a chunk is the list conjunction, not part of the word. */
function stripLeadingVav(chunk: string): string {
  if (chunk.length > 2 && chunk.startsWith('ו') && chunk[1] !== 'ו') return chunk.slice(1)
  return chunk
}

interface Extracted {
  name: string
  quantity: string | null
  note: string | null
  flags: SuggestionFlag[]
}

function extract(chunk: string): Extracted {
  const flags: SuggestionFlag[] = []
  let text = chunk
  let note: string | null = null
  let quantity: string | null = null

  const paren = /\s*[（(]([^)）]*)[)）]\s*/.exec(text)
  if (paren) {
    flags.push('paren')
    const inside = paren[1].trim()
    text = (text.slice(0, paren.index) + ' ' + text.slice(paren.index + paren[0].length)).trim()
    if (/^\d/.test(inside)) quantity = inside
    else note = inside
  }

  if (quantity === null) {
    const units = COUNTED_UNITS.map(escapeRegExp).join('|')
    const counted = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${units})?\\s+(?:של\\s+)?(.+)$`).exec(text)
    if (counted) {
      quantity = counted[2] ? `${counted[1]} ${counted[2]}` : counted[1]
      text = counted[3].trim()
    } else {
      for (const unit of BARE_UNITS) {
        if (text.startsWith(unit + ' ')) {
          quantity = unit === 'חבילה של' ? 'חבילה' : unit
          text = text.slice(unit.length).trim()
          break
        }
      }
    }
  }

  if (/\sאו\s|\//.test(text)) flags.push('alt')

  return { name: text.replace(/\s+/g, ' ').trim(), quantity, note, flags }
}

function isVague(name: string, quantity: string | null, categoryId: CategoryId): boolean {
  if (quantity !== null) return false
  if (!AMOUNT_MATTERS.includes(categoryId)) return false
  return /(ים|ות)$/.test(normalise(name).split(' ')[0])
}

export function parseMessage(input: string): ParseResult {
  const text = input.replace(INVISIBLE, '')
  const lines = text.split(/\r?\n/)

  const people: string[] = []
  const suggestions: Suggestion[] = []
  const familyChecklist: string[] = []
  const unparsed: string[] = []
  let inFamilyBlock = false
  let counter = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (FAMILY_HEADING.test(line)) {
      inFamilyBlock = true
      continue
    }

    if (inFamilyBlock) {
      const entry = line.replace(BULLET, '').trim()
      if (entry) familyChecklist.push(entry)
      continue
    }

    const person = PERSON_LINE.exec(line)
    if (!person) {
      unparsed.push(line)
      continue
    }

    const body = person[2].trim()
    const split = body.search(NAME_SPLIT)
    if (split < 0) {
      unparsed.push(line)
      continue
    }
    const owner = body.slice(0, split).trim()
    const rest = body.slice(split).replace(NAME_SPLIT, '').trim().replace(/[.;]\s*$/, '')
    if (!owner) {
      unparsed.push(line)
      continue
    }
    people.push(owner)

    const chunks = rest
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    chunks.forEach((chunk, index) => {
      const isLast = index === chunks.length - 1
      const cleaned = index === 0 ? chunk : stripLeadingVav(chunk)
      const pieces = isLast ? splitTrailingVav(cleaned) : [cleaned]
      const splitHere = pieces.length > 1

      pieces.forEach((piece) => {
        counter += 1
        const made = makeSuggestion(`s${counter}`, owner, piece, splitHere)
        if (made) suggestions.push(made)
        else counter -= 1
      })
    })
  }

  return { people, suggestions, familyChecklist, unparsed }
}

/** One chunk of a line into one Suggestion. `settled` suppresses the compound
 * flag, because the caller has already decided where the `ו` belongs. */
function makeSuggestion(
  id: string,
  owner: string,
  piece: string,
  settled: boolean,
): Suggestion | null {
  const source = piece.trim().replace(/[.;]\s*$/, '')
  if (!source) return null
  const { name, quantity, note, flags } = extract(source)
  if (!name) return null

  const categoryId = categoriseItem(name) ?? 'other'
  const all = [...flags]
  if (categoryId === 'other') all.push('catgap')
  if (!settled && hasEmbeddedVav(source) && !all.includes('alt')) all.push('compound')
  if (isVague(name, quantity, categoryId)) all.push('vague')

  return {
    id,
    owner,
    name,
    quantity,
    note,
    categoryId,
    mergeKey: normalise(name),
    flags: all,
    raw: source,
  }
}

/**
 * One typed line into one Suggestion, for adding a single Item by hand.
 *
 * Deliberately the same code path as the bulk paste: `2 ק״ג נקניקיות` has to
 * mean the same thing whether it arrives in a WhatsApp message or is typed
 * into the add box. `settled` is true because a person typing one line has
 * already decided it is one thing, so the compound `ו` flag would be noise.
 */
export function parseSingleItem(text: string): Suggestion | null {
  return makeSuggestion('manual', '', text, true)
}

/**
 * The reviewer's explicit split of a `compound` Suggestion. The parser refuses
 * to guess here; this runs only when a human has looked at `צלחות גדולות
 * וקטנות חד״פ` and said yes, that is two things.
 */
export function splitSuggestion(suggestion: Suggestion): [Suggestion, Suggestion] | null {
  const parts = splitTrailingVav(suggestion.name)
  if (parts.length !== 2) return null
  const first = makeSuggestion(`${suggestion.id}a`, suggestion.owner, parts[0], true)
  const second = makeSuggestion(`${suggestion.id}b`, suggestion.owner, parts[1], true)
  if (!first || !second) return null
  return [
    { ...first, quantity: first.quantity ?? suggestion.quantity },
    second,
  ]
}
