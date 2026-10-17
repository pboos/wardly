# Agenda instructions and suggested items

Instructions appear beside discussion notes on desktop and above them on mobile.
The Markdown renderer supports headings, lists, emphasis, and safe links, skips
raw HTML, and uses the default URL protection. Instructions are limited to 8,000
characters on the server. Notes remain separate and keep their existing limit.
New appearances and continuations copy instructions. Schedule changes preserve
customized instructions, and incompatible customized discussions remain separate.
Existing templates and historical appearances start with empty instructions after
migration; the catalog does not overwrite local content or backfill history.

The Suggested agenda dialog shows each title above a smaller metadata row with a
fixed-width duration column and schedule label to its right, a help popover, and an
immediate add button. Prayer appears first and last; both buttons independently
add the same repeatable Prayer suggestion. The help and
new templates share the same Markdown instructions, source, and frequency context.
Adding one item keeps the library open. Adding the entire agenda closes it only
after success. While an addition is pending, all add buttons are disabled; bulk
addition shows a spinner. Failed additions stay open for retry with the same UUID. A removed appearance on the selected date restores
with its edits; completed discussions remain history. Scheduled nonrepeatable
suggestions are disabled. Prayer can be added repeatedly, with independent
recurrence and assignment. Its add button restores removed appearances first,
including several removed prayers, before creating another independent template.
Legacy opening and closing keys count as Prayer without changing their content.
The old combined callings and budget keys count only as Callings and Annual budget.

Add entire agenda fills missing topics and restores eligible removed items
on the selected date. It creates enough distinct active recurring Prayer templates
to reach two and preserves any extras. Monthly, quarterly, and annual topics retain
their schedules rather than appearing at every meeting. Quarterly Report starts
in January, April, July, or October. No defaults are inserted automatically.
The row schedule labels omit frequency provenance. Help retains the Handbook
sources and frequency context; local dates and allocations remain editable.
Removing an item for this and future meetings archives its template and preserves
records and discussion history.

Bulk order follows the catalog: Prayer, Spiritual thought, previous assignments,
Upcoming Sundays, children and youth, individuals and families, Callings,
Ordinances, other relevant topics, and final Prayer. Suggested pending rows move
within their occupied slots; custom topics, resolved discussions, and continuations
keep their slots. Matching recurring templates and future planned agendas inherit
the order. Past and other active meetings retain their order. Extra prayers keep
their template order before the final Prayer.

Suggestion commands run in one transaction, including restores and ordering.
Clients retain each command UUID until success. Receipts bind the UUID to its
meeting and operation, so retries do not repeat even a restore-only or no-op
command. Reusing a UUID for a different operation is rejected.


## Implementation and verification

[Catalog defaults](../../../lib/leadership-meetings/suggestions.ts) supply the
order, instructions, relevance, and recurrence. [Suggestion commands](../../../lib/leadership-meetings/suggestion-service.ts)
share [eligibility](../../../lib/leadership-meetings/suggestion-state.ts) with the
loader. [Bulk ordering](../../../lib/leadership-meetings/suggestion-order.ts) keeps
fixed discussion slots. The [Markdown renderer](../../../app/meetings/leadership/markdown-instructions.tsx)
is shared by the help popover and discussion dialog.

`npm test` covers real SQLite command retries, restores, rollback, ward ownership,
instruction snapshots, conflicting customizations, ordering, and Markdown safety.
See [database setup](../../DATABASE.md) for the development reset requirement.
