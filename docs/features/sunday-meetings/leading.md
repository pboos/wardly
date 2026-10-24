# Sunday leading mode

The dated editor's **Leading mode** button opens
`/meetings/sunday/YYYY-MM-DD/leading`. **Edit mode** returns to the same meeting.
Both routes authenticate the user, validate the Sunday date, and use the existing
ward-scoped loader, which creates a missing meeting with its normal defaults.
Conference dates show a no-local-agenda message.

The reading view uses large responsive text, bold participant names, explicit
missing-assignment prompts, and visually distinct pause instructions. It has no
editing controls and does not advance tasks or record completion.

## Script rules

- The ward content language selects bundled English or German wording and dates.
  Regional English/German locales resolve to their language. Unsupported locales
  use English speech with a visible notice. Hymn lookup never substitutes another
  language's numbering; unavailable titles and assignments stay explicit.
- The script follows `buildAgendaRows(meeting, true)`, including saved section/order
  and sacrament-person grouping. Authored conductor text, meeting information,
  content, task titles and descriptions retain literal text and line breaks.
  Person names come from structured assignments, not guesses from prose.
- Opening/closing hymn and prayer introductions combine only when the corresponding
  slots are adjacent. The prayer remains at its saved position and receives thanks
  after its pause. Empty optional interludes are omitted; required empty slots remain.
- Consecutive talks share an introduction and final thanks. A different item ends
  the run. Each talk's saved topic/details stays with its own pause.
- The sacrament hymn introduces preparation, blessing and passing. Assignment rows
  retain their saved position. Completion thanks follows the passing pause only.
- Sustainings include support and opposition votes; releases invite appreciation.
  Aaronic calling information describes prior quorum sustaining without adding a
  ward vote or claiming an ordination or setting-apart time.
- `member_welcome` linked to `child_baptism` recognizes baptism and confirmation
  without a welcome vote. Ordinary member welcomes invite support. Confirmations,
  child blessings, musical numbers and children's presentations have separate
  introductions and pauses. Fast/testimony meetings automatically place the
  testimony invitation, pause and thanks after all saved program rows and before
  the closing section. Saved rows keep their order. Place introductions in the
  program section and text to read after testimonies in the closing section.

The script does not infer gender, baptism dates, calling offices, or class times.
Missing calling details remain a prompt. Saved free text can use any language;
only generated wording follows the ward language.

## Implementation and verification

- [Pure builder](../../../lib/sunday-meetings/leading-script.ts) owns ordering,
  adjacent grouping, introductions and thanks.
- [Copy expansion](../../../lib/sunday-meetings/leading-copy.ts) uses matching
  [English](../../../lib/sunday-meetings/leading-copy/en.json) and
  [German](../../../lib/sunday-meetings/leading-copy/de.json) JSON templates.
- [Route](../../../app/meetings/sunday/[date]/leading/page.tsx) loads the meeting
  and bundled hymn catalog. [Reader](../../../app/meetings/sunday/sunday-leading-script.tsx)
  renders spoken spans and pause cues without HTML interpolation.
- [Behavior tests](../../../lib/sunday-meetings/leading-script.test.mjs) cover both
  languages, ordering and adjacency, missing names/titles, sacrament thanks,
  task details, child baptism, meeting types, and key/placeholder parity.

Sunday mutations and ward settings revalidate the reading route. Verify the
editor/reader round trip and long names/content on desktop and mobile.
