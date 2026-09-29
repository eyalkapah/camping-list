import { useMemo, useState } from 'react'
import { repo } from '../data/repo'
import { formatTripCode, generateTripCode, joinLink } from '../domain/code'
import { toItems } from '../domain/importPlan'
import { needsAttention, parseMessage } from '../domain/parse'
import type { Suggestion } from '../domain/parse'
import type { Camper } from '../domain/types'
import { ImportReview } from './ImportReview'

/**
 * Creating a Trip. Done once by whoever starts the year's trip; everyone else
 * only ever sees the Join screen.
 *
 * The code is generated, never typed. A code someone chooses is a naming
 * convention (`CAMP25`, `CAMP26`) and the code is the only credential — see
 * `src/domain/code.ts` and ADR-0002.
 *
 * There is one text box, not two. Paste last year's WhatsApp message and it
 * yields the Roster *and* the list; type bare names and it yields the Roster
 * alone. Nobody should type eleven Hebrew names on a phone when those names
 * are already inside the message they are about to paste.
 */
export function NewTrip({
  onCreated,
  onCancel,
}: {
  onCreated: (code: string, camperId: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('קמפינג')
  const [where, setWhere] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pasted, setPasted] = useState('')
  const [code] = useState(generateTripCode)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [created, setCreated] = useState<{ tripId: string; campers: Camper[] } | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => parseMessage(pasted), [pasted])
  const isMessage = parsed.people.length > 0

  /** Bare names, one per line — the fallback when there is no message to paste. */
  const typedNames = useMemo(
    () =>
      isMessage
        ? []
        : pasted
            .split(/[\n,]/)
            .map((n) => n.trim())
            .filter(Boolean),
    [pasted, isMessage],
  )

  const roster = isMessage ? parsed.people : typedNames
  const attention = parsed.suggestions.filter(needsAttention).length

  async function create(accepted: Suggestion[]) {
    if (roster.length === 0 || busy) return
    setBusy(true)
    try {
      const snapshot = await repo.create({
        name: name.trim() || 'קמפינג',
        location: where.trim(),
        startsOn: from,
        endsOn: to || from,
        code,
        camperNames: roster,
      })
      if (accepted.length > 0)
        await repo.addItems(
          toItems(snapshot.trip.id, snapshot.campers, accepted, snapshot.campers[0].id),
        )
      setCreated({ tripId: snapshot.trip.id, campers: snapshot.campers })
    } finally {
      setBusy(false)
    }
  }

  function copy(what: 'link' | 'code') {
    const text = what === 'link' ? joinLink(code) : formatTripCode(code)
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(null), 2500)
    })
  }

  if (created) {
    return (
      <div className="screen join">
        <h1>הטיול נוצר</h1>

        <p className="field-label">מי אתם?</p>
        <p className="muted small">
          מי שיוצר את הטיול מנהל אותו — רק הוא יכול להוסיף רשימה מהוואטסאפ.
        </p>
        <div className="name-grid">
          {created.campers.map((c) => (
            <button
              key={c.id}
              className={me === c.id ? 'name on' : 'name'}
              onClick={() => {
                setMe(c.id)
                void repo.setOrganiser(created.tripId, c.id)
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="lede" style={{ marginTop: 22 }}>
          שלחו את הקישור לקבוצה. מי שילחץ עליו ייכנס בלי להקליד כלום — הקוד כבר בתוכו.
        </p>

        <p className="code-display">{formatTripCode(code)}</p>

        <button className="share primary" onClick={() => copy('link')}>
          {copied === 'link' ? 'הועתק — הדביקו בקבוצה' : 'העתקת הקישור'}
        </button>
        <button className="share" onClick={() => copy('code')}>
          {copied === 'code' ? 'הקוד הועתק' : 'העתקת הקוד בלבד'}
        </button>

        <p className="muted small" style={{ marginTop: 18 }}>
          שמרו את הקוד. הוא היחיד שפותח את הטיול, ואי אפשר לשחזר אותו.
        </p>

        <button
          className="share"
          disabled={!me}
          onClick={() => me && onCreated(code, me)}
        >
          {me ? 'כניסה לרשימה' : 'בחרו את השם שלכם'}
        </button>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <ImportReview
        result={parsed}
        busy={busy}
        onBack={() => setStep('form')}
        onConfirm={(accepted) => void create(accepted)}
      />
    )
  }

  return (
    <div className="screen join">
      <h1>טיול חדש</h1>
      <p className="lede">
        הקוד נוצר אוטומטית ואי אפשר לנחש אותו. כל מי שיקבל אותו — בפנים.
      </p>

      <p className="code-display">{formatTripCode(code)}</p>

      <label className="field">
        <span>שם הטיול</span>
        <input className="plain" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span>איפה</span>
        <input
          className="plain"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="מסלול המפלים"
        />
      </label>

      <div className="dates">
        <label className="field">
          <span>מתי</span>
          <input
            className="plain"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span>עד</span>
          <input
            className="plain"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>הדביקו כאן את ההודעה מהקבוצה</span>
        <textarea
          className="plain"
          rows={8}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={
            '1. ג׳ני - קבבים, טחינה, חומוס…\n2. רעות – מחבת, 15 המבורגרים…\n\nאו פשוט שם בכל שורה'
          }
        />
      </label>

      {isMessage ? (
        <p className="note quiet small">
          זיהיתי {parsed.people.length} משפחות ו־{parsed.suggestions.length} פריטים
          {attention > 0 ? `, ${attention} מהם לא לגמרי ברורים.` : '.'} כדאי לעבור עליהם לפני
          ששומרים.
        </p>
      ) : (
        <p className="muted small">
          {roster.length > 0 ? `${roster.length} משפחות` : 'אפשר גם רק שמות — שם בכל שורה'}
        </p>
      )}

      {isMessage ? (
        <button className="share primary" onClick={() => setStep('review')}>
          בדיקת הרשימה
        </button>
      ) : (
        <button
          className="share primary"
          disabled={roster.length === 0 || busy}
          onClick={() => void create([])}
        >
          {busy ? 'רגע…' : 'יצירת הטיול'}
        </button>
      )}
      <button className="share" onClick={onCancel}>
        ביטול
      </button>
    </div>
  )
}
