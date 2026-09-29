# Camping — Spec

A shared planning app for a recurring group camping trip. It replaces the hand-edited WhatsApp
"who brings what" message as the source of truth, while continuing to feed that message so the
half of the group who will never open the app are not left behind.

Terms in **bold** are defined in [CONTEXT.md](./CONTEXT.md). Decisions marked (ADR-N) are
recorded in [docs/adr](./docs/adr).

---

## 1. Problem

A group of roughly eleven families organises camping trips in WhatsApp. One message lists who
brings what; people edit it, re-paste it, and it drifts. Three things go wrong:

1. **It is hard to follow.** The list is a wall of Hebrew text, numbered by person, comma-
   separated. Finding out whether anyone is bringing ketchup means reading all of it.
2. **Nobody knows if it is complete.** The message records what people *offered*, never what the
   trip *needs*, so there is nothing for an item to be missing from.
3. **It duplicates silently.** The current list has cola four times and tahini twice, because no
   one can hold eleven lines in their head at once.

## 2. Shape of the solution

A mobile-first PWA, Hebrew and RTL throughout, hosted on GitHub Pages with Supabase as the
system of record (ADR-1). Access is by a shared **Trip Code** posted in the group chat; there
are no accounts (ADR-2).

The app is a companion to WhatsApp, not a replacement for it. **Import** absorbs a pasted list;
**Export** renders one back. Conversation stays in WhatsApp.

### 2.1 How a Trip Code is made

Generated, never chosen. Eight characters drawn from a 31-character alphabet with `0`, `O`,
`1`, `I` and `L` removed, because the code is read off one phone screen and typed into
another — sometimes read aloud over the telephone.

A code someone picks is a naming convention, not a secret: `CAMP26` invites `CAMP25`, and the
code is the only credential the app has. Eight random characters is ~38 bits, which is
overwhelming against the only attacker this app really has — a bored person guessing.

Codes are displayed grouped (`K7RM-QXBQ`) and stored ungrouped; input accepts dashes, spaces
and lowercase, because people paste what they were sent. Almost nobody types it at all: the
link posted in the group carries `?code=`, and the Join screen pre-fills from it.

## 3. Domain model

```
Trip ──< Family ──< Camper
  │         │
  │         └──< FamilyChecklistEntry
  ├──< Item ──> Category
  │      └──> Claim (0..1) ──> Camper
  └──< Announcement
```

### Item

The central type. **An Item is a thing that should be at the Trip**, and it exists whether or
not anyone has promised to bring it. A requirement is simply an Item with no **Claim**; this is
what makes "what's missing" an answerable question.

| Field | Notes |
|---|---|
| `name` | Hebrew free text, e.g. `נקניקיות` |
| `category` | see below |
| `quantity` | optional `{ amount, unit }` — `{2, "ק״ג"}`. Structured so two people bringing cola can be summed. |
| `note` | optional free text — "החריף, לא המתוק" |
| `mergeKey` | canonical name used for duplicate detection. Conservative: see §4.3.1 |
| `claimedBy` | Camper, or null. Null means **Unclaimed**. |
| `origin` | `manual | imported | suggested` — provenance matters when auditing a bad import |

Quantity is deliberately *not* modelled per-head. Computing "22 people × 2 burgers" for thirty
food types is a project of its own, and the group's real failure mode is forgetting ketchup
entirely, not slightly under-buying buns.

### Category

Fixed list, editable only in the repo: `בשר`, `ירקות ופירות`, `מאפים ולחם`, `סלטים וממרחים`,
`מוצרי יסוד ותבלינים`, `שתייה`, `אלכוהול`, `חד״פ`, `ציוד מנגל`, `ציוד מטבח`, `ניקיון`,
`חטיפים ומתוקים`, `ארוחת בוקר`, `אחר`.

`סלטים וממרחים` and `מוצרי יסוד ותבלינים` were added after the import prototype dropped fifteen
items into `אחר` — a category holding an eighth of the list is not a category.

**Category is the primary organisation of the list** (ADR-5). The per-person view is a filter
over the same Items.

### Family Checklist

Obligations that fall on every household individually rather than on the shared pool: שישיית
מים, **חטיפים למשפחה**, ציוד אישי ולינה, בגדים חמים, ציוד למסלול. Each **Family** ticks its
own; the app rolls up "3 families haven't confirmed water". These are *not* expanded into the
shared Item list, which would flood it with fifty near-identical rows.

Family snacks are deliberately named apart from the shared `חטיפים` Items. They are different
things — snacks for your own kids in the car versus snacks for the shared table — and the
current WhatsApp message conflates them, which the import prototype surfaced as a collision.

### Roster

Which Families are attending, with adult and child head counts. Anchors the checklist roll-up
and gives gap detection a denominator.

## 4. Features

### 4.1 The list

- Two views over the same Items: **by category** (default) and **by person**.
- Claim / unclaim with one tap. Add an Item, claimed or unclaimed.
- Editing rules (accident-prevention, *not* security — see ADR-2): you may edit and unclaim your
  own Items; anyone may add Unclaimed Items; unclaiming someone else's takes a deliberate extra
  confirmation. A lightweight activity feed shows who changed what.
- Prominent count of Unclaimed Items — the number that tells you whether the trip is ready.

### 4.2 Import from WhatsApp

Organiser pastes the group message. It is parsed into **Suggestions** with name, quantity,
category and owner inferred. **A review screen is mandatory** (ADR-4): import is a bulk write,
and one parse error otherwise corrupts ninety rows silently.

The parser must cope with the real format: names split by `-` or `–`, items by commas,
quantities leading (`2 ק״ג נקניקיות`) or embedded (`חבילה של נייר סופג`), and compound entries
(`צלחות גדולות וקטנות חד״פ`) that are arguably two Items.

**`ו־` usually separates; `או` and `/` never do.** `חריף או עמבה` and `פרגיות / לבבות` are one
Item each — a choice the bringer will make — and splitting them fabricates Items nobody promised.
The parser flags these rather than splitting, and the reviewer may split explicitly.

The parser must also strip invisible Unicode that WhatsApp inserts before names (U+2060 appears
before `אייל` in the current message).

#### The shipped parser is deterministic, not a model

`src/domain/parse.ts` is pure string handling: no key, no Edge Function, no per-parse cost, and
it works offline. This is a change from the original plan, and it turns on one observation — a
regex has no semantics, so wherever a model would guess, this parser **flags and defers to the
reviewer**. A parser that silently invents `קטנות חד״פ` out of `צלחות גדולות וקטנות חד״פ` is
worse than one that admits it cannot tell.

Three rules carry most of the accuracy:

- **Hebrew final letters are folded for matching** (`ך ם ן ף ץ` → `כ מ נ פ צ`). `חטיף` ends in
  `ף` but its plural `חטיפים` carries a medial `פ`, so before folding, a keyword could not match
  its own plural. This single bug put eighteen obvious Items into `אחר`.
- **`ו` splits only in the final chunk of a line.** The `ו` that closes a Hebrew list
  (`מפיות וסקוץ׳`) is a separator almost every time; the same letter mid-list
  (`צלחות גדולות וקטנות`) usually is not. Mid-list occurrences are flagged `compound` and the
  reviewer splits explicitly.
- **Folding happens in `parse.ts`, never in `normalise`.** `normalise` builds Merge Keys, and
  ADR-4 keeps those conservative.

Flags are split by severity. `alt`, `compound`, `paren` and `catgap` mean *the parser may have
got this wrong* and require a human. `vague` ("how many snacks?") does not: it is a question
about the group's habits, not about the parse, and the group has run this list for years without
answering it. Making it block acceptance would put a third of the message behind a decision
nobody needs to make.

An LLM pass can be added later as a second opinion feeding the same review screen, without
changing that screen.

### 4.2.1 Measured result

Run against the group's real message, the deterministic parser produces **114 Items and all 11
names from 11 lines, with 0 unparsed lines and 0 Items falling into `אחר`**. Of those, **107 are
accepted in one tap and 7 need a human** — four possible `ו` splits, `חריף או עמבה`,
`פרגיות/ לבבות (בשר כלשהו)`, and the parenthesised `רב פעמי (6 יחידיות מכל דבר)`.

This supersedes the earlier prototype measurement of 120 Items at 56% clean
(`prototypes/import-review-PROTOTYPE.html`), which was produced by a hand parse and counted
`vague` as needing attention.

Because the owner on each line becomes the Claim, one paste yields the Roster *and* a fully
claimed list. The create-trip screen therefore has one text box: paste the message, or type bare
names when there is no message to paste.

### 4.2.2 Importing into a Trip that already exists

Import is **Organiser-only** (ADR-0008). The Camper who created the Trip is its
Organiser; everyone else claims, unclaims, ticks their family's obligations and copies the list
to the group exactly as before. The gate is on blast radius, not on trust: a Claim is one row
about yourself, while an import is a hundred rows across eleven people's lists.

The list is edited in WhatsApp all year, so the message is pasted more than once. Import is
therefore available from the list screen too ("הוספה מהוואטסאפ"), and the second paste must top
the list up rather than double it.

A Suggestion counts as already present when the **same person** already holds an Item with the
**same Merge Key**. Matching on the pair, not on the Merge Key alone, is deliberate: two families
both bringing cola is two Items and must stay two Items.

Already-present rows are **switched off, not hidden** — the review screen shows them greyed with
a "כבר ברשימה" badge and a `חדשים` filter, so someone who genuinely wants a second bag of
charcoal can switch one back on. Names in the message with no Camper on the Trip are listed up
front and get a Family and a Camper when the import is confirmed.

Measured against the group's message: re-pasting it unchanged adds **0 of 114**; pasting a
version with one new person and one extra line for an existing person adds exactly **3 of 117**,
and creates exactly one Camper.

### 4.2.3 Adding one Item by hand

Import is a bulk write reserved for the Organiser, so for a while the list could only be filled
by pasting the group's message. That left no way for a family to say "I'm also bringing a
watermelon" — the app could reproduce the WhatsApp message but not extend it, which is most of
the point.

Anyone on the Trip can add a single Item from the bottom of the list screen. The typed line runs
through **the same parser as the bulk paste** (`parseSingleItem`), so `2 ק״ג נקניקיות` yields the
same name, quantity and Merge Key either way. This is not tidiness: duplicate detection is keyed
on the Merge Key, so a second, looser parser here would silently stop matching manual additions
against imported ones. Measured: adding `2 ק״ג נקניקיות` as ענת immediately flagged `כפול`
against גילי's identical line, and the duplicate count moved 23 → 24.

The guessed category is **shown, not applied silently**, with a picker next to it. A wrong guess
is then visible and one tap from being fixed, rather than filing the Item somewhere nobody looks.

Adding offers two buttons, never one: **אני מביא** and **רק להוסיף לרשימה**. "I'm bringing this"
and "we still need this" are different statements, and a Claim is always explicit (ADR-0006) —
defaulting either way would put words in someone's mouth.

### 4.3 Gap detection

Two layers, in this order (ADR-4):

1. **Rules.** A **Baseline** checklist lives in the repo as JSON, hand-authored from the group's
   existing list. Anything in the Baseline with no matching Item is reported missing. Deterministic
   and free.
2. **LLM enrichment.** Through a Supabase Edge Function holding the API key server-side. Catches
   what rules cannot express: category mistakes, and whole-list observations ("eleven people
   bringing snacks, nobody bringing a tin opener").

Output is always **Suggestions** in a review tray. The LLM never writes to the list. An LLM that
hallucinates "you have everything" is worse than having no feature, and trust in the list is the
entire product.

#### Baseline entries need an `anyOf`

Running the Baseline against the real 120-item list reported four gaps, and three were false:
`בשר למנגל`, `שתייה קלה` and `סכו״ם חד״פ`. Nobody writes those words. They write `קבב`,
`פרגיות`, `קולה זירו`, `סודה`, `מזלגות חד״פ`. An abstract Baseline line can never be satisfied by
exact matching, so a Baseline entry carries an optional `anyOf` list of concrete things that
count as satisfying it. Without it the app reports missing meat at a barbecue, which costs the
gap detector all its credibility on the one screen where credibility is the product.

With `anyOf` in place the detector reports exactly **one** gap against the group's real list:
`קרח`. Ice has never been on the WhatsApp message. That single true positive is the whole
feature justifying itself.

#### An empty list has no gaps

Gap detection is the Baseline measured *against a list*. On a Trip with no Items there is
nothing to measure, and the detector correctly reports all 45 Baseline entries at once — which
meant the first thing a new Organiser saw was `חסרים 45 דברים. הכי דחוף: מנגל.`, a wall of
demands the group had never made. Technically true, and the exact opposite of the feature's
purpose, which is to earn trust by only speaking when it has something real to say.

An empty list is therefore special-cased in `readiness()`: no gaps, no duplicates, and a
headline that names the next action instead — `הרשימה עוד ריקה. הדביקו את ההודעה מהוואטסאפ, או
הוסיפו פריט ראשון.` The rule is that the Baseline is a review of a list that exists, not a
specification a list must be born meeting.

### 4.3.1 Duplicate detection is always on

Every Item carries a **merge key**. Items sharing a merge key across different Campers are
surfaced permanently in the list view — "3 people are bringing coffee" — not occasionally as an
AI suggestion. This is deterministic and runs on every render; the LLM's only role is proposing
merge keys for Items it has not seen before.

The import prototype found **23 duplicate groups** in the group's current list, including cola
brought by four people and coffee by three. This is the app's highest-value output, because it
is the failure nobody can see by reading the WhatsApp message.

Matching must be conservative. `סכין חדה` and `סכין חד` are the same knife; `סכינים חד״פ` is
disposable cutlery for twenty-two people and merging it would delete them. Likewise `חלב` versus
`חלב סויה`, and `לחמניות לנקניקיות` versus `לחמניות להמבורגרים`. **When in doubt, do not merge —
flag.** A false merge silently removes something the trip needs; a missed merge merely leaves a
duplicate, which is the status quo.

### 4.4 Announcements

Pinned trip-wide instructions from an organiser — departure time, gate code, what to bring for
the waterfall trail. Plus per-Item notes. **No threaded discussion**: WhatsApp wins that fight,
and splitting the conversation in two is worse than not having it.

### 4.5 Export to WhatsApp

Renders the Trip in the group's familiar numbered per-person format, with ✅/❓ marks and a
`עדיין חסר:` section appended, then the `באחריות כל משפחה` footer. Copy to clipboard.

A second export mode produces a short nudge — "the trip is in 3 days, 6 items unclaimed" — for
the organiser to paste. **The app never sends anything itself**: no push, no email. It rides the
channel the group already reads.

### 4.6 Trip lifecycle

Trips archive on their end date, becoming read-only but browsable. A new Trip can **clone** an
archived one: Items, categories and quantities carry over as defaults; **all Claims are
dropped**. The list is the reusable asset; last time's promises are noise.

### 4.7 Roles

The app has exactly two roles, and neither is a general permission system.

**Organiser** (ADR-0008) — the Camper who created the Trip, identified by picking their own name
on the "הטיול נוצר" screen. They alone may import a WhatsApp message. The gate is on blast
radius, not trust: a Claim is one row about yourself, an import is a hundred rows across eleven
people's lists. Enforced in the UI only, which is honest given ADR-0002 — anyone with the code
can already write anything.

**Super admin** (ADR-0009) — the only account in the app. Signs in with Supabase Auth via a
magic link at `?admin=1`, and is authorised by a row in `super_admins`, checked by row-level
security in Postgres. Can list every Trip, edit its metadata, archive it, and delete it.

This breaks ADR-0002 deliberately and could not avoid doing so: a Trip Code grants access to one
Trip, so no code can mean "all Trips", and today's `trip_by_code` policy means the browser cannot
enumerate Trips at all. A client-side check would be worthless — the app is a public static
bundle on GitHub Pages — so the gate has to live in the database, and the database needs an
identity to gate on.

Two limits are deliberate. A super admin **cannot read a Trip's contents**: the by-code policies
still govern items, campers and checks, so the admin sees names, dates, codes and counts only.
And admins **cannot promote admins**: `super_admins` has a select policy and no insert policy, so
membership changes only through the dashboard's service role.

Archiving is reversible and should be the reflex. Deleting cascades through every Item, Camper
and Check, so the screen makes the admin retype the Trip Code first.

## 5. Explicit non-goals

- **No money.** No prices, no settle-up. The group's fairness mechanism is that everyone brings
  roughly a fair share, which this app already makes visible. Introducing money introduces
  social friction the current arrangement has carefully avoided.
- **No chat.**
- **No offline writes** (ADR-3). Cached read-only offline; mutation needs connectivity.
- **No push notifications.**
- **No per-head quantity calculation.**
- **No real accounts or permissions for participants.** The one exception is the super admin
  (ADR-0009), who is an operator rather than a participant; see §4.7.
- **No translation layer.** Hebrew only.

## 6. Technical

| | |
|---|---|
| Frontend | React + TypeScript + Vite, RTL, PWA (cached read-only offline) |
| Hosting | GitHub Pages via GitHub Actions |
| Data | Supabase (Postgres + REST), types generated from schema |
| AI | Supabase Edge Function proxying the LLM; key is a server secret, never in the bundle |
| Seed data in repo | Baseline checklist, category list |

## 7. Open risks

- ~~**Import parse quality**~~ — answered by `prototypes/import-review-PROTOTYPE.html`: 56% of
  Items parse cleanly from the real message. Viable. The parse was run once by hand; stability
  across repeated API calls is still unverified.
- **Merge-key quality** is now load-bearing, since duplicate detection was promoted to an
  always-on feature. It must match `סכין חדה` to `סכין חד` without merging `סכינים חד״פ`.
- **RTL plus mixed Hebrew/Latin/digits** ("2 ק״ג", "50 כוסות") is a classic source of layout bugs.
- **Adoption**: if fewer than half the group opens the app, Export quality is the whole product.

## 8. Prototypes

Throwaway, kept as primary sources. Each answers one question.

| Prototype | Question | Verdict |
|---|---|---|
| `prototypes/import-review-PROTOTYPE.html` | Can an LLM parse the real WhatsApp message well enough that adoption is one paste? | Yes — 56% clean, 120 Items, 23 duplicate groups found. Drove the category, dedup, `או`/`/` and `חטיפים` changes above. |
| `prototypes/ui/a1-list.html` | Is category-primary really better than person-primary, or did we just talk ourselves into it? | **A — accordion by category.** Category-primary confirmed. Person cards (C) survive only as the export format, not as a screen. |
| `prototypes/ui/a2-readiness.html` | Which shape of "what's missing" makes people act instead of shrug? | **D — one sentence.** A count with no next action is ignorable; the ring is decoration. |
| `prototypes/ui/a3-claim.html` | The most-repeated action. Can it be done one-handed in a supermarket without misfires? | **B — explicit `אני` button.** An accidental claim is worse than a slow one: it silently tells ten families the ketchup is handled. |
| `prototypes/ui/a4-firstrun.html` | Does the least technical person in the group get in from a WhatsApp link unaided? | **A — single screen**, code + name together, code pre-filled from the link when present. |
| `prototypes/ui/a5-family.html` | How do we chase a family that hasn't confirmed water without shaming them publicly? | **C — own-family focus.** Others are aggregate only (`8 מתוך 11 אישרו`). We do not build a public wall of who is behind. |

All five UI prototypes share `prototypes/ui/data.js` (one fake trip) so variants are
compared against identical data. `prototypes/ui/index.html` is the hub; inside each
prototype the floating bar and the ← → keys switch variants. 17 variants total,
all verified to render.

### 8.1 The resulting app shape

The five verdicts compose into one app:

- **Home** = A2-D's sentence, then A1-A's category accordion, with A3-B's `אני`
  button on every row.
- **My family** = A5-C. Your five obligations large; everyone else aggregated.
- **Join** = A4-A. One screen, code pre-filled from the WhatsApp link.
- **Export** stays person-shaped and numbered (ADR-0005) even though no screen is.

Two things were rejected and should stay rejected unless something changes:

- **Shopping mode (A1-D)** — genuinely useful in the aisle, but it is a second
  list to keep in sync and a second place for a claim to live. Revisit only if
  people report actually shopping with the app open.
- **The nudge button (A5-B)** — technically trivial, socially expensive. The
  Announcement already exists for this and a human writes it.
