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

- `token` — random token sent as a link in the email (immediate login).
- `code` — 6‑character human‑readable code (uppercase, no ambiguous chars like `0`, `O`, `1`, `I`) that can be entered on the login page.
- `attempts` — counter for failed code attempts; after 3 the entry is invalidated.
- Both token and code expire 5 minutes after `created_at`. A cleanup job deletes rows older than 5 minutes.
- Once used successfully (or failed, or expired) the row should be deleted.

```sql
CREATE TABLE login (
  user_id     TEXT PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  code        TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE UNIQUE INDEX idx_login_token ON login (token);
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

```sql
CREATE TABLE member (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  birth_date  TEXT,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'moved' | 'unknown' | 'unknown_address' | 'no_contact'
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

- `type` — `temple_interview`, `limited_temple_interview`, `youth_interview`, `calling_interview`, `check_in`, `action_item`, ...
- `state` — current state in the task's lifecycle (e.g. for temple interview: `todo` → `organize_stake` → `stake_interview` → `print_handout` → `done`).
- `assigned_user_id` — the bishopric member currently responsible. When the state changes this can be reassigned (e.g. temple interview done → secretary for stake organization).
- `member_id` — the ward member the task is about (optional; avoids duplicating names).
- `agenda_item_id` — for action items, the agenda item they belong to.
- `deadline` — optional due date.
- `priority` — `urgent` | `whenever` | `normal`.
- `duration_minutes` — expected length (defaults per type, e.g. temple = 30, calling = 10, tithing = 15).
- Final states: `done` or `abandoned`.

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
  agenda_item_id    TEXT REFERENCES agenda_item (id) ON DELETE SET NULL,
  deadline          TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal',  -- 'urgent' | 'normal' | 'whenever'
  duration_minutes  INTEGER,
  hidden            INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX idx_task_agenda_item_id ON task (agenda_item_id);
CREATE INDEX idx_task_deadline ON task (deadline);
CREATE INDEX idx_task_ward_type_state_hidden ON task (ward_id, type, state, hidden);
```

---

## 9. `task_state_transition`

Defines, per task type, the allowed state transitions and the role/user assignment
that takes effect when the transition occurs. This keeps the workflow data‑driven
rather than hardcoded. There is a default setup in code that can be imported which
will add it to the database for that ward.

- `from_state` / `to_state` — the transition.
- `assign_to_role` — when set, the task is reassigned to the user currently holding
  this role in the ward (e.g. `secretary` after a temple interview is completed).

```sql
CREATE TABLE task_state_transition (
  id                TEXT PRIMARY KEY,
  ward_id           TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type         TEXT NOT NULL,
  from_state        TEXT NOT NULL,
  to_state          TEXT NOT NULL,
  assign_to_role    TEXT,  -- e.g. 'secretary' | 'bishop' | 'counselor_1' ...
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_task_state_transition_type_from ON task_state_transition (task_type, from_state);
CREATE INDEX idx_task_state_transition_ward_id ON task_state_transition (ward_id);
```

---

## 10. `task_state`

Defines the ordered set of states for each task type (used to render the lifecycle
and validate `from_state` / `to_state`).

```sql
CREATE TABLE task_state (
  id          TEXT PRIMARY KEY,
  ward_id     TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type   TEXT NOT NULL,
  state       TEXT NOT NULL,
  label       TEXT NOT NULL,  -- display label
  order_index INTEGER NOT NULL DEFAULT 0,
  is_final    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_task_state_type ON task_state (task_type);
CREATE INDEX idx_task_state_ward_id ON task_state (ward_id);
CREATE UNIQUE INDEX idx_task_state_type_state_unique ON task_state (task_type, state);
```
