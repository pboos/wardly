# Feature documentation

Start with a feature's overview, then read only the topic relevant to your task.
These documents describe implemented behavior for people and AI agents; source
links identify where to verify details or make changes.

| Feature | Overview | Read when working on… |
| --- | --- | --- |
| Sunday meetings | [Overview](sunday-meetings/README.md) | [Schedule, dates, assignments](sunday-meetings/schedule.md) · [Agenda, ordering, tasks](sunday-meetings/agenda.md) |
| Hymns and ward language | [Overview](hymns/README.md) | Catalog loading, setup language, refreshing hymns, adding languages |
| Local development | [Overview](local-development/README.md) | Demo database, fictional fixtures, email-free login, reset and automation |

## Structure and maintenance

- Each feature gets `<feature-name>/README.md`: purpose, entry points, shared
  concepts, lifecycle, and links to topic documents.
- Small features need only their overview. Split substantial topics by behavior
  or task, rather than by source file or technical layer.
- Topic files cover scope, behavior/rules, a short implementation map, and
  relevant verification. Aim for 50–100 lines; keep overviews shorter.
- Explain invariants, side effects, and limitations that affect changes. Link
  to key source files instead of inventorying every component.
- Update affected documents in the same change as feature behavior, rules,
  data flow, or implementation entry points. Add new features to this index.
- Describe current behavior. Keep proposals and historical plans in
  [docs/plans](../plans/). If documentation and code disagree, verify the
  implementation and correct the documentation as part of the work.
- Link to [database setup](../DATABASE.md), [schema](../DATABASE_SCHEMA.md),
  and [design guidelines](../DESIGN.md) instead of duplicating their rules.
