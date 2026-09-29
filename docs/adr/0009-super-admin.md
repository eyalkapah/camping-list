# The super admin is a real account, because it cannot be anything else

A super admin can list every Trip, edit its metadata, archive it and delete it.
This is the only part of the app behind a login: Supabase Auth, a magic link,
and a `super_admins` table checked by row-level security.

**Why this breaks ADR-0002, and why that is correct.** ADR-0002 says the Trip
Code is the only credential and there are no accounts. That decision is about
*participants*, and it still holds for all of them. It cannot hold here for a
structural reason: a Trip Code grants access to exactly one Trip, so there is no
code that means "all Trips". Today's policy is literally

```sql
create policy trip_by_code on trips for select
  using (upper(code) = current_trip_code() ...);
```

so the browser cannot even enumerate Trips. "See all trips" is not a screen that
was missing — it is a door that did not exist.

**Why not a passphrase in the client.** The app is a static bundle served from
GitHub Pages. Everything in it is public: a hard-coded passphrase, a build-time
flag, an obfuscated string. A client-side check would let anyone who opened the
bundle delete every Trip in the database, because the anon key is public too and
the only thing standing between it and the data is RLS. The gate therefore has
to live in Postgres, and Postgres needs an identity to gate on. That identity is
an authenticated user.

**Why a table rather than a list of emails in the code.** Granting or revoking
an admin is then a row, done in the dashboard, not a redeploy. The trade is that
the first admin must be inserted by hand — sign in once to create the auth user,
then run the insert in the SQL editor. Bootstrapping a permission system from
outside itself is unavoidable; doing it in two commands is the cheap version.

**Admins cannot promote admins.** `super_admins` has a select policy and no
insert or update policy, so membership can only change with the service role,
which lives in the dashboard and never in the browser. A stolen admin session
can damage Trips; it cannot mint a second admin or make itself permanent.

**Archive is the reflex; delete is the ceremony.** The model already had
`archivedAt`, which is reversible and leaves the Trip working for anyone holding
the code. Deletion cascades through families, campers, items, checks and
announcements, so the UI makes the admin retype the Trip Code first. That is not
security — they already have the authority — it is friction proportional to
destroying a hundred promises.

**What the super admin deliberately cannot do.** Read a Trip's contents. The
by-code policies still govern families, campers, items and checks, so the admin
screen shows names, dates, codes and counts, and nothing else. Managing the list
of Trips does not require reading what eleven families are arguing about, and
the narrower power is the one worth having.

**Consequences.**

- The admin screen is `?admin=1` on the same static page, which is also the
  magic link's `emailRedirectTo`. That URL must be added to the Supabase
  project's redirect allow-list or the link lands nowhere.
- A second Supabase client (`adminClient`) exists with its own `storageKey` and
  no `x-trip-code` header, so an admin session and an open Trip never collide.
- Configuring Supabase roughly doubles the bundle: 283 kB raw / 84 kB gzip
  without it, 496 kB / 138 kB with it. Worth knowing before blaming Pages.
- With no Supabase project configured the screen says so plainly rather than
  pretending to be a login.
