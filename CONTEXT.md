# Camping

A shared planning app for a recurring group camping trip, replacing the hand-edited
WhatsApp "who brings what" message while still living alongside it.

## Language

**Trip**:
One camping outing with its own dates, location, and packing list. Trips recur, and a new
Trip can be started from a previous one.
_Avoid_: Event, outing

**Camper**:
A named adult participant who can claim responsibility for bringing things. Children attend
but are not Campers.
_Avoid_: User, member, participant

**Family**:
A household attending a Trip together. Some obligations fall on every Family rather than on
the shared pool.
_Avoid_: Group, household, unit

**Trip Code**:
The shared secret, passed around in the group chat, that grants access to a Trip. It is the
only credential; there are no accounts or passwords.
_Avoid_: Password, invite code, token

**Roster**:
The set of Families attending a Trip, with their adult and child head counts.
_Avoid_: Attendees, guest list

## The list

**Item**:
One thing that should be at the Trip, optionally with a quantity and a note. An Item exists
whether or not anyone has promised to bring it.
_Avoid_: Entry, line, product, thing

**Claim**:
A Camper's promise to bring a particular Item. An Item with no Claim is the unit of "missing".
_Avoid_: Assignment, allocation, signup

**Unclaimed**:
The state of an Item nobody has promised to bring. This is the gap the Trip is trying to close.
_Avoid_: Unassigned, open, todo

**Family Checklist**:
The fixed set of obligations every Family carries individually — water, warm clothes, personal
and sleeping gear — tracked per Family rather than in the shared pool of Items.
_Avoid_: Personal list, own gear

**Announcement**:
A pinned, trip-wide instruction from an organiser: departure times, gate codes, what to expect.
Not a conversation; discussion stays in the group chat.
_Avoid_: Message, notice, post

**Category**:
The kind of thing an Item is — meat, drinks, disposables, grill gear, and so on. The primary
way the list is organised in the app.
_Avoid_: Section, group, tag

**Merge Key**:
The canonical name an Item is grouped by, so that the same thing brought by different Campers
can be recognised as one thing. Deliberately conservative: two Items share a Merge Key only
when they are certainly the same.
_Avoid_: Slug, normalised name, dedup key

**Duplicate Group**:
Two or more Items sharing a Merge Key but claimed by different Campers — the same thing being
brought twice without anyone noticing.
_Avoid_: Collision, overlap

## Around the list

**Baseline**:
The canonical checklist of what a Trip of this kind requires, distilled from past trips and
held as seed data. Gap detection is the Baseline measured against the Trip's Items.
_Avoid_: Template, master list, defaults

**Suggestion**:
A proposed Item or correction produced by gap detection or by parsing a pasted list. A
Suggestion is never part of the Trip until a human accepts it.
_Avoid_: Recommendation, auto-add

**Import**:
Turning a pasted WhatsApp message into Suggestions for review. Always bulk, always reviewed.
_Avoid_: Sync, upload

**Export**:
Rendering a Trip back into the group's familiar numbered per-person message, with Unclaimed
Items appended.
_Avoid_: Share, publish

