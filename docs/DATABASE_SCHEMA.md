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
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `content_locale` is the ward-language BCP 47 locale used for hymn catalogs and leading text.
- `time_zone` is the IANA zone used to determine the current local date and Sunday.

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

Members are retained for assignment history even after moving away.

```sql
CREATE TABLE member (
  id           TEXT PRIMARY KEY,
  ward_id      TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  gender       TEXT NOT NULL,
  birth_date   TEXT,
  email        TEXT,
  is_baptized  BOOLEAN NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_member_ward_id ON member (ward_id);
CREATE INDEX idx_member_ward_status ON member (ward_id, status);
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

The persisted sacrament-meeting agenda. People live directly on the item
(`person_member_id` or `person_name`), at most one person per row. Meetings are
created without items; expected items are derived from the meeting `type` in
code and persisted lazily only when data is entered. A row is deleted again
once it has no person, no non-empty `content`, and no non-empty `metadata`
(explicit exceptions such as `transition` aside).

```sql
CREATE TABLE sunday_meeting_item (
  id                TEXT PRIMARY KEY,
  sunday_meeting_id TEXT NOT NULL REFERENCES sunday_meeting (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  section           TEXT NOT NULL,
  order_index       REAL,
  content           TEXT,
  metadata          TEXT,
  person_member_id  TEXT REFERENCES member (id) ON DELETE RESTRICT,
  person_name       TEXT,
  task_id           TEXT REFERENCES task (id) ON DELETE RESTRICT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (person_member_id IS NOT NULL AND person_name IS NOT NULL))
);

CREATE INDEX idx_sunday_meeting_item_meeting ON sunday_meeting_item (sunday_meeting_id);
CREATE INDEX idx_sunday_meeting_item_member  ON sunday_meeting_item (person_member_id);
CREATE INDEX idx_sunday_meeting_item_task    ON sunday_meeting_item (task_id);

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
| `order_index` | Nullable manual override of the default order; `NULL` = default order (defined per section/item type in code). |
| `content` | Free text: talk topic, visitor role text, announcement text, … |
| `metadata` | JSON object. First key: `hymnNumber` (number, > 0). |
| `person_member_id` | Ward member reference. At most one person per row. |
| `person_name` | Free-text person (visitor, missionary, …). Never both person columns. |
| `task_id` | Optional task link for calling/release/priesthood items. A task can later leave its suggested state without removing the agenda item. |

One item row holds at most one person. Groups with several people (multiple
sacrament passers, organists, visitors) are simply several item rows of the
same type; they sort together by default.

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
CREATE INDEX idx_task_member_id ON task (member_id);
CREATE INDEX idx_task_due_date ON task (due_date);
CREATE INDEX idx_task_completed_at ON task (completed_at);
CREATE INDEX idx_task_ward_completed ON task (ward_id, completed_at);
```

---

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
