# מי מביא מה

Camping trip organiser for one Hebrew-speaking group of families. Replaces the
hand-edited WhatsApp "who brings what" message while still living alongside it.

Read [`SPEC.md`](SPEC.md) first, [`CONTEXT.md`](CONTEXT.md) before naming anything,
and [`docs/adr/`](docs/adr) before changing a decision.

## Running it

```bash
npm install
npm run dev
```

With no Supabase environment variables set, the app runs entirely against
`localStorage`, seeded with the group's real imported list (120 Items, 11
Campers). Trip Code `CAMP26`. This is a development convenience, not the
offline story — see ADR-0003.

To make a new Trip, press **"אין לי קוד — אני מארגן טיול חדש"** on the join
screen. The code is generated there (`src/domain/code.ts`), never typed — see
SPEC §2.1 for why.

That screen has one text box. Paste last year's WhatsApp message into it and
`src/domain/parse.ts` pulls out both the Roster and the list — 114 Items and all
11 names from the group's real message, with the owner on each line becoming the
Claim. A review screen then opens on the handful the parser is unsure about
(7 of 114) before anything is written; import is a bulk write, so that review is
mandatory (ADR-0004). Typing bare names, one per line, still works when there is
no message to paste.

The parser is plain code, not a model: no key, no Edge Function, no per-parse
cost, and it works offline. ADR-0007 covers why, and what was given up.

The same paste works on a Trip that already exists — **"הוספה מהוואטסאפ"** at the
bottom of the list screen, shown only to the **Organiser**: the person who created
the Trip, who picks their own name from the roster on the "הטיול נוצר" screen
(ADR-0008). Everyone else sees only **"העתקה לוואטסאפ"**.

Anything that person already brings is detected and switched off, so re-sending
the group's edited message tops the list up instead of doubling it: the unchanged
message adds 0 of 114 Items, while a version with one new family and one extra
line adds exactly 3 of 117.

To run against the real system of record, create `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Apply [`supabase/schema.sql`](supabase/schema.sql) to the project first. The anon
key is public by design and protected by row-level security. **The model API key
is never here** — it belongs in the Edge Function that proxies the LLM.

## The super admin

`?admin=1` opens the one screen with a real login: list every Trip, edit its
metadata, archive it, delete it. It needs Supabase — with no project configured
it says so rather than pretending to be a login. See ADR-0009 for why this one
place breaks the no-accounts rule, and SPEC §4.7 for what it deliberately cannot
do (read Trip contents; promote other admins).

Two setup steps that are easy to miss, both in the Supabase dashboard:

1. **Authentication → URL Configuration → Redirect URLs.** Add the admin URL, or
   the magic link arrives and lands nowhere:

   ```
   http://localhost:5173/?admin=1
   https://<user>.github.io/<repo>/?admin=1
   ```

2. **Bootstrap the first admin.** Authority is a row in `super_admins`, and that
   table has no insert policy on purpose, so the first one goes in by hand. Open
   `?admin=1`, sign in once to create the auth user, then in the SQL editor:

   ```sql
   insert into super_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   Sign out and back in. Subsequent admins are added the same way — an admin
   cannot promote anyone from the app.

Note that configuring Supabase roughly doubles the bundle (283 kB → 496 kB raw,
84 kB → 138 kB gzipped), since the auth and realtime client stop being
tree-shaken away.

## Layout

| Path | What it is |
|---|---|
| `src/domain/` | Types and pure list logic — gaps, duplicates, readiness, export. No React. |
| `src/data/` | Catalog, Baseline, generated seed trip, repository (local + Supabase), admin repository. |
| `src/screens/` | Join, Home, MyFamily, NewTrip, ImportReview, ImportToTrip, Admin. |
| `src/state/` | `useTrip` — the whole app's state. |
| `prototypes/` | Throwaway, kept as primary sources. Not built, not shipped. |

The screens are the surviving variants from `prototypes/ui/`: A1-A (accordion by
category), A2-D (one-sentence readiness), A3-B (explicit `אני` button), A4-A
(single join screen), A5-C (own family in full, others as a count).

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repository **variables**. `vite.config.ts` uses a
relative base, so the repository can be renamed without touching the config.
