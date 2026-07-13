# Next features
- Tasks
  - row is not good. state transition also bad
    - show the short label/name of the task
      - hover over it will show whole name
    - inspiration from clickup?
      - maybe use shadcn table?
    - Question is where to show current status?
    - check mark should be in first row
    - status should allow changing status anywhere with dropdown? (or maybe that should only be in modal?)
  - Task Type to have icon that we can show in table?
  - Priority and due date nowhere yet
  - hide until date (do not show task until given date) - option to show it in list?
    - easy way on sunday to quickly hide some (e.g. they are not there). but then to show those hidden
  - dialog to edit a task (title / description) instead of having edit in the list possible?
    - dialog should also show all the other fields and allow editing them. maybe status change to specific state only possible in here?
  - when filtering by single type, should we group by status? last status top?
  - priority whenever -> better name (this is probably for the backlog that we don't really show by default and hide?)
- Backup / Import
  - For now a simple json backup/import so that we can export all the data into a json and import it again. We can do that for example if we want to completely reset the db but then recreate last state.
- Sync
  - Show a button for both scripts?
  - Should we also sync the uuid from lcr (we get it in one of the scripts)?

# Future Improvements

## Auth
- Rate limiting on `requestLogin` (per email + per IP).
- "Resend" code / "Change email"

## API
- zed for api schema
- in setup if something bad, instead of error correct response and nicer error shown
