# The Trip's creator is its Organiser, and that is the only role

The app has one role and one permission: the Camper who created the Trip may
import a WhatsApp message. Everyone else can do everything else — claim, unclaim,
tick their family's obligations, and copy the list back to the group.

**Why a role at all, given ADR-0002.** ADR-0002 says the Trip Code is the only
credential and everyone holding it is equal. That still holds for the writes
people make about themselves: a Claim is one row, it is obviously attributable,
and undoing it is one tap. Import is not that. It is a bulk write of a hundred
Items across eleven people's lists, and a second person importing a slightly
different copy of the message is how the list quietly stops matching what the
group agreed. So the gate is on *blast radius*, not on trust.

**Why the creator, and not a flag anyone can take.** In this group one person
already maintains the WhatsApp message. They are the person who will paste it.
Making the role anything other than "whoever made the trip" would mean building
an invite or promotion flow for a group of eleven that meets once a year, and
ADR-0002 exists precisely to avoid that machinery.

**Why it is not transferable.** A Trip is one year's camping trip. If the person
who runs it changes, the next trip is a new Trip with a new code, which is what
happens anyway. Transfer would need to answer "who may transfer it?", and the
only honest answer inside ADR-0002 is "anyone with the code", which would make
the role decorative.

**Consequences.**

- `Trip.organiserId` is nullable and set *after* creation, because Campers do not
  exist until the Trip does. In Postgres it is an `alter table` after `campers`.
- Creating a Trip now ends with "מי אתם?" — the creator picks their own name from
  the roster, and that pick both claims the role and becomes their session. This
  also removes an existing wrong assumption: the code used to treat the first
  name in the pasted message as the creator, which it almost never is.
- Enforcement is currently in the UI only (`App.tsx` passes no `onImport` to
  anyone else). That is honest for a list of snacks and consistent with
  ADR-0002 — anyone with the code and a console can already write anything. If
  import ever becomes destructive, the check belongs in an RLS policy.
- A Trip with no Organiser is legal. Trips created before this change have none,
  and nobody can import into them until one is set.
