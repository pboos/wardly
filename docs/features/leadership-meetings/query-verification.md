# Leadership meeting query verification

The isolated SQLite regressions in
[query scaling](../../../lib/leadership-meetings/query-scaling.test.mjs) and
[discussion notes](../../../lib/leadership-meetings/discussion-notes.test.mjs)
count Prisma SQL events against real preparation, loader, command, and history
paths. Run them through `npm test`. Fixtures apply every versioned migration and
assert visible content, retries, exceptions, preserved custom discussions, stable
topics, and history pagination. Counts measure SQL statements, not page latency.

## Current counts

Measurements on 2026-10-18 include the stable topic and shared notes work.
The warm fixture repeats each topic count three times with identical returned
content and no writes. Bulk additions and history pages use fresh migrated
fixtures and verify their results. These counts do not measure browser latency
or concurrent traffic.

| Case | SQL statements |
| --- | ---: |
| Prepare and load, 1 recurring topic | 31 |
| Prepare and load, 20 recurring topics | 31 |
| Add entire Bishopric agenda | 39 |
| Add entire Council agenda | 39 |
| Previous meeting notes, first page with 25 qualifying discussions | 8 |

The warm path previously used 30 statements. One batched topic SELECT adds the
current shared text for all visible agenda rows, independent of topic count.
The regression checks a 40-statement ceiling, equal counts for 1 and 20 topics,
and zero inserts, updates, or deletes. Initial loading sends no history payload.
The history read performs bounded authorization and occurrence graph reads plus
one 21-row item query. A date/ID cursor returns 20 results and a next cursor.
Multiple occurrence links do not duplicate discussions.

Fresh Add entire agenda previously used 38 statements and six INSERT statements.
It now uses seven INSERT statements, including one topic batch and one template
batch, plus the existing receipt, occurrences, appearances, and links. IDs are
assigned before insertion. Existing custom rows and resolved history are not
rewritten. Final ordering skips unchanged positions. The test checks a
60-statement ceiling and at most eight INSERT statements for both meeting kinds.

## Mutation limits

Reconciliation snapshots last for one transaction. After the first occurrence or
appearance change, reconciliation reads fresh graphs for subsequent dues.
Repairs, restorations, and complex moves retain sequential reads and writes.
Shared note saves and outcomes remain transactional. Query bounds here apply to
the named fixtures; they are not a fixed count for every mutation path. There is
no persistent cache or time-based preparation skip.
