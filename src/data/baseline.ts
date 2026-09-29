import type { BaselineEntry } from '../domain/types'

/**
 * The Baseline: what a trip of this kind is expected to have, distilled from
 * the group's real WhatsApp lists. Gap detection is this list measured against
 * the Trip's Items (ADR-0004) — deterministic, before any model is involved.
 *
 * `reason` is shown to a human when the gap is reported, so it has to justify
 * itself. A line nobody would act on does not belong here.
 */
export const BASELINE: BaselineEntry[] = [
  // Fire and heat — nothing else works without these.
  { mergeKey: 'מנגל', name: 'מנגל', categoryId: 'grill', reason: 'בלי זה אין ארוחת ערב' },
  { mergeKey: 'פחמים', name: 'פחמים', categoryId: 'grill', reason: 'מנגל בלי פחמים הוא שולחן' },
  { mergeKey: 'מצית', name: 'מצית', categoryId: 'grill', reason: 'הדבר הכי קטן שמבטל את הערב' },
  { mergeKey: 'קוביות הדלקה', name: 'קוביות הדלקה', categoryId: 'grill', reason: 'הדלקה בלי זה לוקחת חצי שעה' },
  { mergeKey: 'רשת למנגל', name: 'רשת למנגל', categoryId: 'grill', reason: 'נשכחת בבית יותר מהמנגל עצמו' },
  { mergeKey: 'מלקחיים', name: 'מלקחיים', categoryId: 'grill', reason: 'אין דרך להפוך בשר בלי זה' },
  { mergeKey: 'עצים למדורה', name: 'עצים למדורה', categoryId: 'grill', reason: 'למדורה של הערב' },

  // Food that the trip is actually built around.
  { mergeKey: 'בשר למנגל', name: 'בשר למנגל', categoryId: 'meat', reason: 'העיקר של ארוחת הערב', perHead: true,
    anyOf: ['קבב', 'המבורגרים', 'פרגיות', 'פרגיות-לבבות', 'שיפודים', 'אנטריקוט', 'כנפיים'] },
  { mergeKey: 'נקניקיות', name: 'נקניקיות', categoryId: 'meat', reason: 'מה שהילדים אוכלים בפועל', perHead: true },
  { mergeKey: 'לחם', name: 'לחם', categoryId: 'bread', reason: 'אי אפשר להשלים בקמפינג' },
  { mergeKey: 'לחמניות להמבורגרים', name: 'לחמניות להמבורגרים', categoryId: 'bread', reason: 'המבורגרים בלי לחמניות' },
  { mergeKey: 'פיתות', name: 'פיתות', categoryId: 'bread', reason: 'לשיפודים ולפרגיות' },
  { mergeKey: 'ירקות לסלט', name: 'ירקות לסלט', categoryId: 'produce', reason: 'הדבר הטרי היחיד בשולחן' },
  { mergeKey: 'פירות', name: 'פירות', categoryId: 'produce', reason: 'לילדים לאורך היום', perHead: true },

  // Breakfast — the meal that gets forgotten while planning dinner.
  { mergeKey: 'קורנפלקס', name: 'קורנפלקס', categoryId: 'breakfast', reason: 'ארוחת הבוקר של הילדים' },
  { mergeKey: 'חלב', name: 'חלב', categoryId: 'breakfast', reason: 'לקורנפלקס ולקפה' },
  { mergeKey: 'ביצים', name: 'ביצים', categoryId: 'breakfast', reason: 'ארוחת בוקר לגדולים' },
  { mergeKey: 'גבינות', name: 'גבינות', categoryId: 'breakfast', reason: 'לבוקר, עם הלחם' },

  // Hot drinks — first thing anyone asks for in the morning.
  { mergeKey: 'קפה', name: 'קפה', categoryId: 'drinks', reason: 'הבקשה הראשונה של הבוקר' },
  { mergeKey: 'ערכת קפה', name: 'ערכת קפה', categoryId: 'kitchen', reason: 'קפה בלי פינג׳אן או פרנץ׳פרס',
    anyOf: ['פרנצפרס', 'פינג׳אן'] },
  { mergeKey: 'תה', name: 'תה', categoryId: 'drinks', reason: 'למי שלא שותה קפה' },
  { mergeKey: 'סוכר', name: 'סוכר', categoryId: 'staples', reason: 'קטן, ונשכח כל שנה' },

  // Cold drinks.
  { mergeKey: 'שתייה קלה', name: 'שתייה קלה', categoryId: 'drinks', reason: 'לילדים ולארוחה', perHead: true,
    anyOf: ['קולה זירו', 'קולה', 'סודה', 'לימונדה', 'תירוש', 'מיץ'] },
  { mergeKey: 'קרח', name: 'קרח', categoryId: 'drinks', reason: 'בלי קרח הצידנית היא ארגז' },

  // Kitchen gear — one missing tool blocks a whole meal.
  { mergeKey: 'סכין חדה', name: 'סכין חדה', categoryId: 'kitchen', reason: 'לחיתוך ירקות ובשר',
    anyOf: ['סכין חיתוך', 'סכין חד'] },
  { mergeKey: 'קרש חיתוך', name: 'קרש חיתוך', categoryId: 'kitchen', reason: 'הולך יחד עם הסכין' },
  { mergeKey: 'קערות לסלט', name: 'קערות לסלט', categoryId: 'kitchen', reason: 'אין במה להכין את הסלט',
    anyOf: ['קערות הגשה', 'קערות'] },
  { mergeKey: 'נייר אלומיניום', name: 'נייר אלומיניום', categoryId: 'kitchen', reason: 'למנגל ולשאריות' },
  { mergeKey: 'כפות הגשה', name: 'כפות הגשה', categoryId: 'kitchen', reason: 'להגשה מהסירים' },

  // Disposables — dull, and the first thing to run out.
  { mergeKey: 'צלחות חד״פ', name: 'צלחות חד״פ', categoryId: 'disposables', reason: 'אין כלים בקמפינג', perHead: true },
  { mergeKey: 'כוסות חד״פ', name: 'כוסות חד״פ', categoryId: 'disposables', reason: 'קרות וחמות — שניהם', perHead: true,
    anyOf: ['כוסות קרות חד״פ', 'כוסות חמות'] },
  { mergeKey: 'סכו״ם חד״פ', name: 'סכו״ם חד״פ', categoryId: 'disposables', reason: 'סכינים, מזלגות וכפיות',
    anyOf: ['סכינים חד״פ', 'מזלגות חד״פ', 'כפיות חד״פ'] },
  { mergeKey: 'מפיות', name: 'מפיות', categoryId: 'disposables', reason: 'ידיים שמנוניות אחרי מנגל' },

  // Cleaning — what decides whether the morning is pleasant.
  { mergeKey: 'שקיות אשפה', name: 'שקיות אשפה', categoryId: 'cleaning', reason: 'משאירים את השטח נקי' },
  { mergeKey: 'נייר סופג', name: 'נייר סופג', categoryId: 'cleaning', reason: 'לשפיכות ולניקוי מהיר' },
  { mergeKey: 'מגבונים לחים', name: 'מגבונים לחים', categoryId: 'cleaning', reason: 'אין ברז ליד השולחן',
    anyOf: ['מגבונים'] },
  { mergeKey: 'סבון כלים', name: 'סבון כלים', categoryId: 'cleaning', reason: 'לסירים ולמחבת' },
  { mergeKey: 'סקוץ׳', name: 'סקוץ׳', categoryId: 'cleaning', reason: 'הולך יחד עם סבון הכלים' },

  // Condiments — cheap, and their absence is what people remember.
  { mergeKey: 'שמן זית', name: 'שמן זית', categoryId: 'staples', reason: 'לסלט' },
  { mergeKey: 'מלח', name: 'מלח', categoryId: 'staples', reason: 'הפריט הכי זול שהכי חסר' },
  { mergeKey: 'קטשופ', name: 'קטשופ', categoryId: 'spreads', reason: 'הילדים לא יאכלו בלי' },
  { mergeKey: 'מיונז', name: 'מיונז', categoryId: 'spreads', reason: 'להמבורגרים' },
  { mergeKey: 'חומוס', name: 'חומוס', categoryId: 'spreads', reason: 'לפיתות ולבוקר' },
  { mergeKey: 'טחינה', name: 'טחינה', categoryId: 'spreads', reason: 'לבשר ולפיתות' },
  { mergeKey: 'חמוצים', name: 'חמוצים', categoryId: 'spreads', reason: 'למנגל' },
]
