# Sunday leading mode

The dated editor's **Leading mode** button opens
`/meetings/sunday/YYYY-MM-DD/leading`. **Edit mode** returns to the same meeting.
Both routes authenticate the user, validate the Sunday date, and use the existing
ward-scoped loader, which creates a missing meeting with its normal defaults.
Conference dates show a no-local-agenda message.

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
  saved role. Named organists/pianists and music conductors are thanked once before
  the first closing hymn/prayer, or at the start of closing if neither exists.
- The script follows `buildAgendaRows(meeting, true)` and saved section/order.
  Authored conductor text, meeting information and ordinary free text remain
  literal, including line breaks. Names come from structured assignments.
- Adjacent standard opening/closing hymn and prayer slots share an introduction.
  Prayers keep their position. Opening prayers receive thanks; closing-prayer
  slots anywhere and all prayers in the closing section never receive thanks.
- Each talk has a compact speaker line without topic/task details. Consecutive
  talks share final thanks with singular/plural wording; other items end the run.
  Intermediate hymns show number and title. Musical numbers show saved content or
  task title and optional named performers, with thanks only for named performers.
  Empty optional interludes are omitted. Transitions render a horizontal separator.
- The sacrament hymn introduces preparation, blessing and passing. Blessing and
  passing names, missing-name prompts and details are omitted. Sacrament thanks
  remains at the saved passing position.
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
  adjacent grouping, introductions and thanks.
- [Copy expansion](../../../lib/sunday-meetings/leading-copy.ts) uses matching
  [English](../../../lib/sunday-meetings/leading-copy/en.json) and
  [German](../../../lib/sunday-meetings/leading-copy/de.json) JSON templates.
- [Route](../../../app/meetings/sunday/[date]/leading/page.tsx) loads the meeting
  and bundled hymn catalog. [Reader](../../../app/meetings/sunday/sunday-leading-script.tsx)
  renders spoken spans, headings, rich list rows and separators without HTML interpolation.
- [Behavior tests](../../../lib/sunday-meetings/leading-script.test.mjs) cover both
  languages, ordering and adjacency, missing names/titles, sacrament thanks,
  calling lists, compact program rows, closing prayer exclusions, musician thanks,
  announcements, task details, child baptism, meeting types, and copy parity.

Sunday mutations and ward settings revalidate the reading route. Verify the
editor/reader round trip and long names/content on desktop and mobile.
