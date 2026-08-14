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
agenda or person assignments.

---

## 6. `sunday_meeting_item`

The canonical, ordered sacrament-meeting agenda. Person names live in
`sunday_meeting_person_assignment`, not on the agenda item itself.

```sql
CREATE TABLE sunday_meeting_item (
  id                TEXT PRIMARY KEY,
  sunday_meeting_id TEXT NOT NULL REFERENCES sunday_meeting (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  section           TEXT NOT NULL,
  standard_slot     TEXT,
  order_index       INTEGER NOT NULL,
  content           TEXT,
  hymn_number       INTEGER CHECK (hymn_number IS NULL OR hymn_number > 0),
  task_id           TEXT REFERENCES task (id) ON DELETE RESTRICT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sunday_meeting_item_order
  ON sunday_meeting_item (sunday_meeting_id, order_index);
CREATE UNIQUE INDEX idx_sunday_meeting_item_standard_slot
  ON sunday_meeting_item (sunday_meeting_id, standard_slot);
CREATE INDEX idx_sunday_meeting_item_task_id
  ON sunday_meeting_item (task_id);
```

- `section` is `opening`, `business`, `sacrament`, `program`, or `closing`.
- Nullable `standard_slot` values allow unlimited custom items while making each
  fixed slot unique per meeting.
- Fixed slots are `opening_hymn`, `opening_prayer`, `sacrament_hymn`,
  `interlude`, `primary_presentation`, `closing_hymn`, and `closing_prayer`.
- `task_id` is a one-way link. A task can later leave its suggested state without
  removing the agenda item.

Supported item types:

```text
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

---

## 7. `sunday_meeting_person_assignment`

Every named assignment is exactly one of a historical ward-member reference or
a free-text name. The direct `sunday_meeting_id` is retained for both
meeting-level and item-level assignments so scope can be enforced efficiently.

```sql
CREATE TABLE sunday_meeting_person_assignment (
  id                      TEXT PRIMARY KEY,
  sunday_meeting_id       TEXT NOT NULL REFERENCES sunday_meeting (id) ON DELETE CASCADE,
  sunday_meeting_item_id  TEXT REFERENCES sunday_meeting_item (id) ON DELETE CASCADE,
  role                    TEXT NOT NULL,
  member_id               TEXT REFERENCES member (id) ON DELETE RESTRICT,
  free_text_name          TEXT,
  order_index             INTEGER NOT NULL DEFAULT 0,
  visitor_role            TEXT,
  visitor_role_custom     TEXT,
  is_presiding_override   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (member_id IS NOT NULL AND free_text_name IS NULL)
    OR
    (member_id IS NULL AND COALESCE(length(trim(free_text_name)), 0) > 0)
  ),
  CHECK (is_presiding_override IN (0, 1))
);
```

Meeting-level roles are `leader`, `organist`, `music_conductor`, and `visitor`.
Item-level roles are `prayer`, `speaker`, `sacrament_blesser`,
`sacrament_passer`, `performer`, `subject`, and `officiant`.

```sql
CREATE UNIQUE INDEX idx_sunday_meeting_assignment_meeting_role_order
  ON sunday_meeting_person_assignment (sunday_meeting_id, role, order_index)
  WHERE sunday_meeting_item_id IS NULL;
CREATE UNIQUE INDEX idx_sunday_meeting_assignment_item_role_order
  ON sunday_meeting_person_assignment (sunday_meeting_item_id, role, order_index)
  WHERE sunday_meeting_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_sunday_meeting_assignment_one_leader
  ON sunday_meeting_person_assignment (sunday_meeting_id)
  WHERE role = 'leader' AND sunday_meeting_item_id IS NULL;
CREATE UNIQUE INDEX idx_sunday_meeting_assignment_one_presiding_override
  ON sunday_meeting_person_assignment (sunday_meeting_id)
  WHERE role = 'visitor'
    AND sunday_meeting_item_id IS NULL
    AND is_presiding_override = 1;
CREATE INDEX idx_sunday_meeting_assignment_member_role_meeting
  ON sunday_meeting_person_assignment (member_id, role, sunday_meeting_id);
```

SQLite partial unique indexes are intentionally maintained in the initial SQL
migration because Prisma 7.8 cannot express unique partial indexes in its
schema DSL.

---

## 8. `task`

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

## 9. `task_type`

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

## 10. `task_type_state`

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

## 11. `task_type_state_assignment`

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
