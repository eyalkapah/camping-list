import { useCallback, useEffect, useState } from 'react'
import {
  currentAdmin,
  deleteTrip,
  listTrips,
  NoBackendError,
  sendMagicLink,
  setArchived,
  signOut,
  updateTrip,
  type AdminSession,
  type TripSummary,
} from '../data/adminRepo'
import { formatTripCode } from '../domain/code'
import { isRemote } from '../data/supabase'

/**
 * The super admin screen (ADR-0009), reached at `?admin=1`.
 *
 * Deliberately plain and in English-ish structure but Hebrew copy, like the
 * rest of the app. It is the only screen behind a real login, and the only one
 * that can see more than a single Trip.
 */
export function Admin({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  // `isRemote` is a build-time constant, so the "nothing to check" case is
  // initial state rather than an effect.
  const [checked, setChecked] = useState(!isRemote)
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<TripSummary | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [deleting, setDeleting] = useState<TripSummary | null>(null)

  const refresh = useCallback(async () => {
    try {
      setTrips(await listTrips())
      setError(null)
    } catch {
      setError('לא הצלחנו לטעון את הטיולים.')
    }
  }, [])

  useEffect(() => {
    if (!isRemote) return
    void currentAdmin()
      .then((s) => {
        setSession(s)
        if (s?.isSuperAdmin) return refresh()
      })
      .finally(() => setChecked(true))
  }, [refresh])

  if (!isRemote) {
    return (
      <Shell onExit={onExit}>
        <p className="note">
          המסך הזה עובד רק מול Supabase. כרגע האפליקציה רצה על הדפדפן בלבד, בלי בסיס נתונים,
          ואין לה טיולים לנהל.
        </p>
      </Shell>
    )
  }

  if (!checked) return <Shell onExit={onExit}>טוען…</Shell>

  if (!session) {
    return (
      <Shell onExit={onExit}>
        <p className="muted">
          ניהול כללי. להבדיל משאר האפליקציה, כאן נדרשת התחברות אמיתית — קוד טיול לא מספיק.
        </p>
        {sent ? (
          <p className="note">שלחנו קישור לכתובת {email}. פתחו אותו מאותו הדפדפן.</p>
        ) : (
          <>
            <label className="field">
              <span>אימייל</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                autoComplete="email"
              />
            </label>
            <button
              className="share primary"
              disabled={!email.includes('@') || busy}
              onClick={() => {
                setBusy(true)
                sendMagicLink(email)
                  .then(() => setSent(true))
                  .catch((e) =>
                    setError(
                      e instanceof NoBackendError
                        ? 'אין חיבור לבסיס הנתונים.'
                        : 'לא הצלחנו לשלוח את הקישור.',
                    ),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              {busy ? 'שולח…' : 'שליחת קישור כניסה'}
            </button>
          </>
        )}
        {error && <p className="warn">{error}</p>}
      </Shell>
    )
  }

  if (!session.isSuperAdmin) {
    return (
      <Shell onExit={onExit}>
        <p className="note">
          נכנסתם כ־{session.email}, אבל החשבון הזה אינו מנהל כללי. הרשאה ניתנת רק ישירות
          בבסיס הנתונים.
        </p>
        <button className="share" onClick={() => void signOut().then(() => setSession(null))}>
          יציאה
        </button>
      </Shell>
    )
  }

  return (
    <Shell onExit={onExit}>
      <p className="muted small">
        {session.email} · {trips?.length ?? 0} טיולים
      </p>
      {error && <p className="warn">{error}</p>}

      {trips?.map((trip) => (
        <section className="cat open admin-trip" key={trip.id} data-archived={!!trip.archivedAt}>
          <div className="cat-head">
            <span className="cat-name">
              {trip.name}
              {trip.archivedAt && <span className="dup">בארכיון</span>}
            </span>
            <span className="cat-count muted small">{formatTripCode(trip.code)}</span>
          </div>

          {editing?.id === trip.id ? (
            <TripForm
              trip={editing}
              busy={busy}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSave={() => {
                setBusy(true)
                updateTrip(trip.id, editing)
                  .then(() => setEditing(null))
                  .then(refresh)
                  .catch(() => setError('השמירה נכשלה.'))
                  .finally(() => setBusy(false))
              }}
            />
          ) : (
            <>
              <p className="muted small import-note">
                {trip.location || '—'} ·{' '}
                <bdi dir="ltr">
                  {trip.startsOn}–{trip.endsOn}
                </bdi>{' '}
                · {trip.campers} משתתפים
                · {trip.items} פריטים
              </p>
              <div className="import-actions">
                <button onClick={() => setEditing(trip)}>עריכה</button>
                <button
                  onClick={() => {
                    setBusy(true)
                    setArchived(trip.id, !trip.archivedAt)
                      .then(refresh)
                      .catch(() => setError('הפעולה נכשלה.'))
                      .finally(() => setBusy(false))
                  }}
                >
                  {trip.archivedAt ? 'החזרה מהארכיון' : 'העברה לארכיון'}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setDeleting(trip)
                    setConfirmCode('')
                  }}
                >
                  מחיקה
                </button>
              </div>
            </>
          )}

          {deleting?.id === trip.id && (
            <div className="import-flags admin-delete">
              <p className="warn">
                מחיקה מוחקת גם את {trip.items} הפריטים ואת {trip.campers} המשתתפים. אי אפשר
                לשחזר. הקלידו {formatTripCode(trip.code)} כדי לאשר.
              </p>
              <input
                className="name-edit"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                dir="ltr"
                aria-label="קוד הטיול"
              />
              <div className="import-actions">
                <button
                  className="danger"
                  disabled={
                    busy ||
                    confirmCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() !==
                      trip.code.toUpperCase()
                  }
                  onClick={() => {
                    setBusy(true)
                    deleteTrip(trip.id)
                      .then(() => setDeleting(null))
                      .then(refresh)
                      .catch(() => setError('המחיקה נכשלה.'))
                      .finally(() => setBusy(false))
                  }}
                >
                  מחיקה סופית
                </button>
                <button onClick={() => setDeleting(null)}>ביטול</button>
              </div>
            </div>
          )}
        </section>
      ))}

      {trips?.length === 0 && <p className="note quiet">אין טיולים.</p>}

      <button className="share" onClick={() => void signOut().then(() => setSession(null))}>
        יציאה מהניהול
      </button>
    </Shell>
  )
}

function TripForm({
  trip,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  trip: TripSummary
  busy: boolean
  onChange: (next: TripSummary) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ padding: '10px 14px' }}>
      <label className="field">
        <span>שם</span>
        <input value={trip.name} onChange={(e) => onChange({ ...trip, name: e.target.value })} />
      </label>
      <label className="field">
        <span>מקום</span>
        <input
          value={trip.location}
          onChange={(e) => onChange({ ...trip, location: e.target.value })}
        />
      </label>
      <label className="field">
        <span>מתאריך</span>
        <input
          type="date"
          value={trip.startsOn}
          onChange={(e) => onChange({ ...trip, startsOn: e.target.value })}
        />
      </label>
      <label className="field">
        <span>עד תאריך</span>
        <input
          type="date"
          value={trip.endsOn}
          onChange={(e) => onChange({ ...trip, endsOn: e.target.value })}
        />
      </label>
      <div className="import-actions">
        <button disabled={busy} onClick={onSave}>
          שמירה
        </button>
        <button onClick={onCancel}>ביטול</button>
      </div>
    </div>
  )
}

function Shell({ children, onExit }: { children: React.ReactNode; onExit: () => void }) {
  return (
    <div className="screen">
      <div className="trip-head">
        <h1>ניהול כללי</h1>
      </div>
      {children}
      <button className="share" onClick={onExit} style={{ marginTop: 18 }}>
        חזרה לאפליקציה
      </button>
    </div>
  )
}
