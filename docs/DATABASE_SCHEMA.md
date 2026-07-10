# Database Schema

SQLite database schema for the Wardly application.

- All timestamps are stored as `TEXT` using `CURRENT_TIMESTAMP` (UTC, ISO‑8601).
- All primary keys are UUIDs stored as `TEXT`.
- Table names are **singular** (e.g. `ward`, `user`, `member`).
- Every table has `created_at` and `updated_at` columns.

---

## 1. `ward`

A ward (local congregation) that a bishop sets up.

```sql
CREATE TABLE ward (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'ward',  -- 'ward' | 'branch'
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. `user`

A person who can log in. Belongs to a ward. Has an email and a display name.
The JWT issued at login contains `id`, `email`, and `name`.

```sql
CREATE TABLE user (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE UNIQUE INDEX idx_user_email ON user (email);
CREATE INDEX idx_user_ward_id ON user (ward_id);
```

---

## 3. `login`

Magic‑link / code login session. Created when a user requests a login.

- `token_hash` — SHA‑256 hash of the random token sent as a link in the email (immediate login). Only the hash is stored; the plaintext token lives only in the email link.
- `code_hash` — SHA‑256 hash of the 6‑character human‑readable code (uppercase, no ambiguous chars like `0`, `O`, `1`, `I`) that can be entered on the login page. Only the hash is stored; the plaintext code lives only in the email.
- `attempts` — counter for failed code attempts; after 3 the entry is invalidated.
- redirect_path TEXT — the sanitized original path to return to after login; null = fall back to /.
- Both token and code expire 5 minutes after `created_at`. A cleanup job deletes rows older than 5 minutes.
- Once used successfully (or failed, or expired) the row should be deleted.

```sql
CREATE TABLE login (
  user_id       TEXT PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  redirect_path TEXT,  -- sanitized original path; null = fall back to /
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE UNIQUE INDEX idx_login_token_hash ON login (token_hash);
CREATE INDEX idx_login_created_at ON login (created_at);
```

---

## 4. `member`

A member of the ward. Imported via sync or CSV. The `id` never changes so that history (talks, prayers, interviews) stays linked to the right person.

Status
- `active` — member is part of the ward and should be shown in lists.
- `moved` — member has moved out. Kept for history but hidden from default lists.
- `unknown` — member is not known in the ward. Might have also moved.
- `unknown_address` — the address the member lives at is not correct anymore.
- `no_contact` — member requested to not get contacted by the church.
- `hidden` — member is hidden for other reasons.

```sql
CREATE TABLE member (
  id           TEXT PRIMARY KEY,
  ward_id      TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  gender       TEXT NOT NULL,
  birth_date   TEXT,
  email        TEXT,
  is_baptized  BOOLEAN NOT NULL CHECK (is_baptized IN (0, 1)),
  status       TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'moved' | 'unknown' | 'unknown_address' | 'no_contact'
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
 
```sql
CREATE INDEX idx_member_ward_id ON member (ward_id);
CREATE INDEX idx_member_ward_status ON member (ward_id, status);
```

---

## 5. `meeting`

A scheduled meeting of a given type (bishopric meeting, ward council meeting, etc.).
Has a date and a type. Agenda items reference one or more meetings.

```sql
CREATE TABLE meeting (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- 'bishopric' | 'ward_council' | 'youth_council' | ...
  date        TEXT NOT NULL,  -- ISO date of the meeting
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_meeting_ward_id ON meeting (ward_id);
CREATE INDEX idx_meeting_ward_type_date ON meeting (ward_id, type, date);
```

---

## 6. `agenda_item`

An item discussed in one or more meetings. An item can reference multiple meetings so that a recurring topic keeps its history.

- `duration` — planned duration in minutes (for the timer / alarm).
- `status` — lifecycle of the item: `open`, `done`, `carry_over`.
- `carry_after` — if `carry_over`, the number of meetings to defer before it appears again.

```sql
CREATE TABLE agenda_item (
  id            TEXT PRIMARY KEY,
  ward_id       TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  duration      INTEGER NOT NULL DEFAULT 5,  -- minutes
  status        TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'done' | 'carry_over'
  carry_after   INTEGER,  -- number of meetings to defer
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_agenda_item_ward_id ON agenda_item (ward_id);
CREATE INDEX idx_agenda_item_status ON agenda_item (status);
```

---

## 7. `meeting_agenda_item` (junction)

Links an agenda item to the meetings where it was/is discussed.
Also stores per‑meeting notes and the decision taken in that meeting.

```sql
CREATE TABLE meeting_agenda_item (
  id              TEXT PRIMARY KEY,
  meeting_id      TEXT NOT NULL REFERENCES meeting (id) ON DELETE CASCADE,
  agenda_item_id  TEXT NOT NULL REFERENCES agenda_item (id) ON DELETE CASCADE,
  order_index     INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  decision        TEXT,  -- 'done' | 'carry_over_next' | 'carry_over_two'
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_meeting_agenda_item_meeting_id ON meeting_agenda_item (meeting_id);
CREATE INDEX idx_meeting_agenda_item_agenda_item_id ON meeting_agenda_item (agenda_item_id);
CREATE UNIQUE INDEX idx_meeting_agenda_item_unique ON meeting_agenda_item (meeting_id, agenda_item_id);
```

---

## 8. `task`

A generic task. Covers interviews (temple, youth, calling, check‑in) and action items.
The `type` field distinguishes the kind of task; the `state` field tracks its progress.

- `type` — `temple_recommend`, `temple_recommend_limited`, `youth_interview`, `calling`, `check_in`, `todo`.
- `state` — current state in the task's lifecycle (e.g. for temple recommend: `todo` → `organize_stake` → `stake_interview` → `print_handout` → `done`).
- `assigned_user_id` — the bishopric member currently responsible. When the state changes this can be reassigned (e.g. temple recommend done → secretary for stake organization).
- `member_id` — the ward member the task is about (optional; avoids duplicating names).
- `deadline` — optional due date.
- `priority` — `urgent` | `normal` | `whenever`.
- `duration_minutes` — expected length (defaults per type, e.g. temple = 30, calling = 10, check-in = 15). Copied onto the task at creation from the matching `task_type` default; `todo` has no default (left null).
- `completed_at` — ISO‑8601 timestamp set when the task enters a final state; cleared if the task is reopened. Needed for the "past tasks" view ordered by completion date.
- Final states are defined per type in `task_type_state` (e.g. `done`).

> **Deviation from earlier schema doc:**
> - `agenda_item_id` (and its index `idx_task_agenda_item_id`) have been **removed** for now. They will be re-added in a later migration when agenda linking lands. Phase 1 has no `meeting_agenda_item` usage.
> - `completed_at TEXT` has been **added** (nullable, ISO‑8601). Not in the original schema.
> - `hidden` column dropped (not used in phase 1).
> - `type` literals renamed: `temple_interview` → `temple_recommend`, `limited_temple_interview` → `temple_recommend_limited`, `calling_interview` → `calling`, `action_item` → `todo`.

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
  deadline          TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal',  -- 'urgent' | 'normal' | 'whenever'
  duration_minutes  INTEGER,
  completed_at      TEXT,  -- set when state reaches a final state; cleared on reopen
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_task_ward_id ON task (ward_id);
CREATE INDEX idx_task_ward_type_state ON task (ward_id, type, state);
CREATE INDEX idx_task_assigned_user_id ON task (assigned_user_id);
CREATE INDEX idx_task_member_id ON task (member_id);
CREATE INDEX idx_task_deadline ON task (deadline);
CREATE INDEX idx_task_completed_at ON task (completed_at);
CREATE INDEX idx_task_ward_completed ON task (ward_id, completed_at);
```

---

## 9. `task_type_state`

Defines the ordered set of states for each task type (used to render the lifecycle
and determine the next/previous state by `order_index`).

- `label` — display label.
- `color` — hex color string used as the background of the state in dropdowns and buttons.
- `assign_to_user_id` — when set, a task entering this state is reassigned to this
  user. When `NULL`, the task keeps its current `assigned_user_id`.

> **Deviation from earlier schema doc:** renamed from `task_state` to `task_type_state`.
> `assign_to_user_id` was previously on the now-removed `task_type_state_transition`
> table; it has been moved here so reassignment is configured per state rather than
> per transition. The `task_type_state_transition` table has been removed entirely.

```sql
CREATE TABLE task_type_state (
  id                  TEXT PRIMARY KEY,
  ward_id             TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type           TEXT NOT NULL,
  state               TEXT NOT NULL,
  label               TEXT NOT NULL,
  color               TEXT NOT NULL DEFAULT '#3b82f6',
  order_index         INTEGER NOT NULL DEFAULT 0,
  is_final            INTEGER NOT NULL DEFAULT 0,
  assign_to_user_id   TEXT REFERENCES user (id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_task_type_state_type ON task_type_state (task_type);
CREATE INDEX idx_task_type_state_ward_id ON task_type_state (ward_id);
CREATE UNIQUE INDEX idx_task_type_state_type_state_unique ON task_type_state (task_type, state);
```

---

## 10. `task_type`

Per‑ward configuration of task types. Composite primary key `(ward_id, type)` — no
separate `id` column. Stores the human‑readable display name and a JSON `configuration`
string applied to new tasks of that type.

- `type` — one of `temple_recommend`, `temple_recommend_limited`, `youth_interview`,
  `calling`, `check_in`. The `todo` type is **never stored** in this table — it always
  exists programmatically for every ward (see `lib/tasks/defaults.ts`).
- `name` — display name (e.g. "Temple recommend").
- `name_short` — abbreviated label, max 4 characters (e.g. "T", "TL", "CALL", "CI", "Y"). Always rendered in a fixed-width slot for alignment.
- `color` — hex color string used as the background of the type badge in the UI.
- `configuration` — JSON string. `durationMinutes` is copied onto a `task` row at
  creation time (so a task keeps its duration even if the type default later changes).
  `showTaskTitle` controls whether the title field is shown for tasks of this type.

> **Deviation from earlier schema doc:** this table is new (not present in the original
> schema). `todo` is intentionally never stored in it.

```sql
CREATE TABLE task_type (
  ward_id           TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  name              TEXT NOT NULL,
  name_short        TEXT NOT NULL DEFAULT 'T',
  color             TEXT NOT NULL DEFAULT '#71717a',
  configuration     TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ward_id, type)
);
```

No extra indexes needed — the composite primary key covers lookups by `(ward_id, type)`.
