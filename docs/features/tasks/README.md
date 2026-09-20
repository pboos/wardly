# Tasks

`/tasks` manages ward tasks, their assignees, members, and lifecycle states.
The page retains its Tasks heading and Settings link; a + beside the filters
opens the add dialog. Active tasks can be filtered by All, Mine, or enabled type.
Past tasks are collapsible and load the latest 50 completed records.
Active tasks sort by resolved lifecycle completion percentage, highest first,
then by type display name A–Z. Equal ties retain newest-created-first order.
Status edits immediately re-sort the local list. Unknown types/states count as
0%; unknown types sort by their stored type key. Past tasks remain ordered by
completion date, newest first.
The type filter uses a wider selector and a viewport-constrained dropdown.
Type labels stay on one line, with ellipsis for names that exceed the available
width; filter controls wrap onto another row on narrow screens.

[Sunday reminders](reminders.md) email each user's unfinished assigned tasks
one hour before the ward's configured sacrament time. The email's
`/tasks?filter=mine` link selects Mine after normal login. Mine also filters the
displayed past tasks to the current assignee.

## Quick entry

- Click + or press **N** on this page to open the dialog focused on task-type
  search. The shortcut ignores typing controls, editable content, modifiers,
  composition, repeated key presses, and other open dialogs/menus/pickers.
- Entry progresses through **Task type → Member → Title → Assignee**, focusing
  each field automatically. Types with `showTaskTitle: false` skip Title and
  require a member. Other types allow skipping Member, but then require a title.
- Type to search and use arrows/Enter or click a result. Each selection advances;
  selecting the final assignee (or “Leave unassigned”) creates the task.
  Title uses Enter or Next. Back revisits earlier fields; Escape dismisses.
- Choosing a type with no title clears any earlier title. Search matches names;
  member/user IDs identify options, including people with identical names.
- Member choices in creation and editing group matches with default-excluded tags
  last, with muted names and explanatory tag badges. These members remain
  selectable. Exact matches rank first within each group; see [members](../members/README.md#member-selectors).
- Saving blocks repeat submissions and dismissal. Errors retain the draft and
  allow retry; success closes the modal, restores focus to +, and revalidates
  the page through the existing server action. Reopening starts a fresh draft.
- Only enabled types can be selected. If none are enabled, + is disabled and
  an explanation appears. Search lists and the dialog have viewport height
  limits and scroll on small screens.

## Initial statuses

Both temple recommend types, youth interviews, Aaronic Priesthood, and
Melchizedek Priesthood start with **Interview**. This is the display label for
the internal `todo` state: it remains `not_started`, with 0% progress and the
same color and dashed status icon as before. Priesthood workflows have a single
initial Interview step, followed by Sustain (Aaronic) or Stake interview
(Melchizedek); active progress is spaced evenly across the remaining steps.
Other types still start with **To do**.

These are code defaults. Stored ward lifecycle overrides retain their own labels
and steps. Older databases with priesthood tasks or state assignments using the
removed `interview` key need those mapped to `todo` before using the new default
lifecycle (or a development database reset).

## Type symbols

[TaskTypeIcon](../../../app/tasks/task-type-icon.tsx) maps stable type keys to
Tabler and custom React SVG components, sharing a 24×24 grid, rounded strokes,
and theme color. Calling/release use a briefcase with a bottom-right +/−;
temple recommends use an ID-card outline containing a stepped temple and central
spire. Limited recommends reserve the same bottom-right corner for an L drawn
as a path. Youth interviews use a close-up round face with a short hair tuft,
two eyes, and a subtle smile; the visible type name provides the interview context.
The custom shapes live in [CallingIcon](../../../app/tasks/calling-icon.tsx),
[TempleRecommendIcon](../../../app/tasks/temple-recommend-icon.tsx), and
[YouthInterviewIcon](../../../app/tasks/youth-interview-icon.tsx).
Task keeps its clipboard, priesthood types keep books with adjacent AP/MP
markers, and check-in keeps two speech bubbles. Custom/unknown keys fall back
to a tag. Corner markers have gaps around them and need no background fill.

Symbols appear in active/past type badges, task details, the creation picker,
the type filter, and settings. Compact badges expose the full name to assistive
technology, show a native title on hover, and expand the name on keyboard focus.
Pickers, details, and settings keep visible names. Symbols use semantic theme
colors; task state/progress indicators remain separate. The mapping is defined
in code, with no icon setting or database change.

## Data and entry points

- [Page](../../../app/tasks/page.tsx) loads ward tasks, members/users, and resolved
  [types](../../../lib/tasks/loader.ts). Types combine code
  [defaults](../../../lib/tasks/defaults.ts) and database overrides/custom types.
- [TasksView](../../../app/tasks/tasks-view.tsx) composes filters, quick entry,
  active tasks, and past tasks. [AddTaskButton](../../../app/tasks/add-task-button.tsx)
  owns the page shortcut and dialog lifecycle; [NewTaskDialog](../../../app/tasks/new-task-dialog.tsx)
  handles draft/steps/saving; [TaskChoiceStep](../../../app/tasks/task-choice-step.tsx)
  provides searchable keyboard selection.
- [TasksList](../../../app/tasks/tasks-list.tsx) composes the extracted row cells,
  state picker, actions, and [edit modal](../../../app/tasks/edit-task-modal.tsx).
- [Actions](../../../app/tasks/actions.ts) validate current-user ward ownership,
  enabled type and initial state, member/assignee membership, and title-or-member
  requirements. Creation copies the type's duration and initial lifecycle state.
- [Settings](../../../app/tasks/settings/tasks-settings-view.tsx) exposes existing
  type metadata and per-state assignment configuration.

See [database documentation](../../DATABASE.md) and [design guidelines](../../DESIGN.md).

## Verification

Run `bunx tsc --noEmit`, `bunx eslint app/tasks components/ui/combobox.tsx`, and
`npm test`. Interaction checks should cover type-ahead → Enter across every
step, hidden-title types, skipped optional fields, empty/no-match lists, Back,
Escape/focus restoration, failed-save retry, duplicate submission, IME/repeat
keys, disabled types, and shortcut isolation. Check dialog scrolling and filter
wrapping at narrow viewport sizes.
