import { useState } from 'react'
import { repo } from '../data/repo'
import { formatTripCode, isWellFormedTripCode, normaliseTripCode } from '../domain/code'
import type { Camper } from '../domain/types'

/**
 * A4 variant A: one screen, code and name together. The code arrives
 * pre-filled from the WhatsApp link (`?code=K7RMQXBQ`) so most people only pick
 * a name — but the field stays visible and editable, because the person this
 * screen is designed for will not trust a form they cannot see.
 */
export function Join({
  onJoin,
  onCreate,
}: {
  onJoin: (code: string, camperId: string) => void
  onCreate: () => void
}) {
  const fromLink = new URLSearchParams(location.search).get('code') ?? ''
  const [code, setCode] = useState(normaliseTripCode(fromLink))
  const [campers, setCampers] = useState<Camper[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function lookUp(typed: string) {
    const next = normaliseTripCode(typed)
    setCode(next)
    setError(null)
    if (!isWellFormedTripCode(next)) {
      setCampers(null)
      return
    }
    setBusy(true)
    const snapshot = await repo.load(next)
    setBusy(false)
    if (snapshot) setCampers(snapshot.campers)
    else {
      setCampers(null)
      setError('לא מצאנו טיול עם הקוד הזה. בדקו את ההודעה בקבוצה.')
    }
  }

  return (
    <div className="screen join">
      <h1>מי מביא מה</h1>
      <p className="lede">
        הקוד נמצא בהודעה בקבוצה. אין סיסמה ואין הרשמה — מי שיש לו את הקוד, בפנים.
      </p>

      <label className="field">
        <span>קוד הטיול</span>
        <input
          value={formatTripCode(code)}
          onChange={(e) => void lookUp(e.target.value)}
          placeholder="K7RM-QXBQ"
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
        />
      </label>

      {busy && <p className="muted">מחפש…</p>}
      {error && <p className="warn">{error}</p>}

      {campers && (
        <>
          <p className="field-label">מי אתם?</p>
          <div className="name-grid">
            {campers.map((c) => (
              <button key={c.id} className="name" onClick={() => onJoin(code, c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <p className="muted small">לא מופיעים ברשימה? בקשו ממישהו בקבוצה להוסיף אתכם.</p>
        </>
      )}

      {!campers && (
        <button className="link-button" onClick={onCreate}>
          אין לי קוד — אני מארגן טיול חדש
        </button>
      )}
    </div>
  )
}
