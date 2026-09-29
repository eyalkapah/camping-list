/**
 * Dates for a Hebrew, right-to-left screen.
 *
 * Two things go wrong when a date range is built inline in JSX. The first is
 * bidi: `29–30/09` is a run of neutral separators between European numbers, so
 * in an RTL paragraph the browser reorders it and paints `30/09–29`. The data
 * is correct and the screen still lies. Isolation at the render site is the fix
 * (`<bdi dir="ltr">`), not anything this function can do.
 *
 * The second is a month boundary. The old inline version took the day from each
 * end and the month from the start, so a trip from the 29th to the 1st rendered
 * as `29–01/09` — a range that runs backwards inside the wrong month. That one
 * belongs here, which is also why this is a function and not a template string.
 */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const [, startMonth, startDay] = startsOn.split('-')
  const [, endMonth, endDay] = endsOn.split('-')
  if (!startDay || !endDay) return ''
  if (startsOn === endsOn) return `${startDay}/${startMonth}`
  if (startMonth === endMonth) return `${startDay}–${endDay}/${startMonth}`
  return `${startDay}/${startMonth}–${endDay}/${endMonth}`
}
