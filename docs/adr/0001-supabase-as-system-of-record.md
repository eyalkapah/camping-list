# Supabase holds the data; GitHub Pages only serves the app

GitHub Pages is a static host and cannot accept writes, so a "JSON database in the repo" would
have meant either committing from the browser via the GitHub API — which requires every Camper
to hold a GitHub account, a non-starter for a family group — or keeping state in localStorage,
which is no sharing at all. We chose Supabase on its free tier as the system of record, with
Pages serving only the static bundle.

## Consequences

The repo is not the database. Data committed to the repo (the canonical camping checklist,
category definitions) is seed and reference data only; anything a Camper can change lives in
Supabase. Do not add a `data.json` write path.
