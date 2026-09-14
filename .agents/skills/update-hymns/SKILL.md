---
name: update-hymns
description: Refresh Wardly hymn catalogs from the Church's music collections or add a supported hymn language, including catalog verification and setup locale registration.
---

# Update hymn catalogs

Read `docs/features/hymns/README.md` and `lib/hymns/locales.ts` first. Run commands
from the repository root. Catalogs contain numbers and titles, not lyrics.

## Refresh an existing language

Run `node scripts/update-hymns.mjs en` and/or `node scripts/update-hymns.mjs de`.
The importer uses the public data endpoint behind the Church's collection pages,
paginates through the reported total, and writes only after both collections pass
validation. It requires Node with TypeScript stripping (22.18+ or 24+) and curl.
Use the environment's normal network escalation if needed.

Review the JSON diff: additions, title corrections, source counts, and retrieval
date. Keep published numbers and localized titles exactly; never infer missing
translations or renumber songs. Gaps can be legitimate. Identical titles under
different numbers must remain separate entries. A subtitle such as “Women” is
arrangement information, not part of the stored title.

The script refuses missing old entries or overlapping numbers. If it stops,
generate a candidate with `node scripts/update-hymns.mjs en /tmp/wardly-hymn-review`
(substitute the locale), then inspect the source and diff. Do not bypass validation
or replace a catalog with a partial response. If the endpoint changes, inspect
`window.renderData.envData.CDA_LAMBDA_URL` and the collection page's client script;
the current request uses `songsFilteredList` and `bookQueryList: [collection]`.
Stop and report unresolved source failures while preserving the existing catalog.

## Add a language

1. Verify both official collection URLs in the requested language and their
   Church language code (for example `deu` differs from the app's `de`). Do not
   use an English fallback page as evidence of a translated catalog.
2. Add its base BCP 47 language, native display label, and Church code to
   `lib/hymns/locales.ts`. The setup selector and validation share this registry.
3. Run the importer for that locale. Add a literal dynamic JSON import to the
   loader registry in `lib/hymns/index.ts`; TypeScript checks registry coverage.
4. Check representative first/last numbers and Home and Church entries against
   the official source. If numbers collide between collections, resolve lookup
   identity explicitly before enabling the language; never silently overwrite.
5. Add locale and lookup coverage to `lib/hymns/catalog.test.mjs`. Update the
   feature documentation's supported languages and counts.

## Verify and document

Run `npm test`, `bunx tsc --noEmit`, and
`bunx eslint lib/hymns scripts/update-hymns.mjs app/setup`.
Report counts per language/collection and any source limitations. Update affected
feature docs in the same change. Refreshing catalogs needs no database reset or
migration; adding a supported language uses the existing `ward.content_locale`.
