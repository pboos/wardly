# Sunday task reminders

Every Sunday, each user with unfinished assigned tasks receives one email with
all those tasks, including future-dated tasks and tasks of disabled types.
Completed/unassigned tasks and users with no unfinished tasks are excluded.
Conference Sundays send normally; no saved Sunday meeting is required.

## Setup and links

- [Setup](../../../app/setup/page.tsx) requires the sacrament start time (`HH:mm`)
  and an IANA time zone. The searchable picker contains the server runtime's
  supported zones plus UTC and the browser-detected zone, preselected on hydration.
  This is the user's device zone, not the server zone. Both fields are validated
  by the [setup action](../../../app/setup/actions.ts).
- The existing ward `time_zone` also controls Sunday schedule dates. Wards
  created outside setup with no `sacrament_start_time` receive no reminders.
  Signed-in ward users can change these settings under
  [Admin → Ward settings](../ward-settings/README.md). Changes are read on
  subsequent scheduler passes.
- Emails include type/state labels, title, member name, description, priority,
  and due date. HTML values are escaped; a plain-text version is also sent.
  Email wording is currently English regardless of ward content language.
- “View my tasks” opens `/tasks?filter=mine`, using `APP_URL` as the public origin.
  Normal authentication applies and preserves that destination through login.
  Mine filters active and displayed past tasks; past tasks still come from the
  latest 50 ward-wide completed records, so older personal history can be absent.

## Scheduling and operation

[instrumentation.ts](../../../instrumentation.ts) starts a Node-only scheduler
once per process. It checks immediately and 60 seconds after each completed pass.
Production enables it by default; `TASK_REMINDERS_ENABLED=false` disables it,
and `true` opts development in. Build runs and `LOCAL_AUTH_BYPASS=true` never send.
Use an always-running Node server; serverless/suspended instances are unsupported.
No external cron or additional Docker service is needed.

Configure `APP_URL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and the existing SMTP
port/TLS/from settings in the runtime environment. Docker deployments must pass
these variables into the application container. `.env.example` lists the settings.
The scheduler logs aggregate sent/failed counts and failures without email bodies
or SMTP credentials. Delivery records retain generic errors and attempt counts.

The send window is `[meeting instant − 1 hour, meeting instant)`, allowing catch-up
after a restart until meeting start. There is no later catch-up for missed weeks.
Polling and SMTP delivery introduce latency; this is not an exact-second guarantee.
Time-zone rules handle DST and fractional offsets. Repeated wall times use their
first occurrence; nonexistent wall times skip that Sunday. A meeting shortly
after midnight can have its reminder on Saturday evening.

## Delivery coordination

[Delivery claims](../../../lib/tasks/reminder-delivery.ts) use the unique
`(ward_id, user_id, sunday_date)` key and atomic conditional updates. A worker
claims a five-minute lease, renewed every minute while working. Only its claim
token can finalize or reschedule the delivery. Expired leases can be reclaimed.
Failures retry after 1, 2, 4, 8, then 15 minutes, capped by the meeting start.
Retries reload the current unfinished assignments. SMTP acceptance marks `sent`;
normal polls, concurrent workers, and restarts then skip that week's delivery.
Changing time/zone does not resend an already-sent user/date.

SMTP acceptance and database completion cannot be atomic: a crash between them
can produce a duplicate. A process suspended longer than its lease can also lose
ownership while an SMTP send is in flight. Inbox delivery is not tracked. Delivery
records currently remain until their user/ward is deleted; no automatic retention
cleanup is implemented. All workers must share the same database for coordination.

## Implementation and verification

- [Schedule](../../../lib/tasks/reminder-schedule.ts): pure zone/time validation,
  wall-time resolution and send window.
- [Service](../../../lib/tasks/reminder-service.ts): recipient selection, fresh
  task loading, claims, SMTP handoff, retries and finalization.
- [Scheduler](../../../lib/tasks/reminder-scheduler.ts): process lifecycle and logs.
- [Email](../../../lib/tasks/reminder-email.ts), [SMTP](../../../lib/email.ts).

`npm test` covers time windows, DST changes, midnight/fractional offsets, escaped
email content, setup validation, weekly deduplication, conference Sundays,
concurrent claims, retries, and stale claim ownership against temporary SQLite.
Also run TypeScript, ESLint on changed files, and the production build.
See [database schema](../../DATABASE_SCHEMA.md) for storage.
