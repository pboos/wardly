---
name: check-ui
description: Verify local app UI changes in Chromium with Playwright, including responsive layouts, interaction assertions, computed colors, screenshots, and failure recovery. Includes Wardly demo login and Linux/WSL browser setup. Use for browser verification or reproducing visual bugs, rather than for implementing UI components.
---

# Check UI

Use a real browser to verify the behavior changed by the task. Screenshots alone
do not establish that a control works; a successful build does not establish
that the running dev server is serving current CSS.

## Prepare the local app

- Read the feature overview and relevant design/testing instructions in the repo.
  For Wardly, consult `docs/features/README.md` and
  `docs/features/local-development/README.md`.
- Identify any existing server and its URL/mode before starting another.
  Wardly's `npm run dev:demo` uses fictional data and an email-free login.
  Its documented command `npm run dev:demo -- --port 3002` selects another port,
  but two Next dev servers still conflict when sharing the same checkout/output.
- Reuse an appropriate running demo server. Do not stop another user's server,
  reset a database, or change auth/environment configuration just to run checks.
  Start a server only if needed and stop only servers you started.
- Scope mutations to disposable records in the confirmed local demo environment.
  Record original state if editing existing data and restore it in `finally`.
  Prefer a uniquely named test tag/item that can be deleted afterward.
- Honor tool sandbox requirements. DNS failures, local-port EPERM, and restricted
  browser launch may need the tool's escalation mechanism; retry the actual
  failed operation with the required permission rather than changing tools.

## Reuse the browser runtime

Prefer an existing browser tool or the project's Playwright harness when present.
Otherwise use [runtime setup and troubleshooting](references/runtime.md).
Install temporary dependencies outside the repository; do not add an app
dependency merely for an exploratory check.

The [runner](scripts/run-check.mjs) loads Playwright from an external runtime,
launches Chromium, and passes `page`, `context`, `browser`, `expect`, `baseURL`,
and `outputDir` to a scenario's default export. It closes the browser on failure,
saves a failure screenshot, and records page errors and failed requests.

Copy [the Wardly scenario](assets/wardly-check.mjs) to a temporary file and adapt
it to the feature. It demonstrates the real email-free login, semantic locators,
responsive assertions, computed colors, and screenshots. It does not create data.

```bash
UI_CHECK_RUNTIME=/tmp/codex-ui-check \
UI_CHECK_URL=http://localhost:3000 \
node <skill-directory>/scripts/run-check.mjs /tmp/my-ui-check.mjs
```

The runner also recognizes the previously prepared `/tmp/wardly-tag-ui` runtime.
Neither temporary path is guaranteed to survive between sessions.

## Choose checks that prove the change

- Locate controls by role and accessible name. Desktop and mobile markup can both
  exist in the DOM: scope locators to the visible table/list/dialog.
- Assert the actual outcome: changed tags, selection count, indeterminate state,
  preserved unrelated data, filter resets, or successful retry. Use Playwright
  assertions and explicit response/visibility waits instead of fixed sleeps.
- For responsive work, check a desktop viewport and narrow widths such as 320px
  and 390px. Assert no page-level horizontal overflow and that required controls
  remain visible. Check actual clipping/ellipsis, not only the presence of a class.
- For palette work, read `getComputedStyle` from rendered elements in light and
  dark themes. Check distinct, nontransparent backgrounds and legible foregrounds.
  Also exercise the picker/editor where colors may render through a portal.
- For failure recovery, intercept only the relevant mutation request, abort it,
  assert retained input/selection and useful feedback, then remove interception
  and retry. A response failure after a server commit does not prove rollback.
- Capture screenshots of meaningful states and inspect them with `view_image`.
  Allow overlays/transitions to reach the desired state before capturing.
- Keep reusable product regression tests in the project's test suite when
  warranted. Temporary scenarios and session cookies stay outside tracked files.

Report what passed, the tested widths/themes, and material gaps. Include the
relevant build/type/lint checks separately. Never claim browser validation when
only static checks ran.
