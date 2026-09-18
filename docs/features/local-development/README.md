# Local demo and email-free login

Use `npm run dev:demo` (or `bun run dev:demo`) for a local playground with
fictional data and the real login/session flow, without SMTP setup. Requires
installed dependencies and Node 22.18+/24+. No `.env` setup is needed for demo mode.

## Commands and accounts

| Command                           | Behavior                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev:demo`                | Generate Prisma client, apply migrations, seed if empty, start Next development server on `127.0.0.1:3000`. |
| `npm run demo:seed`               | Prepare the same demo database without starting a server.                                                   |
| `npm run demo:reset`              | Recreate only the demo database and seed fresh data; stop the development server first.                     |
| `npm run dev:demo -- --port 3001` | Start on another port, useful for browser automation.                                                       |

Log in with `demo@example.test` (Martin Keller), `anna@example.test` (Anna Meier),
or `lukas@example.test` (Lukas Weber). Submit the email, then enter **123456**.
The login screen explains that no email is sent. Existing users added to this
database can also use the fixed code; unknown email addresses cannot log in.

## Isolation and persistence

- The launcher explicitly overrides `DATABASE_URL`, `JWT_SECRET`, and
  `LOCAL_AUTH_BYPASS` for its process and children. It uses
  `.local-demo/demo.db` and a generated, persistent `.local-demo/jwt-secret`.
  The entire directory is gitignored; normal configured databases are untouched.
- Normal `dev`, `build`, `start`, and Docker startup never run the demo seed.
  Demo commands reject a non-development `NODE_ENV`.
- Seeding runs in one transaction only when no ward exists. Restarting does not
  overwrite edits, restore deleted records, or shift dates. Reset refreshes dates
  relative to the current day in `Europe/Zurich` and removes all demo edits.
- The fixture contains one German-content ward, three users, twelve members,
  ten tasks, and eight Sunday meetings (three past, current/upcoming, four future).
  It includes completed/overdue/unassigned tasks, a linked calling, hymn history,
  participants, speakers, and partially empty future agendas. Names, emails,
  and personal details are fictional. Existing automatic task types are reused.
- Member fixtures include one moved-out member and shared Focus, Unknown, and
  No contact tags, including a member with multiple tags.
- All twelve members have stable fictional external UUIDs and canonical `m`/`f`
  genders. Seven households include Martin/Elena/Noah (HEAD/SPOUSE/CHILD),
  Anna/Mia, Sarah/Jonas, Daniel/Clara, and three single-person households for
  Lukas, Peter, and Ruth (HEAD). Household UUIDs are stable across resets and
  stored on each member. Shared households can include different surnames.
- The demo ward uses `Europe/Zurich` and an example sacrament start time of
  `09:00`. Sunday task reminders remain disabled because demo mode enables
  `LOCAL_AUTH_BYPASS`; no reminder emails are sent, even with
  `TASK_REMINDERS_ENABLED=true`. See [task reminders](../tasks/reminders.md).
- German content selects the German hymn catalog; the app interface and current
  support-text placeholders remain English. See [hymns](../hymns/README.md).
- The demo signing key is separate from normal sessions. Switching between modes
  on the same browser hostname may require logging in again. Normal and demo dev
  servers share Next's development output and should not run simultaneously.
- After incompatible edits to the initial migration, reset the demo database.
  See [database setup](../../DATABASE.md) for schema and migration conventions.

## Email-free login with your normal local database

Set `LOCAL_AUTH_BYPASS="true"` in `.env` and run `npm run dev`. This enables the
same fixed code for existing users without seeding data. Complete `/setup` first
if the database is empty. Normal local development still requires a `JWT_SECRET`.
The flag defaults to false in `.env.example`; restart after changing it.

The bypass is server-controlled and requires `NODE_ENV=development`. Enabling it
in a build or production startup throws an error. Verification also rejects a
previously issued fixed code when the flag is disabled. Login requests, hashed
codes, expiration, attempt limits, one-time use, redirects, and signed sessions
remain in place. Only code generation and email delivery change.

## Implementation and verification

- [Launcher](../../../scripts/demo.mjs) prepares the isolated database before Next starts.
- [Seed](../../../scripts/demo/seed.ts) reuses Sunday calendar rules and agenda templates.
- [Auth guard](../../../lib/auth/local-development.ts), [constants](../../../lib/auth/constants.ts),
  and [login actions](../../../app/login/actions.ts) implement the fixed-code flow.
- [Login page](../../../app/login/page.tsx) passes the development hint to the form.
- `npm test` includes isolated database tests for fixture validity, preserved edits,
  environment rejection, no-email login, session issuance, invalid/expired/reused
  codes, attempt limits, unknown users, and returning to normal email login.
