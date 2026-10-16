# Leadership meetings

`/meetings/bishopric` and `/meetings/ward-council` share dated, ward-scoped
agendas. The ward's existing type selects Bishopric/Branch presidency and
Ward council/Branch council labels. Every signed-in ward user can read and
change both agendas. Short decisions should exclude confidential counseling details.

## Meeting lifecycle

Set up a weekly interval or monthly ordinal-weekday schedule (first through fourth
or last) with a local start
time and target duration. Dates use the ward time zone. Setup plans the next
800 days. Extend schedule adds future dates. Reads never generate meetings.
The date picker includes planned, active, closed, and cancelled meetings.

- Start meeting freezes automatic reassignment of its agenda. Timers are available
  after starting, but starting a timer makes no server request.
- Reschedule changes an unstarted meeting; collisions are rejected. Cancelled
  dates remain exceptions when a series schedule is saved again.
- Schedule changes replace unstarted future slots and preserve existing items.
  Started and closed meetings retain their dates and contents. Changing only time
  retains the saved schedule anchor. Pristine standing items retire with removed
  slots and return when those slots return; explicit skips/removals stay resolved.
  Customized and carried standing discussions absorb matching generated items
  at their new destination, preserving their allocations, tasks, and due dates.
- Closing or cancelling asks whether unfinished items should move to the next
  meeting or be skipped. Resolved discussions remain in history.

## Agenda and recurrence

Add one-time topics or recurring templates. The editor previews the first three
calendar due dates and their assigned meetings. Recurrence supports every meeting,
every N weeks, day of month every N months, ordinal weekday (first through fifth
or last), and annual month/day. Missing fifth weekdays skip that month. Short months
clamp to their last day; annual February 29 becomes February 28 in non-leap years.
Calendar dates remain anchored when an occurrence is completed late.

Calendar obligations go to the last scheduled meeting on or before their due date.
If that meeting is already past or started/closed, an unassigned obligation goes
to the next unstarted meeting. Existing active discussions never move automatically.
Overdue dates remain visible. Several due obligations can share one discussion,
with separate occurrence records retaining the original due dates.

- Done resolves the current occurrence(s), leaving future recurrence intact.
- Continue next meeting records a discussion and creates a continuation.
- Move to next meeting defers without completing the discussion.
- Skip resolves only this occurrence. Remove from this agenda hides it and leaves
  an occurrence tombstone so refresh cannot restore it.
- Stop repeating archives the template and removes automatically generated future
  pending appearances. Current and carried discussions remain.
- Editing this meeting changes its title and allocation. This and future meetings
  changes the current appearance and replaces future recurrence while keeping its
  chosen calendar anchor. Already covered due dates and the source meeting are
  excluded from new appearances. Earlier completed history remains unchanged.

The compact Suggested items library is always available, including after removal.
Active suggestions show their local title, duration, and recurrence. Restore item
restores a removed appearance with its saved edits and existing template; it never
creates a second recurring series or reopens completed discussions. To change a
restored item, use its agenda editor. Already scheduled recurring suggestions cannot be
added again until their recurrence is stopped. A one-time suggestion removed
from a closed meeting can be chosen again without reopening the historical item.
No defaults are inserted automatically. Handbook frequency labels distinguish
specified responsibilities from suggested meeting rhythms. Suggested dates and
allocations are editable. Quarterly Report suggestions start in January, April,
July, or October. The library links each topic to its Handbook source.

## Timers and follow-up

Timer state, mute, pause/resume, expiry and extensions exist only in the current React
window. Reloading or selecting another meeting resets them. No timer table,
storage, synchronization, or timing mutation exists. Planned totals include local
extensions; remaining totals exclude resolved items and clamp overruns to zero.
The running item shows its overrun separately. Estimated finish uses the remaining
time. Expiry prompts the user; it never completes an item automatically.

A short decision is stored when an outcome is recorded. Follow-up tasks can be
created or linked independently before closing a meeting. Creation uses the enabled
ordinary Task type and its configured initial state. Discussion completion never
changes task completion, and notes are not automatically copied into tasks.

An explicit browser import previews the old bishopric localStorage list and adds
one-time items to the selected meeting. It preserves the source list, imports no
undated completion flags, and uses deterministic UUIDs to avoid repeated imports.

## Implementation and verification

[Calendar rules](../../../lib/leadership-meetings/calendar.ts) are pure.
[Services](../../../lib/leadership-meetings/service.ts) authorize ward ownership and
apply commands transactionally. [Store](../../../lib/leadership-meetings/store.ts)
materializes schedules and occurrences. [Read models](../../../lib/leadership-meetings/loaders.ts)
load only the authenticated ward. [Shared UI](../../../app/meetings/leadership/leadership-view.tsx)
uses guarded session-recovery actions. See [schema](../../DATABASE_SCHEMA.md#leadership-meetings).

`npm test` includes calendar edge cases and isolated SQLite tests against all
versioned migrations. Browser verification covers both meeting types, mobile forms,
local timers across windows/reloads, outcomes, and linked tasks. The additive
migration requires `prisma migrate deploy` and client regeneration; no reset.
