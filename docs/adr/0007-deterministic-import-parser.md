# Import parses with code, not with a model

SPEC §4.2 originally specified an LLM parsing the pasted WhatsApp message, reached through a
Supabase Edge Function holding the API key. The shipped parser (`src/domain/parse.ts`) is
ordinary string handling instead. The LLM remains available as a later addition, feeding the
same review screen.

**Why.** The model route needs Supabase deployed, an Edge Function written, a key held
server-side, and a per-parse cost — and at the point the decision was made, the Supabase path in
this repo had never been executed against a real project. The deterministic route needed none of
that and could be measured the same afternoon. Measured against the group's real message it
produces 114 Items, all 11 names, 0 unparsed lines and 0 Items in `אחר`, with 7 Items needing a
human. That is good enough to adopt, so the model buys very little against a large amount of
new infrastructure.

**What we gave up, deliberately.** A regex has no semantics. Where a model would infer, this
parser flags and defers to the mandatory review screen. `צלחות גדולות וקטנות חד״פ` is left whole
and marked `compound` rather than split, because a parser that invents `קטנות חד״פ` writes an
Item nobody promised, and ADR-4's asymmetry applies: a missed split costs one review tap, a
fabricated Item costs trust in the list. The reviewer gets an explicit "one thing or two?"
button on exactly those rows.

**Flags are ranked, not merely listed.** `alt`, `compound`, `paren` and `catgap` mean the parse
may be wrong and gate acceptance. `vague` — an Item with no quantity — does not. "How many
snacks?" is a question about the group's habits rather than about the parse, and the group has
run this list for years without answering it. Thirty-six of 114 Items are `vague`; gating on
them would put a third of the message behind a decision nobody needs to make, and would train
people to press the big button without reading.

**The consequence worth noticing.** Because the owner named on each line becomes the Claim, one
paste yields the Roster *and* a fully claimed list. Creating a Trip therefore needs one text box
rather than a name form plus a separate import step, and nobody types eleven Hebrew names on a
phone. Reading the roster out of WhatsApp itself was considered and rejected: the official Cloud
API cannot enumerate or read a normal group at all, and the unofficial libraries require pairing
a real phone number, a server this architecture does not have, and access to the pairing
person's entire WhatsApp account.

**Re-pasting is the normal case, not an edge case.** The group edits the message all year, so
import is also reachable from the list screen, and the same message will land on the same Trip
more than once. A Suggestion counts as already present when the same person already holds an
Item with the same Merge Key — the *pair*, never the Merge Key alone, because two families both
bringing cola is legitimately two Items. Already-present rows are switched off rather than
hidden, so someone who genuinely wants a second bag of charcoal can switch one back on; hiding
them would make the app look like it had lost the line. Re-pasting the unchanged message adds 0
of 114 Items; a version with one new person and one extra line adds exactly 3 of 117.
