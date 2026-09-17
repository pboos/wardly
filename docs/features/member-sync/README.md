# Member sync

Wardly imports a JSON member list copied from an authorized, signed-in LCR
browser tab. The sync page previews additions, moved members, and changes before
applying the chosen plan. Database rules remain in [database documentation](../../DATABASE.md).

## Exporting the loaded member list

1. Open the English LCR member list, clear search/filters, and wait for it to load.
2. Copy the script from `/admin/sync` and paste it into the LCR console once.
3. Check the exported count against the full directory count. The script uses
   Chrome's console `copy()` helper to copy JSON automatically; if unavailable,
   run `copy(wardlyLcr.json)` as directed in the console.
4. Paste into Wardly, inspect the preview, and confirm the changes.

The script reads React's committed component tree and its stored props/state.
It makes no requests, installs no listener, and does not navigate or read cookies.
Discovery avoids old alternate trees, DOM nodes, getters, and traversing
individual member records. Export then snapshots each selected member’s JSON data. A bounded scan must finish before any export is produced.
Re-pasting clears the previous result; errors leave `wardlyLcr.json` null.

Repeated identical lists and matching subsets are allowed. The largest list must
contain every other candidate with identical exported values for shared member
IDs. Conflicting/disjoint lists and duplicate IDs stop the export; lists are never
combined. No member is silently dropped when validation fails.

## Export format

Each item includes Wardly's existing top-level fields (`firstName`, `lastName`,
`gender`, `birthDate`, optional `email` and `isBaptized`) and external UUID/household
aliases. A nested `lcr` object contains all available enumerable JSON source data
with original names and nesting, including future fields without an allowlist.
Observed source fields include phone, address, age, organization UUIDs, birth date
formats, unit name, household role/UUID, every name format, priesthood office,
sex, status flags, and member UUID. Missing fields are not invented.

Snapshots skip getters, functions, symbols, and undefined object properties;
undefined/empty array slots become null. Unsupported objects/nonfinite numbers,
cycles, and excessive nesting fail rather than silently losing data. Object keys
are sorted so source property order does not cause false list conflicts.

The importer explicitly reads only supported top-level fields. It ignores `lcr`,
external identifiers, and other extra fields; it never writes arbitrary keys or
uses source values to override normalized fields. These extra fields survive in
the copied JSON only, not in the database or sync preview. Keep the export if it
will be needed later, or re-export once database support is added.

## Data and sync rules

Every exported member must provide a nonempty UUID and preferred name,
MALE/FEMALE sex, and birth date (YYYY-MM-DD or null).
Email may be omitted, null, or a string. Optional household identifiers are
retained in JSON. Empty lists, more than 2000 rows, and exports over 5 MB fail (the export and importer share the same limits).

Missing email means unknown: preview ignores email changes and commits preserve
existing emails for updates, reactivations, ambiguity resolutions, and name-change
merges. New members without an email are inserted with null. Explicit null or an
empty email string still clears a saved email; a provided string updates it.
Malformed email values are rejected by the import action.

A missing or null LCR baptism flag exports without `isBaptized`. The importer
also accepts null as unknown. Preview ignores unknown baptism values and commits
preserve saved values for updates, reactivations, ambiguity resolutions, and
merges. Explicit true/false updates the value; other types are rejected. New
members with unknown baptism status retain the importer's false default because
the database requires a boolean. The console reports how many members lack the
flag and asks for review of new members; unknown is not evidence of no baptism.

The current sync action matches normalized first/last names, using birth date to
resolve duplicate names. It uses birth date and gender to suggest name changes.
Exported external IDs are not persisted or used for matching.

## Limitations and troubleshooting

React internals are unsupported and may change. If no list is found or a scan
limit/conflict occurs, reload the full directory, wait for it to load, and retry.
Persistent failures require investigating LCR's changed page structure.
The exporter cannot prove completeness or detect every server-side filter or
pagination scheme. Always compare counts before reviewing moved-member changes.
Missing email addresses cannot be recovered from this payload.

## Implementation and verification

- [Console script](../../../app/admin/sync/lcr-script.ts)
- [Instructions](../../../app/admin/sync/page.tsx)
- [Preview and resolution UI](../../../app/admin/sync/sync-form.tsx)
- [Parsing, matching, and applying](../../../app/admin/sync/actions.ts)
- [Synthetic browser tests](../../../app/admin/sync/lcr-script.test.mjs)
- [Sync email persistence tests](../../../app/admin/sync/actions.test.mjs)

Run `npm test`. Synthetic browser tests verify extraction and failure cases;
live LCR still requires verification in the signed-in browser.
