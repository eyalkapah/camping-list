-- Camping — system of record (ADR-0001).
--
-- Access is by Trip Code, not by account (ADR-0002): anyone holding the code
-- can read and write that Trip, and nothing else. The code is the credential,
-- so it is checked in every policy via the request header `x-trip-code`.

create table trips (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  location     text        not null,
  starts_on    date        not null,
  ends_on      date        not null,
  code         text        not null unique,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table families (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references trips(id) on delete cascade,
  name      text not null,
  adults    int  not null default 2,
  children  int  not null default 0
);

create table campers (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  family_id  uuid not null references families(id) on delete cascade,
  name       text not null
);

-- The Camper who created the Trip; the app's only role, and the only thing that
-- gates a write (import). Added here rather than in `trips` above because the
-- Campers do not exist until after the Trip does.
alter table trips
  add column organiser_id uuid references campers(id) on delete set null;

create table items (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  name         text not null,
  category_id  text not null,
  -- Free text as a human wrote it ("2 ק״ג", "שישייה"). Never parsed to a number.
  quantity     text,
  note         text,
  -- Conservative canonical name; null when we are not sure (ADR-0004 amended).
  merge_key    text,
  -- The Claim, inlined. null is Unclaimed, which is the unit of "missing".
  claimed_by   uuid references campers(id) on delete set null,
  claimed_at   timestamptz,
  created_by   uuid references campers(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index items_trip_idx on items (trip_id);
create index items_merge_idx on items (trip_id, merge_key);

create table family_checks (
  trip_id        uuid not null references trips(id) on delete cascade,
  family_id      uuid not null references families(id) on delete cascade,
  obligation_id  text not null,
  confirmed_at   timestamptz not null default now(),
  primary key (trip_id, family_id, obligation_id)
);

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  body        text not null,
  author      text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Row-level security -------------------------------------------------------

alter table trips         enable row level security;
alter table families      enable row level security;
alter table campers       enable row level security;
alter table items         enable row level security;
alter table family_checks enable row level security;
alter table announcements enable row level security;

create or replace function current_trip_code() returns text
language sql stable as $$
  select upper(coalesce(
    current_setting('request.headers', true)::json ->> 'x-trip-code', ''))
$$;

create or replace function trip_is_open(target uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from trips t
    where t.id = target
      and upper(t.code) = current_trip_code()
      and current_trip_code() <> ''
  )
$$;

create policy trip_by_code on trips for select
  using (upper(code) = current_trip_code() and current_trip_code() <> '');

-- Anyone may create a Trip. There is nothing to protect at creation time — a
-- new Trip is empty, and it is only reachable by the code its creator holds.
create policy trip_create on trips for insert
  with check (true);

-- The creator must be able to fill in the Roster immediately after insert,
-- before anyone has the code; trip_is_open() covers this because the client
-- already sends the code it just generated.

-- The Organiser is recorded *after* the Trip is inserted, because Campers do
-- not exist until the Roster does (see the organiser_id column above). That is
-- an update on `trips`, and without this policy it silently affects zero rows:
-- Postgres does not error, PostgREST returns 200, and the app cheerfully
-- carries on with organiser_id null — which leaves nobody able to import.
--
-- `with check` repeats the code test deliberately. It is evaluated against the
-- *new* row, so an update that changes `code` produces a row that no longer
-- matches the header and is rejected. The Trip Code is therefore immutable
-- without needing a trigger, and nobody holding it can lock everyone else out.
create policy trip_update_by_code on trips for update
  using (upper(code) = current_trip_code() and current_trip_code() <> '')
  with check (upper(code) = current_trip_code() and current_trip_code() <> '');

create policy families_by_code on families
  for all using (trip_is_open(trip_id)) with check (trip_is_open(trip_id));
create policy campers_by_code on campers
  for all using (trip_is_open(trip_id)) with check (trip_is_open(trip_id));
create policy items_by_code on items
  for all using (trip_is_open(trip_id)) with check (trip_is_open(trip_id));
create policy checks_by_code on family_checks
  for all using (trip_is_open(trip_id)) with check (trip_is_open(trip_id));
create policy announcements_by_code on announcements
  for all using (trip_is_open(trip_id)) with check (trip_is_open(trip_id));

-- Anyone with the code can edit anything (SPEC §4.1). This is a group of
-- friends, and the ability to fix someone else's typo is a feature. The audit
-- trail is created_by, not a permission system.

-- Super admins -------------------------------------------------------------
--
-- The one identity in the app that is a *person* rather than a Trip Code
-- (ADR-0009). A super admin signs in with a real Supabase Auth account and can
-- list, rename, archive and delete every Trip. Nothing else in the app has an
-- account, and nothing else needs one.
--
-- Membership is a table, not a hard-coded email list, so granting and revoking
-- is a row in the dashboard rather than a redeploy. Bootstrapping is manual and
-- deliberately so: sign in once, then insert your own auth user id here using
-- the Supabase SQL editor.
--
--     insert into super_admins (user_id, note)
--     select id, 'me' from auth.users where email = 'you@example.com';

create table super_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now()
);

alter table super_admins enable row level security;

-- Readable only by super admins, and writable by none of them. Promotion
-- happens in the dashboard with the service role, so an admin whose session is
-- stolen cannot mint another admin.
create policy super_admins_self on super_admins for select
  using (user_id = auth.uid());

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from super_admins where user_id = auth.uid())
$$;

-- Super admins see and manage every Trip, with no Trip Code involved. These sit
-- alongside the by-code policies above; Postgres ORs permissive policies, so a
-- normal user is unaffected.
create policy trip_admin_read on trips for select
  using (is_super_admin());
create policy trip_admin_update on trips for update
  using (is_super_admin()) with check (is_super_admin());
create policy trip_admin_delete on trips for delete
  using (is_super_admin());

-- Deleting a Trip cascades to families, campers, items, checks and
-- announcements through the foreign keys, so no child policies are needed for
-- delete. Reading a Trip's contents still requires its code, on purpose: the
-- super admin's job is the Trip list, not other people's snack arguments.

