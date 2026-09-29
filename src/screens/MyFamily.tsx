import { useMemo } from 'react'
import type { TripSnapshot } from '../data/repo'
import { FAMILY_OBLIGATIONS } from '../data/catalog'
import { findFamilyGaps } from '../domain/list'
import type { FamilyObligationId } from '../domain/types'

/**
 * A5 variant C: your own family's five obligations, large and tappable;
 * everyone else as a count only. The app never says *which* family has not
 * confirmed water — chasing stays human (ADR-0006).
 */
export function MyFamily({
  snapshot,
  camperId,
  onToggle,
}: {
  snapshot: TripSnapshot
  camperId: string
  onToggle: (familyId: string, obligationId: FamilyObligationId, confirmed: boolean) => void
}) {
  const { families, campers, checks } = snapshot
  const me = campers.find((c) => c.id === camperId)
  const familyId = me?.familyId ?? ''

  const mine = useMemo(
    () => new Set(checks.filter((c) => c.familyId === familyId).map((c) => c.obligationId)),
    [checks, familyId],
  )
  const rollup = useMemo(
    () => findFamilyGaps(families, FAMILY_OBLIGATIONS, checks),
    [families, checks],
  )

  const done = FAMILY_OBLIGATIONS.filter((o) => mine.has(o.id)).length

  return (
    <div className="screen">
      <header className="trip-head">
        <h1>המשפחה שלי</h1>
        <p className="muted small">
          {done === FAMILY_OBLIGATIONS.length
            ? 'הכול מסומן. אפשר להירגע.'
            : `סימנתם ${done} מתוך ${FAMILY_OBLIGATIONS.length}.`}
        </p>
      </header>

      <ul className="obligations">
        {FAMILY_OBLIGATIONS.map((o) => {
          const on = mine.has(o.id)
          const group = rollup.find((r) => r.obligation.id === o.id)
          return (
            <li key={o.id}>
              <button
                className={`obligation ${on ? 'on' : ''}`}
                onClick={() => onToggle(familyId, o.id, !on)}
              >
                <span className="box">{on ? '✓' : ''}</span>
                <span className="obligation-text">
                  <b>{o.name}</b>
                  {o.hint && <span className="muted small">{o.hint}</span>}
                </span>
              </button>
              {group && group.outstanding > 0 && (
                <p className="muted small rollup">
                  {group.total - group.outstanding} מתוך {group.total} משפחות אישרו
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="note quiet">
        אף אחד לא רואה מי מהמשפחות עוד לא סימן — רק כמה. מי שצריך להזכיר, מזכיר בקבוצה.
      </p>
    </div>
  )
}
