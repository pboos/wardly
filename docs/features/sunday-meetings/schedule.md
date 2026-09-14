# Sunday meeting schedule

Scope: the multi-date planner at `/meetings/sunday`. Read the [overview](README.md)
for the shared model and [agenda](agenda.md) for ordering and meeting-type transitions.

## Dates and creation

- The default page contains up to 3 saved meetings before and 12 on/after the
  ward-local current/upcoming Sunday. Rows always display in ascending date order.
- Query parameters are Sunday date strings: `anchor` centers that same 3/12
  window on a date; `before` and `after` return up to 16 saved meetings strictly
  before/after their cursor. Precedence is `before`, then `after`, then `anchor`.
- Invalid cursors are ignored. An empty cursor result with existing history
  falls back to the default page. Paging counts saved meetings, not calendar weeks.
- With no meetings, “Add current Sunday” creates the current/upcoming Sunday.
  Boundary actions appear only on the global first/last page and create exactly
  one Sunday before the earliest or after the latest saved meeting. They do not
  fill gaps between dates. Each mutation calculates the boundary on the server.
- “Open upcoming meeting” uses `/meetings/sunday/upcoming` to select the next
  local meeting and redirect to `/meetings/sunday/YYYY-MM-DD`. Individual date
  links open that path directly. Details link back with `anchor=<date>`.

## Editing and display

- Desktop uses a horizontally scrollable table with a sticky Date column;
  below the `md` breakpoint the same data and editors appear in stacked cards.
  The current/upcoming Sunday is outlined. Types other than sacrament and
  fast/testimony receive a subtle fill.
- Cells expose type, leader, organists, music conductors, four hymn slots,
  information, opening/closing prayers, and speakers. Conference rows omit
  local editing. Children's presentations omit speaker editing.
- Hymn/prayer cells resolve a stored `slot` key. Speaker cells show only `talk`
  rows in `program`, in saved order. A talk moved to another section remains
  on the agenda but is absent from schedule speaker cells.
- Hymn fields save on Enter; Escape restores the server value. A hymn number
  must be an integer from 1 to 9999. Interlude also accepts nonnumeric musical
  number text. Clearing a standard entry retains its ID and position.
- People use the shared picker described below. Schedule chips lay out horizontally
  and wrap when needed, with no permanent text input or enclosing input border.
- Removing a speaker clears the person; a topic-only talk stays. Adding a person
  to an existing talk keeps its topic; filling an unused speaker cell appends a talk.
  Desktop reserves at least three speaker columns and expands for existing talks.
- Information uses a text dialog. Ward settings store a validated content locale
  and time zone. Dates currently display in English; support wording's locale
  limitation is described in [agenda](agenda.md#support-text-and-task-presentations).

## People picker

The same `SundayPeoplePicker` serves the schedule and details. Its `layout` prop
selects horizontal chips (schedule) or vertical rows (details). Every name has an
× removal button. A + sits beside the last name; empty fields show “+ Add <role>”.
Single-person fields hide + when filled. The parent supplies add/remove callbacks
so standard-slot clearing and extra-item deletion retain their existing rules.

Clicking + opens a compact modal with a dimmed background and an autofocus search
input. Partial names show member suggestions; arrow keys change the selection.
Enter adds the selected member. With no match, Enter adds the trimmed free-text
name and the option says “Enter to add a non-member”. A free-text alternative is
also available for partial matches; an exact member name defaults to that member.
The Add button supports touch input. Success closes the modal; Escape, Cancel,
or clicking outside dismisses the draft. Save errors keep the draft for retry;
pending state blocks duplicate submissions. IME composition Enter does not save.

## Assignment history

History is derived from all saved member-linked talk/prayer items in the ward,
independent of the selected meeting or schedule page. Free-text people have no
member history. “Last” is the latest date before ward-local today; “next” is the
earliest date on/after today. The details view and person picker can use this data.
The history list sorts by last-talk date, falling back to last-prayer date,
with no history first; it does not compute a combined most-recent assignment.

## Implementation map

| Responsibility | Entry point |
| --- | --- |
| Paging queries, batched item loading, history | [loaders.ts](../../../lib/sunday-meetings/loaders.ts) |
| Page limits, cursor validation, boundary/display flags | [schedule.ts](../../../lib/sunday-meetings/schedule.ts) |
| Calendar arithmetic and creation defaults | [calendar.ts](../../../lib/sunday-meetings/calendar.ts), [meeting-service.ts](../../../lib/sunday-meetings/meeting-service.ts) |
| Schedule composition and responsive layouts | [sunday-schedule-view.tsx](../../../app/meetings/sunday/sunday-schedule-view.tsx), [table row](../../../app/meetings/sunday/sunday-schedule-table-row.tsx), [mobile card](../../../app/meetings/sunday/sunday-schedule-mobile-card.tsx) |
| Shared editors and slot lookup | [people picker](../../../app/meetings/sunday/sunday-people-picker.tsx), [picker modal](../../../app/meetings/sunday/sunday-person-picker-dialog.tsx), [hymn editor](../../../app/meetings/sunday/sunday-inline-hymn-editor.tsx), [slots.ts](../../../lib/sunday-meetings/slots.ts) |
| History calculation | [history.ts](../../../lib/sunday-meetings/history.ts) |

## Verification

`npm test` includes `schedule.test.mjs`, `history.test.mjs`, and `slots.test.mjs`.
For UI changes check empty schedules, both paging boundaries, ward-local dates,
Enter/Escape hymn editing, modal autofocus/dismissal, member/free-text Enter selection,
chip removal, pending/error states, and horizontal/vertical layouts.
`sunday-person-choices.test.mjs` checks member matching and non-member choices.
