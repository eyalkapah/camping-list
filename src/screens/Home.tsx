import { useMemo, useState } from 'react'
import type { TripSnapshot } from '../data/repo'
import { BASELINE } from '../data/baseline'
import { CATEGORIES, FAMILY_OBLIGATIONS } from '../data/catalog'
import {
  byCategory,
  duplicateGroups,
  exportToWhatsApp,
  findFamilyGaps,
  readiness,
} from '../domain/list'
import { parseSingleItem } from '../domain/parse'
import { formatDateRange } from '../domain/dates'
import type { CategoryId, Item } from '../domain/types'

/**
 * The list screen: A2 variant D on top (one sentence, naming the single most
 * urgent thing), A1 variant A below it (accordion by category), with A3
 * variant B on every row (an explicit `אני` button — never a row tap, see
 * ADR-0006).
 */
export function Home({
  snapshot,
  camperId,
  onClaim,
  onAdd,
  onImport,
}: {
  snapshot: TripSnapshot
  camperId: string
  onClaim: (itemId: string, camperId: string | null) => void
  /** Anyone may add one Item; only the Organiser may bulk-import. */
  onAdd: (text: string, categoryId: CategoryId | null, claim: boolean) => void
  /** Absent for everyone but the Organiser — import is a bulk write. */
  onImport?: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { items, campers, families, checks, trip } = snapshot
  const nameOf = useMemo(
    () => new Map(campers.map((c) => [c.id, c.name])),
    [campers],
  )

  const state = useMemo(() => {
    const familyGaps = findFamilyGaps(families, FAMILY_OBLIGATIONS, checks)
    return {
      ...readiness(items, BASELINE, familyGaps),
      sections: byCategory(items),
      dupes: duplicateGroups(items),
    }
  }, [items, families, checks])

  const duplicateKeys = useMemo(
    () => new Set(state.dupes.map((d) => d.mergeKey)),
    [state.dupes],
  )

  function share() {
    const text = exportToWhatsApp(items, campers, state.gaps)
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="screen">
      <header className="trip-head">
        <h1>{trip.name}</h1>
        <p className="muted small">
          {trip.location} ·{' '}
          <bdi dir="ltr">{formatDateRange(trip.startsOn, trip.endsOn)}</bdi>
        </p>
      </header>

      <p className="headline">{state.headline}</p>

      {state.gaps.length > 0 && (
        <details className="gaps">
          <summary>מה עוד חסר ({state.gaps.length})</summary>
          <ul>
            {state.gaps.map((g) => (
              <li key={g.entry.mergeKey}>
                <b>{g.entry.name}</b>
                <span className="muted small"> — {g.entry.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {state.dupes.length > 0 && (
        <p className="note">
          {state.dupes.length} דברים מגיעים פעמיים. לא נורא — רק שתדעו.
        </p>
      )}

      {state.sections.map((section) => {
        const isOpen = open === section.id
        return (
          <section key={section.id} className={`cat ${isOpen ? 'open' : ''}`}>
            <button className="cat-head" onClick={() => setOpen(isOpen ? null : section.id)}>
              <span className="chev">{isOpen ? '⌄' : '‹'}</span>
              <span className="cat-name">{section.name}</span>
              <span className="cat-count">
                {section.unclaimedCount > 0 ? (
                  <em className="warn">{section.unclaimedCount} בלי אחראי</em>
                ) : (
                  <span className="muted">{section.items.length}</span>
                )}
              </span>
            </button>

            {isOpen && (
              <ul className="items">
                {section.items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    mine={item.claimedBy === camperId}
                    owner={item.claimedBy ? (nameOf.get(item.claimedBy) ?? '') : null}
                    duplicate={duplicateKeys.has(item.mergeKey ?? '')}
                    onClaim={onClaim}
                    camperId={camperId}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <AddItem onAdd={onAdd} />

      <button className="share" onClick={share}>
        {copied ? 'הועתק — הדביקו בקבוצה' : 'העתקה לוואטסאפ'}
      </button>
      {onImport && (
        <button className="share" onClick={onImport}>
          הוספה מהוואטסאפ
        </button>
      )}
    </div>
  )
}

/**
 * Adding one thing by hand. Two buttons rather than one, because "I'm bringing
 * this" and "we still need this" are different statements and the app must not
 * guess which was meant — a Claim is always explicit (ADR-0006).
 *
 * The guessed category is shown rather than applied silently, so a wrong guess
 * is visible and one tap from being corrected.
 */
function AddItem({
  onAdd,
}: {
  onAdd: (text: string, categoryId: CategoryId | null, claim: boolean) => void
}) {
  const [text, setText] = useState('')
  const [override, setOverride] = useState<CategoryId | null>(null)

  const guess = useMemo(() => {
    const trimmed = text.trim()
    return trimmed ? (parseSingleItem(trimmed)?.categoryId ?? null) : null
  }, [text])

  const ready = text.trim().length > 0 && guess !== null

  function submit(claim: boolean) {
    if (!ready) return
    onAdd(text.trim(), override, claim)
    setText('')
    setOverride(null)
  }

  return (
    <section className="add-item">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOverride(null)
        }}
        placeholder="מה עוד צריך? למשל: 2 ק״ג נקניקיות"
        aria-label="הוספת פריט"
      />

      {ready && (
        <>
          <label className="add-cat">
            <span className="muted small">קטגוריה</span>
            <select
              value={override ?? guess ?? 'other'}
              onChange={(e) => setOverride(e.target.value as CategoryId)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="add-actions">
            <button className="claim mine" onClick={() => submit(true)}>
              אני מביא
            </button>
            <button className="ghost" onClick={() => submit(false)}>
              רק להוסיף לרשימה
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function Row({
  item,
  mine,
  owner,
  duplicate,
  camperId,
  onClaim,
}: {
  item: Item
  mine: boolean
  owner: string | null
  duplicate: boolean
  camperId: string
  onClaim: (itemId: string, camperId: string | null) => void
}) {
  return (
    <li className={`item ${owner ? '' : 'unclaimed'}`}>
      <span className="item-name">
        {item.name}
        {item.quantity && <span className="qty">{item.quantity}</span>}
        {duplicate && <span className="dup">כפול</span>}
      </span>

      {owner === null ? (
        <button className="claim" onClick={() => onClaim(item.id, camperId)}>
          אני
        </button>
      ) : mine ? (
        <button className="claim mine" onClick={() => onClaim(item.id, null)}>
          אני ✓
        </button>
      ) : (
        <span className="owner">{owner}</span>
      )}
    </li>
  )
}
