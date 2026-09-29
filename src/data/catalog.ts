import type { Category, FamilyObligation } from '../domain/types'

/**
 * Fixed list, editable only here (SPEC §3 Category). `spreads` and `staples`
 * exist because the import prototype dropped an eighth of the real message
 * into `other` — a category holding an eighth of the list is not a category.
 */
export const CATEGORIES: Category[] = [
  { id: 'meat', name: 'בשר', order: 1 },
  { id: 'produce', name: 'ירקות ופירות', order: 2 },
  { id: 'bread', name: 'מאפים ולחם', order: 3 },
  { id: 'spreads', name: 'סלטים וממרחים', order: 4 },
  { id: 'staples', name: 'מוצרי יסוד ותבלינים', order: 5 },
  { id: 'breakfast', name: 'ארוחת בוקר', order: 6 },
  { id: 'snacks', name: 'חטיפים ומתוקים', order: 7 },
  { id: 'drinks', name: 'שתייה', order: 8 },
  { id: 'alcohol', name: 'אלכוהול', order: 9 },
  { id: 'grill', name: 'ציוד מנגל', order: 10 },
  { id: 'kitchen', name: 'ציוד מטבח', order: 11 },
  { id: 'disposables', name: 'חד״פ', order: 12 },
  { id: 'cleaning', name: 'ניקיון', order: 13 },
  { id: 'other', name: 'אחר', order: 14 },
]

export const CATEGORY_NAME: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name]),
)

/**
 * SPEC §3 Family Checklist. `familySnacks` is named apart from the shared
 * `חטיפים` Items on purpose: snacks for your own kids in the car are not
 * snacks for the shared table, and the WhatsApp message conflates them.
 */
export const FAMILY_OBLIGATIONS: FamilyObligation[] = [
  { id: 'water', name: 'שישיית מים', hint: 'לפחות שישייה לכל משפחה' },
  { id: 'familySnacks', name: 'חטיפים למשפחה', hint: 'לילדים שלכם בדרך — בנפרד מהחטיפים המשותפים' },
  { id: 'personalGear', name: 'ציוד אישי ולינה', hint: 'אוהל, שק שינה, מזרן' },
  { id: 'warmClothes', name: 'בגדים חמים', hint: 'בלילה קר יותר משנדמה' },
  { id: 'trailGear', name: 'ציוד למסלול המפלים', hint: 'נעליים שנרטבות, בגדים להחלפה' },
]
