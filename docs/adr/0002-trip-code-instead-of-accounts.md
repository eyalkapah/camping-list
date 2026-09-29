# A shared Trip Code instead of user accounts

The group already trusts each other through a private WhatsApp group, and the participants are
family members of varying technical confidence. Requiring email verification, passwords, or
OAuth would cost more adoption than it buys safety, so access to a Trip is granted by a single
shared Trip Code posted in the group chat, after which the Camper identifies themselves by
picking their name from the Roster.

## Consequences

There is no security boundary between Campers, and anyone with the code is trusted completely.
Restrictions such as "you may only edit your own Claims" are guards against accident, not
attack, and must not be relied on for anything that actually matters. Organiser-only actions
(bulk import, Roster changes) are a convention, not an enforced permission.
