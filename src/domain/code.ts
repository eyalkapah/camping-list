/**
 * Trip Codes. The code is the only credential (ADR-0002), so it is generated
 * rather than chosen: a code derived from the year is a naming convention, not
 * a secret, and `CAMP25` shows last year's list to anyone who tries.
 */

/**
 * No `0`, `O`, `1`, `I` or `L`. This is read off one phone screen and typed
 * into another, sometimes by someone reading it aloud over the telephone.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 8

export function generateTripCode(): string {
  const bytes = new Uint32Array(LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]
  return code
}

/** `K7RMQXBQ` → `K7RM-QXBQ`. Grouping is display only; never stored. */
export function formatTripCode(code: string): string {
  const clean = normaliseTripCode(code)
  return clean.length === LENGTH ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

/** Accepts what people actually paste: spaces, dashes, lowercase. */
export function normaliseTripCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function isWellFormedTripCode(input: string): boolean {
  const clean = normaliseTripCode(input)
  return clean.length >= 4 && [...clean].every((c) => ALPHABET.includes(c))
}

/** The thing that actually gets pasted into the group chat. */
export function joinLink(code: string): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}?code=${normaliseTripCode(code)}`
}
