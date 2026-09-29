import { useCallback, useMemo, useState } from 'react'
import { CATEGORIES } from '../data/catalog'
import { normalise } from '../domain/list'
import { FLAG_LABEL, needsAttention, splitSuggestion } from '../domain/parse'
import type { ParseResult, Suggestion } from '../domain/parse'
import type { CategoryId } from '../domain/types'

/**
 * The mandatory review of an import (ADR-0004). Import is a bulk write, and one
 * parse error otherwise corrupts ninety rows silently.
 *
 * It opens on what the parser is unsure about rather than on the whole list,
 * because a hundred-row screen that is 94% correct trains people to press the
 * big button without reading.
 */
export function ImportReview({
  result,
  busy,
  alreadyHere,
  newNames,
  onBack,
  onConfirm,
}: {
  result: ParseResult
  busy: boolean
  /** Suggestion ids the Trip already holds. Excluded by default, not hidden. */
  alreadyHere?: Set<string>
  /** People in the message who are not on the Trip yet. */
  newNames?: string[]
  onBack: () => void
  onConfirm: (accepted: Suggestion[]) => void
}) {
  const [rows, setRows] = useState<Suggestion[]>(result.suggestions)
  const [out, setOut] = useState<Set<string>>(() => new Set(alreadyHere ?? []))

  /**
   * Rows the Trip does not already hold. Keyed on the immutable `alreadyHere`
   * rather than on `out`, so unchecking a row does not make it disappear from
   * under the finger that unchecked it.
   */
  const isNew = useCallback(
    (row: Suggestion) => !alreadyHere?.has(row.id),
    [alreadyHere],
  )

  const attentionRows = useMemo(
    () => rows.filter((r) => needsAttention(r) && isNew(r)),
    [rows, isNew],
  )
  const newRows = useMemo(() => rows.filter(isNew), [rows, isNew])
  const knownCount = alreadyHere?.size ?? 0

  const [filter, setFilter] = useState<'attention' | 'new' | 'all'>(
    attentionRows.length > 0 ? 'attention' : knownCount > 0 ? 'new' : 'all',
  )

  const kept = rows.filter((r) => !out.has(r.id))
  const attentionCount = attentionRows.filter((r) => !out.has(r.id)).length

  const duplicateKeys = useMemo(() => {
    const owners = new Map<string, Set<string>>()
    for (const row of kept) {
      const set = owners.get(row.mergeKey) ?? new Set<string>()
      set.add(row.owner)
      owners.set(row.mergeKey, set)
    }
    return new Set([...owners].filter(([, o]) => o.size > 1).map(([k]) => k))
  }, [kept])

  const shown = filter === 'attention' ? attentionRows : filter === 'new' ? newRows : rows

  const byOwner = useMemo(() => {
    const groups = new Map<string, Suggestion[]>()
    for (const row of shown) {
      const list = groups.get(row.owner) ?? []
      list.push(row)
      groups.set(row.owner, list)
    }
    return [...groups]
  }, [shown])

  function toggle(id: string) {
    setOut((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setCategory(id: string, categoryId: CategoryId) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, categoryId, flags: r.flags.filter((f) => f !== 'catgap') }
          : r,
      ),
    )
  }

  /** Only offered on rows the parser flagged — see the render below. */
  function rename(id: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: value, mergeKey: normalise(value) } : r)),
    )
  }

  function split(id: string) {
    setRows((prev) => {
      const index = prev.findIndex((r) => r.id === id)
      if (index < 0) return prev
      const parts = splitSuggestion(prev[index])
      if (!parts) return prev
      return [...prev.slice(0, index), ...parts, ...prev.slice(index + 1)]
    })
  }

  function keepWhole(id: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, flags: r.flags.filter((f) => f !== 'compound') } : r,
      ),
    )
  }

  function acknowledge(id: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, flags: r.flags.filter((f) => f !== 'paren' && f !== 'alt') }
          : r,
      ),
    )
  }

  return (

    <div className="screen">
      <div className="trip-head">
        <h1>בדיקת הרשימה</h1>
        <p className="muted">
          {kept.length} פריטים ייווספו.{' '}
          {attentionCount > 0
            ? `${attentionCount} מהם לא ברורים — כדאי להסתכל עליהם.`
            : 'הכול ברור. אפשר לאשר.'}
        </p>
      </div>

      {knownCount > 0 && (
        <p className="note quiet small">
          {knownCount} פריטים כבר ברשימה אצל אותם אנשים, אז הם מסומנים כלא־נוספים. אם משהו
          מהם באמת צריך להתווסף פעמיים — אפשר להחזיר אותו ידנית.
        </p>
      )}

      {newNames && newNames.length > 0 && (
        <p className="note quiet small">
          מצטרפים חדשים: {newNames.join(', ')}. הם ייווספו לטיול.
        </p>
      )}

      {duplicateKeys.size > 0 && (
        <p className="note quiet small">
          {duplicateKeys.size} דברים מופיעים אצל יותר מאדם אחד. זה בסדר — הרשימה תסמן אותם
          אחר כך, ואפשר להחליט אז.
        </p>
      )}

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button
          className={filter === 'attention' ? 'on' : ''}
          onClick={() => setFilter('attention')}
        >
          לא ברור ({attentionRows.length})
        </button>
        {knownCount > 0 && (
          <button className={filter === 'new' ? 'on' : ''} onClick={() => setFilter('new')}>
            חדשים ({newRows.length})
          </button>
        )}
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          הכול ({rows.length})
        </button>
      </div>

      {shown.length === 0 && (
        <p className="note quiet">אין כאן כלום. אפשר לעבור ל״הכול״ כדי לעבור על הרשימה.</p>
      )}

      {byOwner.map(([owner, items]) => (
        <section className="cat open" key={owner} style={{ marginBottom: 10 }}>
          <div className="cat-head">
            <span className="cat-name">{owner}</span>
            <span className="cat-count muted small">{items.length}</span>
          </div>
          <ul className="items">
            {items.map((row) => {
              const dropped = out.has(row.id)
              return (
                <li className="import-row" key={row.id} data-out={dropped}>
                  <div className="import-line">
                    <button
                      className={dropped ? 'claim' : 'claim mine'}
                      onClick={() => toggle(row.id)}
                      title={dropped ? 'החזרה לרשימה' : 'הסרה מהרשימה'}
                    >
                      {dropped ? 'החזרה' : '✓'}
                    </button>
                    {row.flags.length > 0 ? (
                      <input
                        className="name-edit"
                        value={row.name}
                        onChange={(e) => rename(row.id, e.target.value)}
                        aria-label="שם הפריט"
                      />
                    ) : (
                      <span className="item-name">
                        {row.name}
                        {row.quantity && <span className="qty">{row.quantity}</span>}
                        {duplicateKeys.has(row.mergeKey) && (
                          <span className="dup">גם אצל אחרים</span>
                        )}
                      </span>
                    )}
                    <select
                      className="cat-select"
                      value={row.categoryId}
                      onChange={(e) => setCategory(row.id, e.target.value as CategoryId)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {row.note && <p className="muted small import-note">{row.note}</p>}

                  {alreadyHere?.has(row.id) && (
                    <div className="import-flags">
                      <span className="flag known">כבר ברשימה אצל {row.owner}</span>
                    </div>
                  )}

                  {row.flags.length > 0 && (
                    <div className="import-flags">
                      {row.flags.map((f) => (
                        <span className="flag" key={f}>
                          {FLAG_LABEL[f]}
                        </span>
                      ))}
                    </div>
                  )}

                  {row.flags.includes('compound') && (
                    <div className="import-actions">
                      <span className="muted small">כתוב כאן ״{row.raw}״ — זה דבר אחד או שניים?</span>
                      <button className="link-button" onClick={() => split(row.id)}>
                        שניים
                      </button>
                      <button className="link-button" onClick={() => keepWhole(row.id)}>
                        אחד
                      </button>
                    </div>
                  )}

                  {(row.flags.includes('alt') || row.flags.includes('paren')) && (
                    <div className="import-actions">
                      <span className="muted small">מקור: ״{row.raw}״</span>
                      <button className="link-button" onClick={() => acknowledge(row.id)}>
                        בסדר
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {result.unparsed.length > 0 && (
        <details className="gaps">
          <summary>{result.unparsed.length} שורות שלא הצלחתי לקרוא</summary>
          <ul>
            {result.unparsed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      {kept.length === 0 ? (
        <button className="share primary" onClick={onBack}>
          אין מה להוסיף — חזרה
        </button>
      ) : (
        <button className="share primary" disabled={busy} onClick={() => onConfirm(kept)}>
          {busy ? 'שומר…' : `אישור ${kept.length} פריטים`}
        </button>
      )}
      <button className="share" disabled={busy} onClick={onBack}>
        חזרה
      </button>
    </div>
  )
}
