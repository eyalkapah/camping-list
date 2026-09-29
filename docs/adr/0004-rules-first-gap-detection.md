# Gap detection is rules-first; the LLM only suggests

"Is anything missing?" is the reason this app exists, so its answer must be trustworthy. A
model that occasionally hallucinates "you have everything" is worse than no feature at all.
Missing-Item detection is therefore a deterministic rules pass over a canonical camping
checklist held in the repo, with an LLM layered on top for judgement the rules cannot express —
duplicate detection, category inference, and observations about the list as a whole.

## Consequences

The LLM may never write to the list directly. Its output lands in a review tray and a human
accepts each suggestion with one tap; the same applies to the WhatsApp import parser, which is
a bulk write and so always passes through a review screen. The LLM is called through a Supabase
Edge Function that holds the API key as a server-side secret — no key may ever be shipped in
the browser bundle.

## Amendment, after the import prototype

Duplicate detection was originally listed here as LLM enrichment. It is not: it is a
deterministic grouping on each Item's merge key, always visible in the list view, and it turned
out to be the highest-value output in the product (23 duplicate groups in the group's existing
list). The LLM's remaining role in dedup is only to propose a merge key for an Item it has not
seen before. Matching errs towards not merging — a false merge silently deletes something the
trip needs, while a missed merge leaves a duplicate, which is merely the status quo.
