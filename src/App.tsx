import { useState } from 'react'
import { itemFromText } from './domain/manualItem'
import { Admin } from './screens/Admin'
import { Home } from './screens/Home'
import { ImportToTrip } from './screens/ImportToTrip'
import { Join } from './screens/Join'
import { MyFamily } from './screens/MyFamily'
import { NewTrip } from './screens/NewTrip'
import { useTrip } from './state/useTrip'

export default function App() {
  const {
    session,
    snapshot,
    status,
    join,
    leave,
    setClaim,
    addItem,
    importSuggestions,
    setFamilyCheck,
  } = useTrip()
  const [tab, setTab] = useState<'list' | 'family'>('list')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  // `?admin=1` rather than a route: the app is a single static page on GitHub
  // Pages, and this is also where the magic link comes back to (ADR-0009).
  const [admin, setAdmin] = useState(
    () => new URLSearchParams(location.search).get('admin') === '1',
  )

  if (admin) {
    return (
      <Admin
        onExit={() => {
          history.replaceState(null, '', location.pathname)
          setAdmin(false)
        }}
      />
    )
  }

  if (!session || status === 'missing') {
    return creating ? (
      <NewTrip
        onCancel={() => setCreating(false)}
        onCreated={(code, camperId) => {
          setCreating(false)
          join(code, camperId)
        }}
      />
    ) : (
      <Join onJoin={join} onCreate={() => setCreating(true)} />
    )
  }
  if (status !== 'ready' || !snapshot) {
    return <div className="screen centered muted">טוען…</div>
  }

  // The one role in the app. The Trip's creator, and nobody else, may import.
  const isOrganiser = snapshot.trip.organiserId === session.camperId

  if (importing && isOrganiser) {
    return (
      <ImportToTrip
        snapshot={snapshot}
        onCancel={() => setImporting(false)}
        onDone={async (accepted, people) => {
          await importSuggestions(accepted, people)
          setImporting(false)
        }}
      />
    )
  }

  return (
    <>
      {tab === 'list' ? (
        <Home
          snapshot={snapshot}
          camperId={session.camperId}
          onClaim={setClaim}
          onAdd={(text, categoryId, claim) => {
            const item = itemFromText(
              snapshot.trip.id,
              text,
              session.camperId,
              categoryId,
              claim,
            )
            if (item) addItem(item)
          }}
          onImport={isOrganiser ? () => setImporting(true) : undefined}
        />
      ) : (
        <MyFamily snapshot={snapshot} camperId={session.camperId} onToggle={setFamilyCheck} />
      )}

      <nav className="tabs">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
          הרשימה
        </button>
        <button className={tab === 'family' ? 'on' : ''} onClick={() => setTab('family')}>
          המשפחה שלי
        </button>
        <button onClick={leave} className="exit" title="יציאה">
          ⎋
        </button>
      </nav>
    </>
  )
}
