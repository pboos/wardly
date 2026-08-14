# Sunday meeting schedule

- Scope: `/meetings/sunday` schedule list, loader, and actions. The leading view is separate.
- Schedule reads are persisted-only; loading the list never creates meetings.
- The default page shows up to 3 persisted Sundays before the ward-local current/upcoming Sunday and up to 12 on/after it. Cursor pages contain at most 16 persisted meetings, and no page renders more than 16.
- Nonempty schedules show the before action only on the first persisted page and the after action only on the last persisted page. On desktop these are left-aligned inline table rows spanning the schedule columns; on mobile they sit before/after the card list. They create the Sunday immediately before the global earliest persisted meeting or after the global latest persisted meeting. Empty schedules have one bootstrap action for the ward-local current/upcoming Sunday. Dates are calculated by authenticated server/service operations.
- Ward-local convention: “current Sunday” means the Sunday on or after today in the ward time zone, including today when it is Sunday.
- Main files: `lib/sunday-meetings/loaders.ts`, `lib/sunday-meetings/service.ts`, `lib/sunday-meetings/schedule.ts`, `app/meetings/sunday/actions.ts`, and `app/meetings/sunday/sunday-schedule-view.tsx`.
- The schedule loader returns mapped persisted meetings directly; display projections are derived by the responsive list from the meeting data.
