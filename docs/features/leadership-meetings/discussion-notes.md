# Discussion notes

The discussion opens from an agenda row. Its question-mark button shows the
instructions snapshot. The compact local timer retains start, pause/resume,
extensions, mute, and sound testing. Assigned to and follow-up tasks keep their
meeting-specific behavior.

## Save and finish

This meeting holds notes for that dated discussion. Recurring topics also show
Shared notes for ongoing context. Shared notes show the current text across the
topic's meetings, including archived recurring history, rather than historical
snapshots. A one-time topic with no shared text shows only This meeting. Both note
fields accept at most 4000 characters.

Save & close saves both drafts and closes the dialog. Done saves both drafts and
resolves the occurrence atomically. Continue and Move also save both drafts with
the outcome. Closing with X, Escape, or outside the dialog saves dirty notes first.
Discard changes closes without saving either draft. Failed saves retain both
drafts and the selected tab. Task refreshes and setup saves preserve unsaved notes.
Historical notes remain editable without reopening outcomes or recurrence.

Each edited field supplies its previously saved text. A concurrent change rejects
the transaction and keeps the draft available to copy. An omitted shared edit
preserves existing text, including older callers and the agenda completion circle.
An explicit empty shared value clears it. Retrying an already-saved value succeeds.

## Previous notes

Previous meeting notes loads only when clicked and can collapse without losing
loaded pages. It returns up to 20 discussions per page, newest first by meeting
date and item ID. Only earlier dates in the same ward, series, and stable topic
qualify. Empty notes, removed discussions, and superseded meetings are excluded.
Several linked obligations return one discussion. Load more uses a date/ID cursor;
a failed page retains existing results and offers Retry previous notes.
Shared text is never presented as a previous meeting's snapshot.

## Identity and implementation

A required `meeting_agenda_template.topic_id` points to `meeting_agenda_topic`.
New topics get a parent once. Future edits copy that identity; continuations
retain occurrence links. Titles and suggestion keys never identify a topic, so
opening and closing Prayer keep separate notes. The development migration
backfills connected template components through shared appearances, including
transitive links, and preserves template fields and occurrence links.

[Notes service](../../../lib/leadership-meetings/notes-service.ts) and
[outcomes](../../../lib/leadership-meetings/outcome-service.ts) save within the
command transaction. [History](../../../lib/leadership-meetings/history.ts) derives
authorized identity from the item; clients never supply a topic ID. Its read action
uses session recovery and does not revalidate pages. The agenda loader fetches
shared notes in one batched topic query and sends no historical notes payload.
See [query verification](query-verification.md) and [schema](../../DATABASE_SCHEMA.md#leadership-meetings).

SQLite regressions cover stable identity, prayer independence, transitive migration
backfill and foreign keys, atomic conflicts and retries, historical amendments,
ward isolation, history filters and pagination, and bounded reads and bulk inserts.
