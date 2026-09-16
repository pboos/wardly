# Hymn catalogs and ward language

Bundled number/title catalogs combine the Church's existing hymnbook and
Hymns for Home and Church. English (`en`) and German (`de`) are supported.
These are snapshots; the app does not fetch music data at runtime. Lyrics,
arrangement subtitles, recordings, and sheet music are not included.

| File | Existing hymnbook | Home and Church | Total |
| --- | --- | --- | --- |
| [en.json](../../../lib/hymns/data/en.json) | 341 | 82 | 423 |
| [de.json](../../../lib/hymns/data/de.json) | 210 | 60 | 270 |

Retrieved September 14, 2026. Each file records its source collection URLs,
counts, retrieval timestamp, and hymns sorted numerically. Each hymn has
`number`, `title`, and `collection`. Numbers are unique within a language;
matching titles at different numbers remain separate hymns. Published gaps
are preserved. See the source URLs in each JSON for the official collections.

## Loading

[lib/hymns/index.ts](../../../lib/hymns/index.ts) exposes async functions:

```ts
const catalog = await loadHymnCatalog(ward.content_locale);
const hymn = await findHymn(ward.content_locale, 1);
// catalog?.hymns: readonly array; hymn?.title: localized title
```

Both functions use explicit dynamic imports of local JSON and work without
database or network access. Regional locales such as `de-CH` resolve to `de`.
Unsupported/malformed locales return `undefined`; missing numbers also return
`undefined`. There is no fallback to another language because hymn numbering
differs by language. Treat returned snapshots as read-only.

## Ward setup

[Setup page](../../../app/setup/page.tsx) offers English/Deutsch (English by
default). Its [server action](../../../app/setup/actions.ts) validates against
the shared [language registry](../../../lib/hymns/locales.ts) and saves
`ward.content_locale` in the same transaction as the ward and first user.
Missing or unsupported selections are rejected. The existing field and initial
migration already support this; see the [schema](../../DATABASE_SCHEMA.md).
This selects ward content language, not the app's interface language.
Setup also requires a browser-prefilled ward time zone and sacrament start time
for [Sunday task reminders](../tasks/reminders.md).

The shared [Sunday hymn picker](../../../app/meetings/sunday/sunday-hymn-picker.tsx)
uses the ward catalog for number completion and title display in schedule and details.
[Hymn loading](../../../lib/sunday-meetings/hymn-loader.ts) provides the catalog and
ward-wide last-sung dates strictly before ward-local today. History comes from saved
hymn entries, not attendance/completion tracking. Historical entries do not store
a catalog language; changing ward language reinterprets their numbers. Unknown
numbers (1–9999) remain selectable in hymn-only fields with “title unavailable”;
no language fallback. Where musical numbers are allowed, unmatched input defaults
to a musical number and saves the entered text.

## Maintenance and verification

Use the project [update-hymns skill](../../../.agents/skills/update-hymns/SKILL.md)
to refresh catalogs or add a language. The reusable
[importer](../../../scripts/update-hymns.mjs) runs with
`node scripts/update-hymns.mjs en` (or `de`), requiring Node 22.18+/24+ and curl.
It checks pagination totals, collection identity, valid entries, duplicate
numbers, and removal of existing entries before replacing a file. Unchanged
data leaves the file untouched. Optional second argument selects an output
directory for reviewing a candidate. The endpoint is public but undocumented;
upstream changes may require adapting the importer.

`npm test` covers catalog invariants, localized/regional lookup, and setup
validation/persistence using an isolated database. Also run `bunx tsc --noEmit`
and `bunx eslint lib/hymns scripts/update-hymns.mjs app/setup`.
