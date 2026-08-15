# Sunday meeting schedule

- Scope: `/meetings/sunday`; the leading view is separate. Main files: `loaders.ts`, `service.ts`, `actions.ts`, `sunday-schedule-view.tsx`, and its inline editor components.
- Reads are persisted-only. Mutations use server actions and revalidate both Sunday routes.
- Default range: up to 3 persisted Sundays before and 12 on/after the ward-local current/upcoming Sunday; cursor pages have at most 16. Boundary actions only appear on the global first/last page and create immediately outside that bound.
- Current Sunday is the ward-local Sunday on or after today. It is outlined; non-sacrament/non-fast-testimony meetings have a subtle fill, and desktop Date stays sticky.
- Schedule hymns and people edit inline on desktop and mobile. Single-person inputs hide when filled; multi-person entry remains available after adding or removing a chip. Hymn fields save on Enter, and the interlude accepts nonnumeric musical-number text. The people editor returns a member or free-text input, uses `maxPeople={1}` for leader/prayer/speaker, and exposes removable chips with light-red free-text values. Information remains a dialog; the leading view keeps its dialogs.
