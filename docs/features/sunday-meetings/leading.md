# Sunday leading mode

The dated editor's **Leading mode** button opens
`/meetings/sunday/YYYY-MM-DD/leading`. **Edit mode** returns to the same meeting.
Both routes authenticate the user, validate the Sunday date, and use the existing
ward-scoped loader, which creates a missing meeting with its normal defaults.
Conference dates show a no-local-agenda message.

The reader defaults to short notes. Its top button switches to detailed reading
text with `?mode=detailed`; switching back removes the query. Only the exact
`detailed` value selects detailed text, including after reload. Both modes keep
the same dated meeting and use no client mode state.

The reading view uses large responsive text, bold participant names, simple lists,
subheadings and horizontal separators. It has no editing controls and does not
advance tasks or record completion. It generates no waiting instructions.

## Script rules

- The ward content language selects bundled English or German wording and dates.
  Regional English/German locales resolve to their language. Unsupported locales
  use English with a visible notice. Hymn lookup never substitutes another
  language's numbering; unavailable titles and required assignments stay explicit.
- The introduction starts with presiding/conducting rows, then the welcome.
  Visitors have their own heading and one row per person, including an optional
  saved role. Assigned organists/pianists and music conductors appear once under
  **Thanks**/**Dank**, in labeled role rows before the first closing hymn/prayer,
  or at the start of closing if neither exists. Unassigned musicians are omitted.
- The script follows `buildAgendaRows(meeting, true)` and saved section/order.
  Authored conductor text, meeting information and ordinary free text remain
  literal, including line breaks. Names come from structured assignments,
  falling back to the linked task's current member when the agenda item has no
  explicit person. This applies to existing and newly linked tasks; changes to
  the task's member appear when the meeting reloads.
- Notes show separate labeled opening/closing hymn and prayer lines. Detailed
  text pairs adjacent standard opening/closing hymn and prayer slots only.
  Prayers keep their position. Neither mode generates prayer or talk thanks.
- Notes show one compact line per talk without topics or task details. Detailed
  text introduces consecutive speakers together with singular/plural wording.
  Other items end the run. Program hymns show number and title; detailed hymn
  numbers and resolved titles use the same bold highlight as names, with generic
  emphasis spans. Missing prompts retain their warning style.
- Musical numbers show saved content or task title and optional named performers,
  with thanks only for named performers. Detailed text uses a fuller introduction.
  Empty optional interludes are omitted. Transitions render a horizontal separator.
- Notes show only the labeled sacrament hymn, a separate sentence announcing
  blessing/passing after the hymn, and a stop separator. Detailed text retains
  preparation wording and the separator, then thanks at the saved passing position.
  Neither mode shows blessing/passing names, missing-name prompts or details.
- Every local meeting ends with a Sunday and week well-wish after all closing
  items, even when there are no closing slots. Conferences have no well-wish.
- Contiguous calling-only runs become release and sustaining blocks, releases
  first. Each has a heading, introduction, one bold name plus office per list row,
  and vote wording. Offices use content, falling back to task title; task
  descriptions are omitted. Sustainings include opposition and thanks. Custom,
  unrelated and Aaronic-information rows end the run. Aaronic information adds no
  ward vote, ordination claim, or setting-apart location/time.
- Contiguous announcements receive one localized heading. A different item starts
  a new announcement group. Ordinary member welcomes invite support; child-baptism
  welcomes instead recognize baptism and confirmation. Confirmations, child
  blessings and children's presentations retain their introductions.
- Fast/testimony meetings place the testimony invitation and thanks after saved
  program rows and before closing. Put introductions in program and text to read
  after testimonies in closing.

Generated wording does not infer gender, baptism dates, offices, or class times.
Saved free text can use any language; generated wording follows the ward language.

## Implementation and verification

- [Pure builder](../../../lib/sunday-meetings/leading-script.ts) owns ordering,
  mode selection, adjacent grouping, introductions and thanks.
- [Copy expansion](../../../lib/sunday-meetings/leading-copy.ts) uses matching
  [English](../../../lib/sunday-meetings/leading-copy/en.json) and
  [German](../../../lib/sunday-meetings/leading-copy/de.json) JSON templates.
- [Route](../../../app/meetings/sunday/[date]/leading/page.tsx) loads the meeting
  and bundled hymn catalog. [Reader](../../../app/meetings/sunday/sunday-leading-script.tsx)
  renders spoken spans, headings, rich list rows and separators without HTML interpolation.
- [Behavior tests](../../../lib/sunday-meetings/leading-script.test.mjs) cover both
  languages and modes, exact notes/detailed output, ordering and adjacency, missing
  names/titles, hymn emphasis, sacrament stop rules, calling lists, compact program
  rows, absence of prayer/talk thanks, musician rows, final wishes, URL mode
  parsing, announcements, task details, child baptism, meeting types and copy parity.

Sunday mutations and ward settings revalidate the reading route. Verify the
editor/reader round trip and long names/content on desktop and mobile.
