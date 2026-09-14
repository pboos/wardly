# Sunday meetings

Plan Sunday sacrament meetings across dates and use a single-meeting agenda
while conducting. Read this overview first; load the relevant topic below for details.

| Topic | Route | Context |
| --- | --- | --- |
| [Schedule](schedule.md) | `/meetings/sunday` | Date navigation, creating meetings, inline assignments, history, mobile layout |
| [Agenda and leading](agenda.md) | `/meetings/sunday/YYYY-MM-DD` | Standard entries, editing, ordering, meeting-type changes, tasks, carry-forward |

## Shared model and lifecycle

Local [hymn catalogs and ward language](../hymns/README.md) provide number/title
lookup for English and German in the shared schedule/details hymn picker.

- A `sunday_meeting` belongs to a ward and is unique by `(ward_id, date)`.
  Dates are Sunday-only `YYYY-MM-DD` calendar dates. The ward's IANA time zone
  determines today and the current/upcoming Sunday.
- Local types: `sacrament`, `fast_testimony`, `ward_conference`, and
  `childrens_sacrament_presentation`. `stake_conference` and
  `general_conference` have no local agenda items.
- Each `sunday_meeting_item` holds its type, section, explicit integer position,
  optional standard `slot`, text, hymn metadata, person, and optional task link.
  A task link is unique across all Sundays; choosing it elsewhere moves that item.
  Standard slots are persisted even when empty; identity is independent of order.
- A person is either a member of the same ward or a free-text name, never both.
  Multiple people use multiple rows. Leader and presiding roles are each unique
  per meeting; these and other participant roles live outside the agenda flow.
- New local meetings receive standard entries from their type's template.
  Existing meetings retain their type and contents when loaded again.
- The first Sunday defaults to fast/testimony. When creating a second Sunday,
  it also defaults to fast/testimony if the saved first Sunday is a ward/stake/general
  conference or children's presentation. Other Sundays default to sacrament.
  Changing one meeting does not automatically recalculate existing Sundays.
- Schedule reads never create meetings. Leading-view loading can create a
  missing meeting; carry-forward can create its destination.

## Implementation map

| Responsibility | Entry point |
| --- | --- |
| Authenticated routes and mutations | [page.tsx](../../../app/meetings/sunday/page.tsx), [dated details page](../../../app/meetings/sunday/[date]/page.tsx), [actions.ts](../../../app/meetings/sunday/actions.ts) |
| Read models and relation mapping | [loaders.ts](../../../lib/sunday-meetings/loaders.ts) |
| Public service API and transactional changes | [service.ts](../../../lib/sunday-meetings/service.ts), [meeting-service.ts](../../../lib/sunday-meetings/meeting-service.ts) |
| Shared types, validation, ward access | [types.ts](../../../lib/sunday-meetings/types.ts), [rules.ts](../../../lib/sunday-meetings/rules.ts) |

Server actions derive the ward from the current user, call services, and
revalidate the schedule, dated detail pages, and upcoming-meeting selector. Clients refresh after successful edits and show
errors on failure. Services enforce ward ownership and domain rules inside transactions.
See the [database schema](../../DATABASE_SCHEMA.md#5-sunday_meeting) and
[design guidelines](../../DESIGN.md) for their respective conventions.

## Verification

`npm test` covers Sunday domain behavior, UI labels, and persistence using an
isolated temporary SQLite database created from the initial migration.
For code changes, also run `bunx tsc --noEmit` and
`bunx eslint app/meetings/sunday lib/sunday-meetings`. Topic files identify
the relevant regression scenarios; check both desktop and mobile for UI changes.
