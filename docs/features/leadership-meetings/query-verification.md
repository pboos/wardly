# Leadership meeting query verification

The isolated SQLite regression in
[`query-scaling.test.mjs`](../../../lib/leadership-meetings/query-scaling.test.mjs)
counts Prisma SQL events against the real preparation, loader, and command paths.
Run it through `npm test`. Fixtures apply every versioned migration and assert
visible agenda content, receipt retries, date collisions, selected active/past/held
meetings, coalesced dues, and preservation of existing custom content.

Measurements on 2026-10-18 used the same migrated fixtures before and after the
change, with five repetitions per case. Every repetition returned the same counts.
They measure SQL statements, not page latency. The HTTP check reloaded the same
selected meeting five times before and after, checked all 29 rendered items, and
received HTTP 200 each time. A separate browser check verified bulk addition,
duplicate-click prevention, retry after an injected failure, and automatic modal
closure for both meeting types.

| Case | Before | After |
| --- | ---: | ---: |
| Selected meeting HTTP reload, 29 visible items | 2993 | 31 |
| Prepare and load, 1 recurring topic over 14 meetings | 192 | 30 |
| Prepare and load, 20 recurring topics over 14 meetings | 2054 | 30 |
| Add entire Bishopric agenda, 18 templates and 9 selected items | 16398 | 38 |
| Add entire Council agenda, 14 templates and 7 selected items | 10687 | 38 |

The warm path performs no inserts, updates, or deletes. Its 30 statements comprise
13 preparation statements and 17 loader statements. The regression checks a fixed
40-statement ceiling and equal counts for 1 and 20 topics, with identical visible
results across repeated preparation.

Fresh Add entire agenda uses six insert statements, including its receipt and the
transactional command work. New templates, occurrences, appearances, and links
use bulk inserts with preassigned IDs. Existing custom rows and resolved history
are not rewritten by generation. Final ordering skips unchanged positions.

Reconciliation snapshots are local to one transaction. After its first occurrence
or appearance change, reconciliation reads fresh graphs for subsequent dues.
Repairs, restorations, and complex agenda moves therefore retain sequential reads
and writes. There is no persistent cache, time-based skip, schema change, or
promise of a fixed query count for those mutation paths.
