# Sunday agenda and leading view

Scope: `/meetings/sunday/YYYY-MM-DD`, agenda persistence, ordering, and task integration.
Read the [overview](README.md) first; schedule-specific editing is in [schedule](schedule.md).

## Opening and editing a meeting

- The date path loads or creates that Sunday, including conference dates; invalid
  dates return 404. `/meetings/sunday/upcoming` starts with ward-local today if
  Sunday, otherwise the next Sunday, skips nonlocal conferences (104-attempt
  limit), and redirects to its dated path. Old `/meetings/sunday/leading?date=…`
  bookmarks redirect to the new path; the old undated route redirects to upcoming.
- Previous/next links move seven days. Conference dates show “No local agenda”.
  Local meetings show a leader reminder until a leader row exists; editing remains
  available. Presiding is a separate optional assignment, not inferred from leader.
- Meeting context contains leader, presiding, organists, music conductors, visitors,
  and meeting information. Support text and assignment history are hidden by default.
- Agenda cards use compact spacing and top-right reorder arrows. Extra entries
  keep section movement and deletion in the adjacent “More agenda item actions” menu.
  Hymns (🎵), musical numbers (🎶), prayers (🙏), talks (🎤), and sacrament
  blessing/passing use a single inline row; long content wraps on narrow screens.
  Person assignments use an accessible + control when empty. Talk topics and
  sacrament details are clickable text; empty text shows an add prompt.
- Convert confirmations, member welcomes, and child blessings also use compact
  title-and-name rows, with the same member/free-text picker as talks and prayers.
  They no longer offer details fields when adding or editing; previously saved
  details remain stored. Clicking an assigned single-person name opens the picker
  to replace it; × retains the existing removal behavior.
- Ward business and conductor text display clickable multiline text below the
  title, opening a free-text modal (or an add prompt when empty) in any section.
  Eligible rows have a skip-forward icon immediately before the reorder arrows.
- Musical numbers use free text for details and performer names, with no member
  selector. Interludes and extra hymns/musical numbers use the same hymn modal as
  the schedule; conversion to musical number is enabled for interludes and extra
  program entries. Clicking the displayed hymn/musical-number text opens this
  autocomplete; there is no separate musical-number details/performers dialog.
  Existing linked performers are included in the autocomplete text
  and become text when saved. Clearing/changing the hymn clears its person link.
- All other person assignments use the [shared people picker](schedule.md#people-picker)
  with vertical names and × removal. Topics and visitor/presiding roles have separate
  text editors; selecting a person no longer requires a source selector or topic field.
- Agenda sections are `opening → business → sacrament → program → closing`.
  `participants` is header context and never appears in this flow.
- Each of the five section headings has a right-aligned, accessible + control,
  replacing the global add button. Its dialog fixes the destination section and
  offers only permitted item types plus optional details. New entries append;
  the service also supports insertion after an item in that section.
  “Add speaker” is a control outside the ordered list and appends a program talk.

## Adding items by section

The dialog and server share creation rules in
[add-item-rules.ts](../../../lib/sunday-meetings/add-item-rules.ts).

| Item type | Allowed sections when adding |
| --- | --- |
| Member welcome, naming and blessing a child, convert confirmation, ward business | Ward business |
| Prayer | Opening, Closing |
| Musical number | Opening, Program, Closing |
| Hymn | Opening, Sacrament, Program, Closing |
| Blessing or passing the sacrament | Sacrament |
| Talk, primary presentation, custom program item, transition | Program |
| Announcement | Opening |
| Conductor text | All five agenda sections |

These rules apply only to new extras. Existing items are preserved and extra
items can still move to any agenda section, regardless of type. Participant
controls, task suggestions, and standard-slot movement rules are unchanged.

## Standard entries and lifecycle

| Section | Standard slots created for local meetings |
| --- | --- |
| Opening | `opening_hymn`, `opening_prayer` |
| Business | None |
| Sacrament | `sacrament_hymn`, `sacrament_blessing`, `sacrament_passing` |
| Program | `interlude` for sacrament/ward conference; `primary_presentation` for children's presentation; none for fast/testimony |
| Closing | `closing_hymn`, `closing_prayer` |

- Every displayed agenda row is saved, including empty standard entries. A
  non-null `slot` is unique per meeting; lookup never infers identity from position.
  Additional entries of the same type have `slot = null`.
- Standard entries can move within their section. They cannot be deleted or moved
  to another section; clearing their fields preserves ID, slot, and position.
  Their item type is fixed except interlude can switch between hymn and musical number.
- Updating an extra entry to have no person, text, or metadata deletes it.
  Standard slots, transitions, and task-linked entries are exempt. A transition
  must contain no person/text/metadata and renders as a separator.
- Changing a local meeting type reconciles standard slots: retained slots keep
  identity/order; missing slots append; obsolete empty slots are deleted; obsolete
  populated slots become extra entries with their content preserved.
- Changing to stake/general conference is blocked while any extra item or populated
  standard entry remains. Empty standards are removed. Returning to a local type
  creates its standard entries. Conference information cannot be edited; existing
  meeting information is not cleared by changing type.

## Ordering rules

- Saved order is section order, then integer `order_index`, then ID as a deterministic
  tie-break. Reordering renumbers affected sections; there are no type ranks,
  fractional positions, or virtual placeholders to merge into the list.
- Arrows swap with the next/previous visible entry in the same section. They stop
  at boundaries. “Move to section” explicitly appends an extra entry elsewhere;
  moving into or out of `participants` is disallowed.
- With support text hidden, `conductor_text` moves with the following visible entry;
  trailing wording moves with the section's last entry. With text shown, each row
  moves independently. Two conductor-text entries cannot be adjacent in final order.
- UI availability and server writes share `moveAgendaItems`. Requests send direction
  or destination section plus `showSupportText`; the server computes against current
  saved items in a transaction. Reorder controls disable during save/refresh.

## Support text and task presentations

- Generated support blocks describe visitors/presiding and certain business items.
  They are derived text, distinct from editable `conductor_text` agenda rows.
  Generated wording is currently English placeholder text; `content_locale` is stored
  but not yet used to localize it.
- Ward business contains an expanded-by-default “Available tasks” list with a
  collapsible heading, checkboxes, and “Add selected”. Candidates are derived
  from resolved task state configuration (`sunday_meeting_item_type`), including
  code defaults when the ward has no database lifecycle override. Only
  `calling_sustain`, `calling_release`, and `priesthood_aaronic_inform` are supported.
- Unselected candidates have no agenda row. Tasks already in this meeting are
  excluded; tasks on other Sundays show “Moves from [date]”. Selected tasks save
  atomically as separate business entries with the mapped type, task member/title,
  and task link. Eligibility and ward ownership are rechecked during the transaction.
- A task can belong to only one Sunday, enforced by a unique `task_id` index.
  Selecting it elsewhere moves the existing item, retaining its ID, details, and
  person data, and appends it to Ward business. Source/destination order is normalized;
  moves that leave adjacent conductor text fail without partial changes.
- Adding does not advance task state. Existing links survive subsequent state
  changes; deleting an agenda entry makes its task available again if eligible.
  Task presentation types cannot be added as ordinary extras or manually changed.
- Carry-forward moves the same item and its task/person data to the next local
  Sunday, creating it if necessary and skipping conferences (104-attempt limit).
  It appends in the same section and rejects a duplicate destination task link.
  Eligible types are task presentations, child blessings, welcomes, confirmations,
  announcements, ward business, conductor text, and custom program items;
  talks/hymns/prayers are excluded. Carry-forward rejects moves that would leave
  adjacent conductor-text entries in either meeting.

## Implementation map

| Responsibility | Entry point |
| --- | --- |
| Leading view, sections, row actions | [leading view](../../../app/meetings/sunday/sunday-leading-view.tsx), [agenda component](../../../app/meetings/sunday/sunday-leading-agenda.tsx), [item actions](../../../app/meetings/sunday/sunday-item-actions.tsx) |
| Shared ordering and rendered rows | [order.ts](../../../lib/sunday-meetings/order.ts), [agenda.ts](../../../lib/sunday-meetings/agenda.ts), [order-service.ts](../../../lib/sunday-meetings/order-service.ts) |
| Templates, reconciliation, stable lookup | [templates.ts](../../../lib/sunday-meetings/templates.ts), [standard-items-service.ts](../../../lib/sunday-meetings/standard-items-service.ts), [slots.ts](../../../lib/sunday-meetings/slots.ts) |
| Create/update/delete and type changes | [item-service.ts](../../../lib/sunday-meetings/item-service.ts), [item-update-service.ts](../../../lib/sunday-meetings/item-update-service.ts), [meeting-service.ts](../../../lib/sunday-meetings/meeting-service.ts) |
| Suggestions, task selection, and generated wording | [tasks.ts](../../../lib/sunday-meetings/tasks.ts), [task item service](../../../lib/sunday-meetings/task-item-service.ts), [Ward business picker](../../../app/meetings/sunday/sunday-business-tasks.tsx), [support.ts](../../../lib/sunday-meetings/support.ts) |

## Verification

`npm test` includes ordering/agenda/slot/rule tests and `persistence.test.mjs`.
Regressions should exercise move → save → reload → displayed order, including
empty standards, hidden wording, section boundaries, clearing/refilling slots,
type changes, task links, carry-forward, and ward isolation. For UI changes also
check pending controls, dialogs, and narrow-screen layout. Persistence tests also
cover every creation type/section combination and unrestricted extra-item moves,
edits, and reloads.

Task-selection persistence checks cover batch rollback, cross-Sunday moves, task
identity/details, state mapping overrides, database uniqueness, ward isolation,
removal/reselection, and carry-forward.
