# Database Schema

SQLite database schema for Wardly.

- Primary keys are UUIDs stored as `TEXT`.
- Timestamps use `CURRENT_TIMESTAMP` and map to Prisma `DateTime` values.
- Table names are singular and lowercase.
- Foreign keys are ward-scoped wherever a record belongs to a ward.

---

## 1. `ward`

The ward owns its members, users, task configuration, and Sunday-meeting schedule.

```sql
CREATE TABLE ward (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'ward',
  content_locale  TEXT NOT NULL DEFAULT 'en',
  time_zone       TEXT NOT NULL DEFAULT 'UTC',
  sacrament_start_time TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `content_locale` is the ward-language BCP 47 locale used for hymn catalogs and leading text.
  Setup currently accepts `en` or `de`; see [catalog loading and language maintenance](features/hymns/README.md).
- `time_zone` is the IANA zone used to determine the current local date and Sunday.
- `sacrament_start_time` is ward-local `HH:mm`, required in setup. Null means
  no configured reminder schedule (for wards created outside setup).

### Sunday task email delivery

`task_digest_delivery` tracks one email per `(ward_id, user_id, sunday_date)`.
Fields: UUID `id`; cascading `ward_id`/`user_id` foreign keys; calendar
`sunday_date`; `status` (`pending`, `sending`, `sent`); nullable `claim_token`,
`lease_expires_at`, `next_attempt_at`, `sent_at`, `last_error`; integer
`attempts` default 0; `created_at`/`updated_at` timestamps. The natural key has
a unique index. Claims use atomic conditional updates; only the claim owner
may finalize a delivery. `sent_at` records SMTP acceptance, not inbox delivery.
See [task reminders](features/tasks/reminders.md) for retry and crash semantics.

---

## 2. `user`

```sql
CREATE TABLE user (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_user_email ON user (email);
CREATE INDEX idx_user_ward_id ON user (ward_id);
```

---

## 3. `login`

Magic-link and verification-code login state. Rows expire five minutes after
`created_at` and are deleted once used or exhausted.

```sql
CREATE TABLE login (
  user_id       TEXT PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  redirect_path TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_login_token_hash ON login (token_hash);
CREATE INDEX idx_login_created_at ON login (created_at);
```

---

## 4. `member`

Members are retained for assignment history even after moving away. External UUIDs
are unique within a ward and are the sole sync identity; internal IDs retain
assignment references. Nullable external IDs support local members, which
sync leaves untouched. Household UUID and source role are stored on each member;
there is no household entity. Omitted household fields preserve saved values;
explicit null or blank values clear them. Gender is stored only as `m` or `f`,
enforced by a database CHECK constraint.

```sql
CREATE TABLE member (
  id           TEXT PRIMARY KEY,
  ward_id      TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  external_uuid TEXT,
  external_household_uuid TEXT,
  external_household_role TEXT,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  gender       TEXT NOT NULL CHECK (gender IN ('m', 'f')),
  birth_date   TEXT,
  email        TEXT,
  is_baptized  BOOLEAN NOT NULL,
  is_moved_out BOOLEAN NOT NULL DEFAULT false,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_member_ward_external_uuid ON member (ward_id, external_uuid);
CREATE INDEX idx_member_ward_id ON member (ward_id);
CREATE INDEX idx_member_ward_moved_out ON member (ward_id, is_moved_out);
```

---

## 5. `sunday_meeting`

One lazily created schedule record for a ward's local Sunday. The `date` is a
local `YYYY-MM-DD` calendar date, not a UTC timestamp.

```sql
CREATE TABLE sunday_meeting (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL,
  information TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sunday_meeting_ward_date
  ON sunday_meeting (ward_id, date);
CREATE INDEX idx_sunday_meeting_ward_type_date
  ON sunday_meeting (ward_id, type, date);
```

`type` is one of:

```text
sacrament
fast_testimony
ward_conference
childrens_sacrament_presentation
stake_conference
general_conference
```

Stake and General Conference records are date/type-only and have no local
agenda items.

Creating a meeting does NOT create any item rows. The expected items are
derived from the meeting `type` in code and persisted lazily, only when real
data (a person, `content`, or `metadata`) is entered — see
[`sunday_meeting_item`](#6-sunday_meeting_item).

---

## 6. `sunday_meeting_item`

The persisted sacrament-meeting agenda. People live directly on each item.
Local meetings are created with stable standard slots, including empty hymn,
prayer, and sacrament assignments. Clearing a standard slot preserves its ID
and position. Extra empty items may be deleted automatically.

Each section has explicit integer positions. Reordering renumbers the affected
sections in a transaction. New extra items append to their section. Standard
slot identity is independent of order and unique within a meeting.
Each non-null `task_id` is unique across all Sundays. Selecting an already scheduled
task moves its existing item to the chosen meeting; unselected candidates have no row.

```sql
CREATE TABLE sunday_meeting_item (
  id                TEXT PRIMARY KEY,
  sunday_meeting_id TEXT NOT NULL REFERENCES sunday_meeting (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  section           TEXT NOT NULL,
  order_index       INTEGER NOT NULL,
  slot              TEXT,
  content           TEXT,
  metadata          TEXT,
  person_member_id  TEXT REFERENCES member (id) ON DELETE RESTRICT,
  person_name       TEXT,
  task_id           TEXT REFERENCES task (id) ON DELETE RESTRICT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (person_member_id IS NOT NULL AND person_name IS NOT NULL))
);

CREATE UNIQUE INDEX sunday_meeting_item_sunday_meeting_id_slot_key
  ON sunday_meeting_item (sunday_meeting_id, slot);

CREATE INDEX idx_sunday_meeting_item_meeting ON sunday_meeting_item (sunday_meeting_id);
CREATE INDEX idx_sunday_meeting_item_member  ON sunday_meeting_item (person_member_id);
CREATE UNIQUE INDEX sunday_meeting_item_task_id_key ON sunday_meeting_item (task_id);

-- At most one conducting leader and one presiding item per meeting
-- (declared in the initial SQL migration; Prisma cannot express unique
-- partial indexes).
CREATE UNIQUE INDEX idx_sunday_meeting_item_one_leader
  ON sunday_meeting_item (sunday_meeting_id) WHERE type = 'leader';
CREATE UNIQUE INDEX idx_sunday_meeting_item_one_presiding
  ON sunday_meeting_item (sunday_meeting_id) WHERE type = 'presiding';
```

| Column | Meaning |
| --- | --- |
| `type` | Item classification; includes the person/context types listed below. |
| `section` | `participants`, `opening`, `business`, `sacrament`, `program`, or `closing`. |
| `order_index` | Explicit integer position within the section. |
| `slot` | Stable standard slot key, or NULL for extra items. Clearing a standard slot retains its position. |
| `content` | Free text: talk topic, visitor role text, announcement text, … |
| `metadata` | JSON object. First key: `hymnNumber` (number, > 0). |
| `person_member_id` | Ward member reference. At most one person per row. |
| `person_name` | Free-text person (visitor, missionary, …). Never both person columns. |
| `task_id` | Optional task link for calling/release/priesthood items. A task can later leave its suggested state without removing the agenda item. |

One item row holds at most one person. Groups with several people (multiple
sacrament passers, organists, visitors) are simply several item rows of the
same type; new items append to their section.

Supported item types:

```text
leader
organist
music_conductor
visitor
presiding
hymn
prayer
talk
sacrament_blessing
sacrament_passing
musical_number
primary_presentation
calling_sustain
calling_release
priesthood_aaronic_inform
child_naming_blessing
member_welcome
convert_confirmation
announcement
ward_business
custom_program
transition
conductor_text
```

Person/context types (new; they hold the people that were previously
meeting-level assignments, all in section `participants`):

| Type | Person | `content` |
| --- | --- | --- |
| `leader` | Who conducts the meeting | — |
| `organist` | Organist (one row each) | — |
| `music_conductor` | Music conductor (one row each) | — |
| `visitor` | Visitor | Visitor role text, e.g. "Stake President" |
| `presiding` | Who presides | Optional role text |

Person-carrying program/business types keep their people on the row and use
`content` for auxiliary text (roles are manual text now):

| Type | Person on the row | `content` example |
| --- | --- | --- |
| `prayer` | Person praying | — |
| `talk` | Speaker | Topic |
| `sacrament_blessing` | One blesser (one row each) | — |
| `sacrament_passing` | One passer (one row each) | — |
| `child_naming_blessing` | The child | "Blessed by John Doe" |
| `member_welcome` | The new member | Introduction text |
| `convert_confirmation` | The convert | — |
| `calling_sustain` / `calling_release` / `priesthood_aaronic_inform` | The member concerned | Calling text (kept via the `task_id` link when added from a task) |

`hymn` uses `metadata.hymnNumber`. `musical_number` may use the person columns
for a main performer and `content` for a description. `announcement`,
`ward_business`, `custom_program`, `transition`, `conductor_text`, and
`primary_presentation` are unchanged in spirit. Stake and General Conference
meetings still have no local items.

---

## 7. `task`

```sql
CREATE TABLE task (
  id                TEXT PRIMARY KEY,
  ward_id           TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'todo',
  title             TEXT,
  description       TEXT,
  assigned_user_id  TEXT REFERENCES user (id) ON DELETE SET NULL,
  owner_user_id     TEXT REFERENCES user (id) ON DELETE SET NULL,
  member_id         TEXT REFERENCES member (id) ON DELETE SET NULL,
  due_date          TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal',
  duration_minutes  INTEGER,
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_ward_id ON task (ward_id);
CREATE INDEX idx_task_ward_type_state ON task (ward_id, type, state);
CREATE INDEX idx_task_assigned_user_id ON task (assigned_user_id);
CREATE INDEX idx_task_owner_user_id ON task (owner_user_id);
CREATE INDEX idx_task_member_id ON task (member_id);
CREATE INDEX idx_task_due_date ON task (due_date);
CREATE INDEX idx_task_completed_at ON task (completed_at);
CREATE INDEX idx_task_ward_completed ON task (ward_id, completed_at);
```

---

Ownership is independent of the current workflow assignee. New tasks copy their
initial assignee into `owner_user_id`; later assignment and state changes preserve
ownership. Either reference can be null, and deleting its user clears that
reference. The additive `20261031120000_task_owner` migration backfills existing
owners from their current assignees without changing task IDs or links.

## 8. `task_type`

Optional ward overrides and custom task types. The composite key is
`(ward_id, type)`.

```sql
CREATE TABLE task_type (
  ward_id       TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  name          TEXT NOT NULL,
  name_short    TEXT NOT NULL DEFAULT 'T',
  color         TEXT NOT NULL DEFAULT '#71717a',
  configuration TEXT NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ward_id, type)
);
```

---

## 9. `task_type_state`

Ward-scoped lifecycle states for task types.

```sql
CREATE TABLE task_type_state (
  id                        TEXT PRIMARY KEY,
  ward_id                   TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type                 TEXT NOT NULL,
  state                     TEXT NOT NULL,
  label                     TEXT NOT NULL,
  color                     TEXT NOT NULL DEFAULT '#3b82f6',
  order_index               INTEGER NOT NULL DEFAULT 0,
  state_group               TEXT NOT NULL DEFAULT 'active',
  sunday_meeting_item_type  TEXT,
  created_at                TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_type_state_type ON task_type_state (task_type);
CREATE INDEX idx_task_type_state_ward_id ON task_type_state (ward_id);
CREATE UNIQUE INDEX idx_task_type_state_ward_type_state
  ON task_type_state (ward_id, task_type, state);
```

`sunday_meeting_item_type` is nullable. When set, it must be one of
`calling_sustain`, `calling_release`, or `priesthood_aaronic_inform`, and
causes tasks currently in that state to be listed as Sunday-meeting candidates.

---

## 10. `task_type_state_assignment`

Optional user-assignment overlay for each resolved task lifecycle state.

```sql
CREATE TABLE task_type_state_assignment (
  ward_id             TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type           TEXT NOT NULL,
  state               TEXT NOT NULL,
  assign_to_user_id   TEXT REFERENCES user (id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ward_id, task_type, state)
);

CREATE INDEX idx_task_type_state_assignment_user_id
  ON task_type_state_assignment (assign_to_user_id);
```

## Member tags

Tags are ward-owned labels without behavioral semantics. Names are trimmed,
whitespace-collapsed and case-insensitively unique per ward via normalized_name.
Color is a validated palette key. `is_default_excluded` defaults to false and
controls initial directory exclusion and member-selector ordering (see [members](features/members/README.md)).
Assignment actions enforce same-ward ownership.
Sync preserves assignments except when a moved-out member returns: that transition
clears all assignments in the same transaction. Deleting a tag cascades assignments.

```sql
CREATE TABLE member_tag (
  id TEXT NOT NULL PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES ward(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX member_tag_ward_id_normalized_name_key ON member_tag(ward_id, normalized_name);
CREATE TABLE member_tag_assignment (
  id TEXT NOT NULL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_id TEXT NOT NULL REFERENCES member_tag(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX member_tag_assignment_member_id_tag_id_key ON member_tag_assignment(member_id, tag_id);
CREATE INDEX member_tag_assignment_tag_id_idx ON member_tag_assignment(tag_id);
```

## Leadership meetings

Dedicated ward-scoped series serve bishopric/branch presidency and council meetings.
All ward users have access. Timers are browser component state and never stored.
The additive migration preserves Sunday meetings and existing tasks.

Dates are local YYYY-MM-DD values. JSON schedule/recurrence fields are validated
version-1 discriminated rules. Meeting scheduled_date is the immutable generation
key; date can be rescheduled. Resolved outcomes and dates stay fixed; historical
notes and task links remain editable. Every item, including
one-time items, has a template and occurrence. Multiple obligations may share one
discussion through meeting_agenda_item_occurrence without losing their due dates.
Removed appearances retain their item/occurrence links with a removed outcome,
allowing explicit restoration without adding another recurring template.
Unique predecessor_id makes carry-forward idempotent. Task links do not change task
lifecycle. All foreign keys cascade except predecessor deletion, which sets null.

Template after_date excludes obligations already covered by a previous template;
after_meeting_date prevents future edits appearing again in their source meeting.
The recurrence anchor remains unchanged when replacing a template.
Every template has a required, indexed topic parent. Future template replacements
copy the topic ID; appearance links derive one identity without duplicating it on
items. The topic stores current shared notes, bounded to 4000 characters by command
validation. Meeting-specific notes remain in item.decision. Both save atomically
using expected text for conflict detection. Backfill groups connected templates
through shared appearances within a series, never titles or suggestion keys.

Canonical SQL for these tables and indexes:

```sql
-- CreateTable
CREATE TABLE "leadership_meeting_series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '09:00',
    "time_zone" TEXT NOT NULL,
    "target_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leadership_meeting_series_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leadership_meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "scheduled_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leadership_meeting_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "leadership_meeting_series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Stable discussion identity survives recurring template replacement.
CREATE TABLE "meeting_agenda_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series_id" TEXT NOT NULL REFERENCES "leadership_meeting_series"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "meeting_agenda_topic_series_id_idx" ON "meeting_agenda_topic"("series_id");

-- CreateTable
CREATE TABLE "meeting_agenda_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic_id" TEXT NOT NULL REFERENCES "meeting_agenda_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "series_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "duration_minutes" INTEGER NOT NULL,
    "recurrence" TEXT NOT NULL,
    "anchor_date" TEXT NOT NULL,
    "after_date" TEXT,
    "after_meeting_date" TEXT,
    "suggestion_key" TEXT,
    "default_assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_template_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "leadership_meeting_series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "template_id" TEXT NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_occurrence_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "meeting_agenda_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "duration_minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "decision" TEXT NOT NULL DEFAULT '',
    "predecessor_id" TEXT,
    "assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "assignment_overridden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "leadership_meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item_occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "occurrence_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_occurrence_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_occurrence_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "meeting_agenda_occurrence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_task_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_task_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "leadership_meeting_series_ward_id_kind_key" ON "leadership_meeting_series"("ward_id", "kind");

-- CreateIndex
CREATE INDEX "leadership_meeting_series_id_date_idx" ON "leadership_meeting"("series_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_meeting_series_id_scheduled_date_key" ON "leadership_meeting"("series_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "meeting_agenda_template_topic_id_idx" ON "meeting_agenda_template"("topic_id");
CREATE INDEX "meeting_agenda_template_series_id_archived_idx" ON "meeting_agenda_template"("series_id", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_occurrence_template_id_occurrence_key_key" ON "meeting_agenda_occurrence"("template_id", "occurrence_key");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_predecessor_id_key" ON "meeting_agenda_item"("predecessor_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_meeting_id_position_idx" ON "meeting_agenda_item"("meeting_id", "position");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_occurrence_occurrence_id_idx" ON "meeting_agenda_item_occurrence"("occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_occurrence_item_id_occurrence_id_key" ON "meeting_agenda_item_occurrence"("item_id", "occurrence_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_task_task_id_idx" ON "meeting_agenda_item_task"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_task_item_id_task_id_key" ON "meeting_agenda_item_task"("item_id", "task_id");

```

Recurring template positions define series defaults; item positions remain meeting snapshots.
The additive ordering migration backfills templates per series by creation time and ID.

Agenda templates optionally name a ward user as their default assignee. Each appearance
snapshots its effective assignee; `assignment_overridden` distinguishes a meeting-specific
choice (including an explicit unassigned choice) from the recurring default. Default
changes affect pending future planned appearances only. User deletion clears foreign
keys while retaining explicit override provenance.

Agenda instructions are Markdown snapshots separate from discussion notes.
Templates supply defaults; appearance edits preserve historical snapshots.
The existing `20261017120000_agenda_assignees` development migration also adds
these fields and command receipts. Explicitly recreate development/demo databases
that already applied that migration before using this revision.

```sql
CREATE TABLE "meeting_suggestion_receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL REFERENCES "leadership_meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "fingerprint" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
