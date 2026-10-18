# Leadership meetings

`/meetings/bishopric` and `/meetings/ward-council` share dated, ward-scoped
agendas. The ward's existing type selects Bishopric/Branch presidency and
Ward council/Branch council labels. Every signed-in ward user can read and
change both agendas. Short decisions should exclude confidential counseling details.

## Meeting lifecycle

Set up a weekly interval or monthly ordinal-weekday schedule (first through fourth
or last) with a local start
time. Dates use the ward time zone. Setup plans the next
three calendar months from today in the ward time zone, with month-end dates clamped.
Opening either meeting page refreshes this rolling window before loading the agenda;
read models themselves never generate meetings. Existing later dates and history remain.
The date picker includes planned, active, closed, and cancelled meetings.

- Start on an agenda row opens its discussion and begins a local timer. The first
  start activates a planned meeting, freezing automatic agenda reassignment. Later
  timer controls make no server request.
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

Compact rows show completion, title, assignee when set, minutes, recurrence, task count, and Start.
Agenda setup offers an optional Default assignee from the ward's users (Assigned to
for one-time topics). In the discussion, Assigned to changes only that meeting;
choose Unassigned to clear it explicitly or Use recurring default to reset it.
Different meetings can name different people for the same recurring topic.
Changing a recurring default updates pending planned appearances from the edited
meeting forward, preserving explicit choices, continuations, and historical discussions.
Editing recurrence and rescheduling also preserve meeting-specific assignments;
conflicting explicit assignees keep separate discussions instead of merging.
Deleting a user clears their assignments and defaults.
The completion circle marks a pending item Done. Clicking the title, row, or task
count opens one discussion dialog. Quick add takes a title and a right-aligned
duration with a visible min suffix. Agenda durations accept whole minutes from
1 through 90 in quick add and Edit setup. Edit setup inside the discussion contains
title, duration, recurrence, and edit scope.
Drag the handle to reorder with a mouse or touch, or focus it and use the up/down
arrow keys. Each reorder validates and saves the entire visible agenda atomically,
including resolved items. Reordering applies only to the selected meeting.
Use this order for future meetings saves the displayed recurring order as the
series default and applies it to pending recurring slots in future planned meetings.
One-time and resolved rows retain their slots; started, closed, cancelled, and past
meetings are unchanged. Monthly templates absent from the selected agenda keep
their default slots. Newly appearing or moved recurring items insert by default
rank while preserving existing rows' relative order. Future series edits inherit
the replaced template's rank; new templates append to the default order. The future-order
action sits below the agenda on the left, with planned and remaining totals on the right.
Reschedule, cancel, and close controls appear beside the alarm control in the header.
The Meeting schedule gear edits a configured schedule; unconfigured pages show a setup button.
Explicitly moving unfinished work can create the next scheduled date beyond the rolling window.

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
- Skip resolves only this occurrence. Remove item asks for This meeting only or
  This and future meetings, then Confirm removal. Both preserve records, notes,
  task links, and resolved history. This meeting only hides the appearance.
  This and future meetings archives linked templates and hides matching pending
  appearances in this and later planned or active meetings, including carried discussions.
  Shared historical occurrence statuses remain intact; archived templates prevent
  regeneration. Dirty notes save before removal; a failure keeps the dialog draft.
- Edit this occurrence changes its title, Markdown instructions, and allocation.
  Edit recurring series changes the current appearance and replaces future
  recurrence while keeping its calendar anchor. Completed history keeps its
  instructions snapshot. Omitted instructions in older API callers preserve the
  appearance; an explicit empty string clears them.

See [agenda instructions and suggested items](instructions-and-suggestions.md)
for Markdown snapshots, direct additions, recurrence defaults, and bulk ordering.

## Timers and follow-up

Timer state, mute, pause/resume, expiry and extensions exist only in the current React
window. Reloading or selecting another meeting resets them. No timer table,
storage, synchronization, or timing mutation exists. Planned totals include local
extensions; remaining totals exclude resolved items and clamp overruns to zero.
The running item shows its overrun separately. Estimated finish uses the remaining
time. Expiry appears in the discussion; it never completes an item automatically.
The timer keeps running when its dialog closes. Start and Unmute prime a reusable
AudioContext from the user gesture, Test sound verifies browser sound, and each
expiry sounds once. An extension rearms the next expiry. Sound failures are
visible. Resources close when the meeting view unmounts. Editing a started item's
planned minutes preserves elapsed time and adjusts the remaining allocation.
An existing local clock keeps its allocation when another window changes the
agenda; starting/resuming or extending it picks up the updated allocation.

Discussion notes stay editable in the discussion dialog, including resolved
items and closed/cancelled meetings. Save notes writes independently; closing the
dialog saves dirty notes, and an outcome saves the latest notes atomically.
A failed save retains the draft. Concurrent note edits are rejected with an error;
Discard unsaved notes and close provides an explicit way to reopen the saved
version. Task refreshes preserve unsaved notes and setup drafts. Historical note
or task amendments never reopen outcomes, dates, or recurrence.

Follow-up tasks can be created or linked in the same discussion, including after
the meeting closes. Prayer and Spiritual thought omit task creation/linking
controls and empty task counts, based on the original suggestion key even after
renaming. Existing linked tasks remain visible. Custom topics allow tasks.
Creation uses the enabled
ordinary Task type and its configured initial state. Discussion completion never
changes task completion, and notes are not automatically copied into tasks.

## Implementation and verification

[Calendar rules](../../../lib/leadership-meetings/calendar.ts) are pure.
[Services](../../../lib/leadership-meetings/service.ts) authorize ward ownership and
apply commands transactionally. [Store](../../../lib/leadership-meetings/store.ts)
materializes schedules. [Reconciliation](../../../lib/leadership-meetings/reconcile.ts)
loads existing occurrence graphs in one batch and skips unchanged rows. Its snapshot
lasts only until the first reconciliation change; repairs then read fresh graphs to
preserve shared discussions. Schedule creation, restorations, and existing agenda
moves still run transactionally. [Read models](../../../lib/leadership-meetings/loaders.ts)
load only the authenticated ward. [Shared UI](../../../app/meetings/leadership/leadership-view.tsx)
uses guarded session-recovery actions. See [schema](../../DATABASE_SCHEMA.md#leadership-meetings).

`npm test` includes calendar edge cases and isolated SQLite tests against all
versioned migrations. Browser verification covers both meeting types, mobile forms,
local timers across windows/reloads, outcomes, and linked tasks. The additive
migration `20261017120000_agenda_assignees` now includes instructions and command
receipts. Regenerate the Prisma client. Development databases that already applied
that migration require an explicit reset; `demo:reset` recreates only the isolated
demo database. No new migration was added.
