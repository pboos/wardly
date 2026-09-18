# Members

The member directory shows the signed-in user's ward. Membership is represented
by a sync-managed `is_moved_out` boolean, independent of local tags. Returning
members have all tags cleared atomically by sync; other updates and departures
preserve tags. See [member sync](../member-sync/README.md).

## Tags and filtering

- Every signed-in ward user can create, rename, recolor, delete, assign, and
  remove tags. Actions validate both member and tag ownership within that ward.
- Tags have names of 1–40 characters, case-insensitively unique within the ward
  after trimming/collapsing whitespace, and one of six theme-aware palette colors.
  Tags are plain labels: names such as “Hide” have no automatic behavior.
- The desktop list shows name, gender, birth date, and tags; email and baptism
  data remain stored but are not displayed.
- Multiple tags appear as colored badges per member. A pencil icon opens a searchable
  checkbox picker; saves are optimistic, block further edits while pending,
  and roll back with an error toast on failure.
- “Manage tags” opens a responsive dialog with usage counts and create/edit
  forms. Deletion confirms removal from every assigned member, then cascades
  assignments without deleting members. Renames/recolors affect all uses.
- Filters combine name, Current / Moved out / All, included tags, and excluded
  tags. Current is the default. Every included tag must match (AND); any excluded
  tag disqualifies a member. A tag cannot be included and excluded together.
  Deleted tags cease to affect filters. Filters are local to the current page.
- Mobile rows place tags to the right of the name on one line. Overflow ends
  in an ellipsis; the pencil stays outside that clipped area and is always visible.
  The picker exposes all tags, including those clipped in the row.
- Moved-out state appears first beside tags as a distinct read-only “Moved out”
  badge with a departure icon. It is not a user tag and cannot be edited manually.
  Header totals exclude moved-out members; shown counts reflect filters.

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
- [Inline tag editing](../../../app/members/member-tags.tsx) and [tag management](../../../app/members/tag-manager.tsx)
- [Tag actions](../../../app/members/actions.ts) and [validation/filter rules](../../../app/members/tags.ts)

Run `npm test` for grouping, AND/exclusion filters, tag lifecycle, ward isolation,
and returning-member tag clearing regression cases.
