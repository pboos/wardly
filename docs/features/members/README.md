# Members

The member directory shows the signed-in user's ward, with name and status
filters and inline status editing. It starts with active members only. Moved
members have read-only status; the header's total excludes moved members.

## Household grouping

- Members sharing a saved external household UUID appear together. Missing or
  blank household IDs produce separate individual entries, even for matching names.
- The source role `HEAD` (case-insensitive) takes precedence. Without a recorded
  head, the oldest member with a known birth date becomes the display head.
  Tied dates or entirely missing dates fall back to last name, first name, then ID.
  Multiple recorded heads use the same alphabetical tie-breaker.
- The display head appears first and unindented; other members follow alphabetically
  by last name, then first name. Saved source roles are never changed.
- Households sort by their display head's name. Selection of the display head,
  grouping, and ordering happen before filtering, so hiding the
  head does not move the household or promote another member to head.
- Filters show only matching members; empty households disappear. Counts remain
  member counts, not household counts.
- Desktop tables and mobile lists alternate subtle shading per visible household,
  with borders between groups and indentation for household members other than
  the head. Colors use theme tokens for light and dark mode.

Household data comes from [member sync](../member-sync/README.md). No household
membership is inferred from names, addresses, or age.

## Implementation

- [Ward query and client data](../../../app/members/page.tsx)
- [Grouping and sorting](../../../app/members/households.ts)
- [Filters and responsive list](../../../app/members/members-list.tsx)
- [Inline status control](../../../app/members/status-badge.tsx)

Run `npm test` for grouping regression cases.
