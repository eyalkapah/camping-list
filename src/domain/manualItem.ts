import { parseSingleItem } from './parse'
import type { CategoryId, Item } from './types'

/**
 * Adding one Item by hand.
 *
 * The list could only ever be filled by a bulk WhatsApp paste, which meant a
 * family that wanted to bring one thing nobody had listed had no way to say
 * so — the app could describe the group's message but not extend it.
 *
 * Parsing runs through the same `parseSingleItem` the bulk import uses, so a
 * typed `2 ק״ג נקניקיות` yields the same name, quantity and Merge Key as the
 * pasted one. A second, looser parser here would drift from the first and
 * quietly break duplicate detection, which is keyed on exactly that.
 */
export function itemFromText(
  tripId: string,
  text: string,
  createdBy: string,
  /** `null` accepts the parser's guess. A human override always wins. */
  categoryId: CategoryId | null,
  /** Whether the person adding it is also promising to bring it (ADR-0006). */
  claim: boolean,
): Item | null {
  const parsed = parseSingleItem(text)
  if (!parsed) return null

  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    tripId,
    name: parsed.name,
    categoryId: categoryId ?? parsed.categoryId,
    quantity: parsed.quantity,
    note: parsed.note,
    mergeKey: parsed.mergeKey,
    claimedBy: claim ? createdBy : null,
    claimedAt: claim ? now : null,
    createdBy,
    createdAt: now,
  }
}
