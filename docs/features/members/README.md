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
  Each tag has an “Exclude by default” setting (off for new tags). Names alone
  have no automatic behavior. The setting is shared across the ward.
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
  Excluded filters initially contain tags flagged “Exclude by default”. Per-tag
  manual overrides persist during the visit; refreshed defaults affect untouched
  tags. Including a tag explicitly overrides its default exclusion. Deleted tags
  cease to affect filters. Reopening the page restores defaults. Header totals
  still count all current members; shown counts reflect exclusions.
- Mobile rows place tags to the right of the name on one line. Overflow ends
  in an ellipsis; the pencil stays outside that clipped area and is always visible.
  The picker exposes all tags, including those clipped in the row.
- Moved-out state appears first beside tags as a distinct read-only “Moved out”
  badge with a departure icon. It is not a user tag and cannot be edited manually.
  Header totals exclude moved-out members; shown counts reflect filters.

## Member selectors

Task creation/editing and Sunday meeting selectors keep all members searchable.
Matching excluded members appear in an “Excluded by default” group after regular
matches, with muted names and the exclusion tag badges. Exact-name matches rank
first only within their group. Excluded members remain selectable by keyboard or
touch; existing assignments remain valid. Sunday suggestions allow up to eight
results per group, followed by the existing free-text alternative.

- [Grouping/search rules](../../../lib/members/choices.ts) and
  [choice labels](../../../components/member-choice-label.tsx) are shared.
- Tag changes revalidate the directory, tasks, and Sunday meeting views.

## Bulk tag editing

- Check individual members on desktop or mobile. “Select all shown” selects only
  members matching the current filters and shows a mixed state for partial selection.
- The selection toolbar offers Add tags, Remove tags, and Clear. Both operations
  open a searchable multi-tag dialog with an explicit “Apply to N members” action.
  Existing tags are preserved on add; removal affects only the chosen tags.
- Changing any filter clears selection. Data refreshes prune members no longer
  visible. Success clears selection; failure retains it and shows an error.
  Selection, filters, and tag controls are disabled during submission.
- All selected member and tag IDs must belong to the signed-in user's ward.
  Missing or foreign IDs reject the entire operation. Writes are batched inside
  one transaction; repeated adds/removals are harmless. The action accepts up to
  2,000 members and 50 tags per request. Moved-out membership is never changed.
- [Bulk action](../../../app/members/bulk-tag-actions.ts),
  [toolbar/dialog](../../../app/members/bulk-tag-toolbar.tsx), and
  [selection state](../../../app/members/use-member-selection.ts) implement this flow.

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
returning-member tag clearing, and atomic bulk updates across batches.
Browser checks cover selection, filters, and bulk editing on desktop/mobile.

Authenticated client actions use the shared [session recovery flow](../login/README.md#session-recovery).
Components bind guarded `actions.ts` functions through `useAppMutation`;
authentication failures retain drafts for explicit retry after login. See the
[shared action architecture](../login/actions.md).
