# Offline is read-only; no write sync

Campsites have poor signal, which tempts a full offline-first design with a write queue and
conflict resolution. We rejected it: the list is written during the week at home on good
connections and only read at the campsite. Offline support is therefore a cached read of the
last-known Trip, and any mutation requires connectivity.

## Consequences

The app never has to merge divergent histories or resolve concurrent Claims, which removes the
largest potential source of bugs. The cost is that a Camper standing in a dead zone cannot tick
something off and must wait. Resist requests to "just queue the writes" — that is this decision
being reversed, and it should be reversed deliberately or not at all.
