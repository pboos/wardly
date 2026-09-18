# Temporary Playwright runtime and troubleshooting

Run shell examples through the available command tool. Use its escalation
parameters for restricted network/browser/server operations; this document does
not confer extra permissions.

## Install once, reuse when present

Use a task-specific directory such as `/tmp/codex-ui-check`. In the Wardly session
that motivated this skill, `/tmp/wardly-tag-ui` already contained Playwright,
Chromium, and unpacked libraries. Check before downloading anything.

```bash
npm install --prefix /tmp/codex-ui-check --no-save --no-package-lock @playwright/test
PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-ui-check/browsers \
  node /tmp/codex-ui-check/node_modules/playwright/cli.js install chromium
```

The runner sets the browser cache path before loading Playwright. It relies on
Playwright's executable discovery rather than hardcoding a versioned Chromium
directory. Optional `UI_CHECK_EXECUTABLE` overrides it for a known local browser.

## Missing Linux/WSL libraries

A browser can download successfully and still fail at launch. Inspect the
executable reported in the error:

```bash
ldd /path/from/browser-launch-error | rg 'not found'
```

The observed Ubuntu/WSL environment lacked `libnspr4.so`, `libnss3.so`,
`libnssutil3.so`, and `libasound.so.2`. Its packages were `libnspr4`, `libnss3`,
and `libasound2t64`. These names depend on the distribution; inspect
`/etc/os-release` and the actual missing libraries instead of assuming them.

To avoid changing system packages, download and unpack the needed packages
under the temporary runtime. Run the download with that directory as cwd:

```bash
apt download libnspr4 libnss3 libasound2t64
for package in /tmp/codex-ui-check/*.deb; do
  dpkg-deb -x "$package" /tmp/codex-ui-check/libs
done
```

The runner discovers unpacked directories under `libs/usr/lib` and adds them
to the browser child's library path. Alternatively supply
`UI_CHECK_LIBRARY_PATH`. Do not overwrite an unrelated existing library path.
After one targeted repair, inspect the next error before trying another install.

## Authentication and cleanup

Read Wardly's current local-development docs for accounts and code. The supplied
scenario checks for the email-free login notice before submitting anything, so
it cannot silently send an email through the normal login form. Use the
documented demo identity; do not inspect or print signing secrets.

Optional saved Playwright storage state contains credentials. Keep it temporary,
do not commit or print it, and reauthenticate if expired. Session reuse is an
optimization, not necessary for the supplied runner.

Remove temporary test records in `finally`, using exact IDs or unique names.
If cleanup fails, report the leftover artifact explicitly; do not delete broad
sets of records to compensate. Close the browser even when an assertion fails.

## Stale development CSS

A real failure observed here: the served Next dev CSS lacked tag palette rules
even though the source and production CSS contained them.

1. Inspect the DOM classes/attributes and computed styles in Chromium.
2. Inspect CSS actually loaded by that page, using its stylesheet URLs. The
   existence of a correct file somewhere under `.next` is not sufficient:
   bundled and single-module development assets can disagree.
3. Compare with current source and a fresh build. Distinguish stale compilation
   from missing utilities, invalid tokens, selector mismatches, or cascade issues.
4. If stale, prefer a controlled dev-server restart when you own that process.
   For a shared server, explain the finding and arrange a reload without killing
   an unknown process. In this session, touching files was insufficient; a
   temporary comment in `next.config.ts` triggered a configuration reload.
   Remove such a temporary change afterward and verify computed styles again.
   Treat this as an evidence-based fallback, not a routine source edit.

Do not repeatedly redesign working color code to compensate for a stale bundle.

## Generated Next types and builds

A malformed `.next/dev/types/validator.ts` was also observed, with trailing
fragments from older routes. If TypeScript fails there, inspect the generated
file. When corruption is confirmed, move that generated file to a temporary
backup, run `npx next typegen`, then rerun TypeScript. Do not change app types or
tsconfig exclusions to suppress the error. If regeneration repeats the corruption,
resolve the competing/stale dev process rather than looping.

Google font downloads may require network access for `npm run build`.
Keep the browser scenario and build sequential to avoid generating artifacts
while a browser is exercising the dev server.
