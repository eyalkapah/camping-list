import { useMemo, useState } from 'react'
import type { TripSnapshot } from '../data/repo'
import { planImport } from '../domain/importPlan'
import { parseMessage } from '../domain/parse'
import type { Suggestion } from '../domain/parse'
import { ImportReview } from './ImportReview'

/**
 * Pasting a WhatsApp message onto a Trip that already exists.
 *
 * The same review screen as creating a Trip, with one addition that matters:
 * anything the Trip already holds for that person is detected and switched off,
 * so re-pasting the group's message — which happens every time someone edits it
 * — tops up the list instead of doubling it.
 */
export function ImportToTrip({
  snapshot,
  onDone,
  onCancel,
}: {
  snapshot: TripSnapshot
  onDone: (accepted: Suggestion[], people: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => parseMessage(text), [text])
  const plan = useMemo(
    () => planImport(parsed, snapshot.campers, snapshot.items),
    [parsed, snapshot.campers, snapshot.items],
  )

  if (reviewing) {
    return (
      <ImportReview
        result={parsed}
        busy={busy}
        alreadyHere={plan.alreadyHere}
        newNames={plan.newNames}
        onBack={() => setReviewing(false)}
        onConfirm={(accepted) => {
          setBusy(true)
          setError(null)
          void onDone(accepted, parsed.people)
            .catch(() => {
              setError('משהו השתבש בשמירה. אפשר לנסות שוב.')
              setReviewing(true)
            })
            .finally(() => setBusy(false))
        }}
      />
    )
  }

  return (
    <div className="screen">
      <div className="trip-head">
        <h1>הוספה מהוואטסאפ</h1>
        <p className="muted">
          הדביקו כאן את ההודעה מהקבוצה. מה שכבר ברשימה לא ייווסף שוב.
        </p>
      </div>

      <label className="field">
        <span>ההודעה</span>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'1. ג׳ני - קבבים, טחינה, חומוס…'}
          dir="rtl"
        />
      </label>

      {parsed.people.length > 0 && (
        <p className="note quiet small">
          זוהו {parsed.people.length} משפחות ו־{parsed.suggestions.length} פריטים.
          {plan.alreadyHere.size > 0 && ` ${plan.alreadyHere.size} מהם כבר ברשימה.`}
        </p>
      )}

      {error && <p className="note">{error}</p>}

      <button
        className="share primary"
        disabled={parsed.people.length === 0}
        onClick={() => setReviewing(true)}
      >
        בדיקת הרשימה
      </button>
      <button className="share" onClick={onCancel}>
        ביטול
      </button>
    </div>
  )
}
