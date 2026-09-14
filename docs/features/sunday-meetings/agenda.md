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
- Musical numbers use free text for details and performer names, with no member
  selector. Interludes and extra hymns/musical numbers use the same hymn modal as
  the schedule; conversion to musical number is enabled for interludes and extra
  program entries. Existing linked performers are included in the text editor
  and become text when saved. Clearing/changing the hymn clears its person link.
- All other person assignments use the [shared people picker](schedule.md#people-picker)
  with vertical names and × removal. Topics and visitor/presiding roles have separate
  text editors; selecting a person no longer requires a source selector or topic field.
- Agenda sections are `opening → business → sacrament → program → closing`.
  `participants` is header context and never appears in this flow.
- Extra entries can be added with a type, section, and details. They append to the
  section; the service also supports insertion after an item in that section.
  “Add speaker” is a control outside the ordered list and appends a program talk.

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
- Task type/state configuration maps eligible tasks to `calling_sustain`,
  `calling_release`, or `priesthood_aaronic_inform`. Adding a suggestion rechecks
  eligibility, appends a linked business item, and rejects duplicate task links
  within that meeting. These types cannot be added as ordinary extra entries.
- The item keeps its task link if task state later changes; adding it does not
  advance task state. Candidate loading may still list an already-added task;
  the service rejects another insertion. Task-linked item types cannot be changed.
- Carry-forward moves the same item and its task/person data to the next local
  Sunday, creating it if necessary and skipping conferences (104-attempt limit).
  It appends in the same section and rejects a duplicate destination task link.
  Eligible types are task presentations, child blessings, welcomes, confirmations,
  announcements, ward business, and custom program items; talks/hymns/prayers are excluded.

## Implementation map

| Responsibility | Entry point |
| --- | --- |
| Leading view, sections, row actions | [leading view](../../../app/meetings/sunday/sunday-leading-view.tsx), [agenda component](../../../app/meetings/sunday/sunday-leading-agenda.tsx), [item actions](../../../app/meetings/sunday/sunday-item-actions.tsx) |
| Shared ordering and rendered rows | [order.ts](../../../lib/sunday-meetings/order.ts), [agenda.ts](../../../lib/sunday-meetings/agenda.ts), [order-service.ts](../../../lib/sunday-meetings/order-service.ts) |
| Templates, reconciliation, stable lookup | [templates.ts](../../../lib/sunday-meetings/templates.ts), [standard-items-service.ts](../../../lib/sunday-meetings/standard-items-service.ts), [slots.ts](../../../lib/sunday-meetings/slots.ts) |
| Create/update/delete and type changes | [item-service.ts](../../../lib/sunday-meetings/item-service.ts), [item-update-service.ts](../../../lib/sunday-meetings/item-update-service.ts), [meeting-service.ts](../../../lib/sunday-meetings/meeting-service.ts) |
| Suggestions and generated wording | [tasks.ts](../../../lib/sunday-meetings/tasks.ts), [support.ts](../../../lib/sunday-meetings/support.ts) |

## Verification

`npm test` includes ordering/agenda/slot/rule tests and `persistence.test.mjs`.
Regressions should exercise move → save → reload → displayed order, including
empty standards, hidden wording, section boundaries, clearing/refilling slots,
type changes, task links, carry-forward, and ward isolation. For UI changes also
check pending controls, dialogs, and narrow-screen layout.
