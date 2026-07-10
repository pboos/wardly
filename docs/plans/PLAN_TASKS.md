# Plan: Tasks Feature (Phase 1)

Phase 1 of the tasks feature. This phase covers the `tasks` page, the task state machine, and the task-settings page. **Out of scope:** linking a task to an agenda item / meeting (no `agenda_item_id` column, no `meeting_agenda_item` usage yet — will be added in a later migration).

All decisions below were confirmed with the user during planning.

---

## 1. Database / Schema

### 1.1 Schema-doc changes (`docs/DATABASE_SCHEMA.md`)

Update section **8. `task`**:

- **Rename task type literals** (column values, not the table name):
  - `temple_interview` → **`temple_recommend`** 
  - `limited_temple_interview` → **`temple_recommend_limited`**
  - `calling_interview` → **`calling`**
  - `action_item` → **`todo`**
  - `youth_interview`, `check_in` stay as-is.
  - Final set of type values: `temple_recommend`, `temple_recommend_limited`, `youth_interview`, `calling`, `check_in`, `todo`.
- **Remove `agenda_item_id`** column (and its index `idx_task_agenda_item_id`) from the `task` table for now. It will be added back in a later migration when agenda linking lands. **Deviation from `DATABASE_SCHEMA.md` — call this out in the migration and in the schema doc.**
- **Add `completed_at TEXT`** column to the `task` table (nullable, ISO‑8601). Set when a task enters a final state; cleared if the task is reopened. This is needed for the "past tasks" view ordered by completion date. **Deviation from `DATABASE_SCHEMA.md` — call this out.**

```sql
-- new task table (phase 1)
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

Indexes: keep the existing ones **except** `idx_task_agenda_item_id` (column removed). Add:

```sql
CREATE INDEX idx_task_completed_at ON task (completed_at);
CREATE INDEX idx_task_ward_completed ON task (ward_id, completed_at);
```

### 1.2 New `task_type` table

Per-ward configuration of task types. **Composite primary key `(ward_id, type)`** — no separate `id` column. Stores the human-readable name and default duration that get applied to new tasks of that type.

- `todo` is **never stored** in this table — it always exists programmatically for every ward (see §2.1). Seeding skips it.
- `configuration` contains the task configuration as a JSON string. When read/written done through JSON serialize/deserialize.
  - `durationMinutes` is copied onto a `task` row at creation time (so a task keeps its duration even if the type default later changes). Editing the duration on an individual task is **out of scope for phase 1**.
  - `showTaskTitle` is a boolean if title is shown or not.

```sql
CREATE TABLE task_type (
  ward_id           TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  type              TEXT NOT NULL,  -- 'temple_recommend' | 'temple_recommend_limited' | 'youth_interview' | 'calling' | 'check_in'
  name              TEXT NOT NULL,  -- display name, e.g. "Temple recommend"
  configuration     TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ward_id, type)
);
```

No extra indexes needed — the composite PK covers lookups by `(ward_id, type)`. This table is a **deviation from `DATABASE_SCHEMA.md`** (which has no `task_type` table); add it as a new section there and note the deviation.

### 1.3 `task_state` — changes

Rename to `task_type_state`.

Otherwise kept as-is. Seeded per ward to define the ordered states + labels + `is_final` per task type. (Seeding includes `todo` state rows so its lifecycle is consistent with other types — see §2.1 for the fallback rule.)

### 1.4 `task_state_transition` changes

Rename to `task_type_state_transition`.

Replace `assign_to_role TEXT` with **`assign_to_user_id TEXT REFERENCES user (id) ON DELETE SET NULL`**.

- Phase 1 has no roles/role table. Reassignment targets a specific user instead of a role.
- `assign_to_user_id` is nullable. When `NULL`, the transition keeps the current `assigned_user_id`.
- Configured per ward on the **task settings page** (see §4).

```sql
CREATE TABLE task_type_state_transition (
  id                  TEXT PRIMARY KEY,
  ward_id             TEXT NOT NULL REFERENCES ward (id) ON DELETE CASCADE,
  task_type           TEXT NOT NULL,
  from_state          TEXT NOT NULL,
  to_state            TEXT NOT NULL,
  assign_to_user_id   TEXT REFERENCES user (id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Indexes unchanged. (The schema doc currently lists `assign_to_role`; update it to `assign_to_user_id` and note the deviation.)

### 1.5 Prisma schema (`prisma/schema.prisma`)

Add `task`, `task_type`, `task_type_state`, `task_type_state_transition` models matching the SQL above (singular names, `created_at`/`updated_at` `DateTime @default(now())`, `@@index` blocks mirroring the SQL indexes, `onDelete` rules per the SQL). `task_type` uses `@@id([ward_id, type])` as its composite primary key (no `id` field). Add the relations to `ward`, `user`, `member`.

### 1.6 Migration

One new migration created via `bun run db:migrate` (name e.g. `add_tasks_phase1`). Verify the generated `migration.sql` against the schema doc before committing.

---

## 2. Task types, states, and the `todo` default

### 2.1 Built-in `todo` default (works without seeded tables)

The `todo` type always works, even before seeding `task_type_state`. Its lifecycle is hardcoded in code as a fallback:

- `todo` → `done`
- `done` is final.

If `task_type_state` rows for `todo` exist for the ward, those take precedence (so a ward can customize). Otherwise the code falls back to the built-in two-state lifecycle. This guarantees a brand-new ward can create `todo` tasks immediately without visiting settings.

### 2.2 Seeded defaults (applied via the seed button on the settings page)

When the user clicks "Seed defaults" on `/tasks/settings`, the action is idempotent and inserts, for the current ward:

1. **`task_type` rows** for the five non-`todo` types (`temple_recommend`, `temple_recommend_limited`, `youth_interview`, `calling`, `check_in`) — skipping any `(ward_id, type)` pairs that already exist. Each row carries the display `name` and `duration_minutes` from `lib/tasks/defaults.ts`. `todo` is **never** inserted here (it always exists programmatically — §2.1).
2. **`task_type_state` rows** for all six types (including `todo`) — skipping types that already have state rows. Default state sequences (from `TASKS.md`):
3. **`task_type_state_transition` rows** for every consecutive state pair of each seeded type, so the "advance one step" button knows the next state. `assign_to_user_id` is left `NULL` initially; the user configures it on the settings page.

| Type | States (in order) | Final | Configuration |
|---|---|---|---|
| `temple_recommend` | `todo` → `organize_stake` → `stake_interview` → `print_handout` → `done` | `done` | `{ "durationMinutes": 30, "showTaskTitle": false }` |
| `temple_recommend_limited` | `todo` → `print_handout` → `done` | `done` | `{ "durationMinutes": 30, "showTaskTitle": false }` |
| `youth_interview` | `todo` → `done` | `done` | `{ "durationMinutes": 15, "showTaskTitle": false }` |
| `calling` | `todo` → `pray` → `interview_person` → `in_front_of_ward` → `set_apart` → `entering_in_system` → `report` → `done` | `done` | `{ "durationMinutes": 10, "showTaskTitle": true }` |
| `check_in` | `todo` → `done` | `done` | `{ "durationMinutes": 15, "showTaskTitle": true }` |
| `todo` | `todo` → `done` | `done` | `{ "showTaskTitle": true }` — (no `task_type` row) |

Display names (stored in `task_type.name`): "Temple recommend", "Temple recommend (limited)", "Youth interview", "Calling", "Check-in". The `todo` type's display name "Task" is hardcoded in `lib/tasks/defaults.ts` since it has no `task_type` row. So we have the defaults and seed defaults which will be separate constants inside defaults.ts. One is always read and combined with db task types. The seed one is only read and written to db in "seed defaults".

Defaults live in a new module `lib/tasks/defaults.ts` (mirrors the pattern of `lib/meetings/bishopric-defaults.ts`).

### 2.3 State advancement rule

"Mark as done" = advance one step along the seeded transitions:

1. Look up the `task_type_state_transition` row for `(ward_id, task_type, from_state = current state)`.
2. If exactly one transition exists → set `state = to_state`.
3. If the new state `is_final` → set `completed_at = now()`.
4. If `assign_to_user_id` is set on the transition → reassign `assigned_user_id` to that user. Otherwise keep the current assignee.
5. If no transition exists (e.g. `todo` type with no seeded rows) → fall back to the built-in `todo → done` lifecycle.

If the task is already in a final state, the "advance" button is disabled (just show a check icon).

---

## 3. `/tasks` page

Replaces the current "Coming soon." placeholder at `app/tasks/page.tsx`.

### 3.1 Server component (`app/tasks/page.tsx`)

- `getCurrentUser()`.
- Load active tasks for the ward: `task` rows where `ward_id = user.ward_id` and `completed_at IS NULL`, ordered by `created_at desc` (then by `type`).
- Load past tasks: `task` rows where `ward_id = user.ward_id`, `completed_at IS NOT NULL`, ordered by `completed_at desc`. Limit to the most recent ~50 (configurable).
- Load ward users (for the assignee autocomplete and inline assignee dropdown).
- Load ward members (for the member autocomplete).
- Load `task_type` rows for the ward (for display names + default durations). The `todo` type is injected in code from `lib/tasks/defaults.ts` since it has no `task_type` row.
- Load `task_type_state` rows for the ward (for state labels/order and to know which types are seeded).
- Pass everything to a new client component `TasksView`.

### 3.2 Client component (`app/tasks/tasks-view.tsx`)

Mirrors the structure of `app/members/members-view.tsx` + `members-list.tsx`.

#### Header
- Title "Tasks".
- A settings button (gear icon) → links to `/tasks/settings`.
- Filter controls (see §3.4).

#### "New task" form (top of page)
A single-row form (collapses to a stacked card on mobile) with these fields, left to right:

1. **Type** — `Select` with the six type literals (labels: "Temple recommend", "Temple recommend (limited)", "Youth interview", "Calling", "Check-in", "Task"). Defaults to `todo`.
2. **Member** — autocomplete (combobox) over ward members. Optional. Renders "Member name" once selected.
3. **Title** — `Input`. Optional **but hidden entirely** (not just empty) when the selected type configuration has `showTaskTitle: false`.
4. **Assignee** — autocomplete (combobox) over ward users. Optional.

Validation: a task requires **a title or a member** (both is allowed). If neither is present, show an inline error and do not submit.

Submit behavior:
- **Enter** (in any field) creates the task via a server action, then resets the form and **returns focus to the Type field** so the user can immediately add another.
- **Tab** moves focus Type → Member → Title (if visible) → Assignee → (back to Type on Enter).
- After submit, the new task appears at the top of the active list (optimistic local state + `revalidatePath`).

Use shadcn `Field`/`Input`/`Select`/`Label` and a new combobox built on the shadcn popover + command pattern (no raw inputs per `DESIGN.md`). If a combobox primitive isn't already installed, add it via the shadcn skill.

#### Active tasks list
- **Desktop (sm+):** a `Table` with columns: Type/Title/Member | Assignee | State | Actions.
  - **State column:** a "Done / advance" button (checkmark icon + label of the current state). One click = advance one step (§2.3).
  - **Type & content colum:**: Type badge, then the member's full name (for interview types) and/or the title (if not null or empty), then the **description** in smaller `text-muted-foreground` text below (max 1 line, ellipsize). Clicking the description swaps it for a `Textarea` + a "Save" button (see §3.5). Clicking title will also swap it for a text `Field` & "Save" button. Also click on member will show a inline dropdown (same pattern as `StatusBadge` in `members-list.tsx`) with members, selecting one will update to that member, dismissing it will keep current member). Maybe we should extract this pattern into a separate component that can be re-used.
  - **Assignee column:** inline dropdown (same pattern as `StatusBadge` in `members-list.tsx`) — click the assignee badge → `Select`/combobox of ward users → server action updates `assigned_user_id`. But don't show whole name, just show a Avatar with AvatarFallback of the initials (extract this as a new component as later we might also allow an image for the user, use same component also in @components/site-header.tsx).
  - **Actions:** a `DropdownMenu` with "Edit title/description", "Delete" (with confirmation dialog).
- **Mobile (<sm):** a stacked card list (one card per task). Same fields, vertically arranged. Type badge + title/member on the first row, description below, then a row with assignee dropdown + advance button + actions menu. Touch targets ≥40px. The table is hidden on mobile and the card list hidden on desktop — same responsive split as `members-list.tsx`.

#### Past tasks (collapsible section)
- A `<details>`-style collapsible at the bottom titled "Past tasks" with a count.
- Expanded: shows past tasks ordered by `completed_at desc`, same row/card layout as active tasks but with the completion date shown and the advance button hidden (action "Delete" possible as on normal tasks, also a "Reopen" - See 3.3 reopenTask).

### 3.3 Server actions (`app/tasks/actions.ts`)

All scoped to the current user's ward (`ward_id = user.ward_id`) — same pattern as `app/members/actions.ts`. Each calls `revalidatePath("/tasks")`.

- `createTask({ type, title?, memberId?, assignedUserId?, description? })`
  - Validate title-or-member rule.
  - Look up the `task_type` row for `(ward_id, type)` (or the built-in `todo` defaults) to copy `configuration.durationMinutes` onto the new task. For `todo`, `duration_minutes` is left null (no default).
  - Insert with `state = 'todo'`, `ward_id`, `duration_minutes` (copied from the type default), `created_at`/`updated_at`.
- `advanceTaskState(taskId)`
  - Implements §2.3.
- `updateTaskAssignee(taskId, assignedUserId | null)`
- `updateTaskTitle(taskId, title | null)`
- `updateTaskDescription(taskId, description | null)`
- `deleteTask(taskId)` — hard delete.
- `reopenTask(taskId)` — clears `completed_at` and moves state back to the previous state (the `from_state` of the transition that led into the final state), if such a transition exists; otherwise just clears `completed_at` and leaves the state.

### 3.4 Filters

A row of toggle filters above the active list (shadcn toggle buttons or a `Select`):

- **All** (default)
- **Type** — Lets select a specific type. When clicked will show inline combox to select one. When selected will just show the current type as selected toggle button. - Will filter by given task type.
- **Mine** — shows tasks where `assigned_user_id = current user`.

Filters apply to the active list only. Past-tasks section is unaffected.

### 3.5 Inline description editing

- Default: description rendered as small muted text. If empty, shows no description at all to save space.
- Click → swap to a `Textarea` (autosize-ish, min 3 rows) + a "Save" button + a "Cancel" link.
- Save → `updateTaskDescription` server action, optimistic local update.
- Enter inside the textarea inserts a newline (do not submit on Enter here — it's multiline). Submit only via the button.

### 3.6 Delete confirmation

shadcn `Dialog` ("Delete this task? This cannot be undone." → Confirm / Cancel). On confirm → `deleteTask`.

### 3.7 Mobile responsiveness

- Form collapses to a vertical stack on `<sm`.
- Active list switches from `Table` to card list on `<sm` (mirrors `members-list.tsx`).
- Filters wrap and remain tappable.
- Past-tasks section collapsible by default on mobile.
- All controls reachable without horizontal scroll; nothing hidden behind hover-only affordances (actions use a dropdown menu, not hover).

---

## 4. `/tasks/settings` page

New route. Linked from the gear button on `/tasks`.

### 4.1 Server component (`app/tasks/settings/page.tsx`)
- `getCurrentUser()`.
- Load ward users, `task_type` rows, `task_type_state` rows, `task_type_state_transition` rows for the ward.
- Render the settings view.

### 4.2 Client view (`app/tasks/settings/tasks-settings-view.tsx`)

Three sections:

#### A. "Seed defaults" button
- Calls `seedTaskDefaults()` server action (idempotent — inserts `task_type` rows for the five non-`todo` types, plus `task_type_state` + `task_type_state_transition` rows for all six types, skipping any that already exist, using `lib/tasks/defaults.ts`).
- Shows which types are already seeded (checkmarks) vs not.
- Disabled if everything is already seeded (with a "Reset to defaults" option that deletes and re-inserts — confirm dialog).

#### B. "Task types" editor
- Lists the five non-`todo` `task_type` rows (plus the always-present `todo` shown read-only as "Task — always available").
- Per row: an `Input` for the display `name` and an `Input` (number) for `duration_minutes`. Save per row via `updateTaskType(type, { name?, durationMinutes? })`.
- Note: changing `duration_minutes` here only affects **future** new tasks (the value is copied onto each `task` at creation). Existing tasks keep their copied value. Editing duration on an individual task is out of scope for phase 1.

#### C. "State transitions" editor
- For each task type that has seeded `task_type_state` rows: a card listing every transition (`from_state` → `to_state`) with a user autocomplete (combobox over ward users) for `assign_to_user_id`. Leave blank = keep current assignee.
- Save per row via `updateTransitionAssignee(transitionId, userId | null)`.
- The `todo` type is also shown here once seeded (it otherwise relies on the built-in fallback).

### 4.3 Server actions (in `app/tasks/settings/actions.ts`)
- `seedTaskDefaults()`
- `resetTaskDefaults()` (confirm) — deletes and re-seeds `task_type`, `task_type_state`, `task_type_state_transition` for the ward.
- `updateTaskType(type, { name?, durationMinutes? })` — upserts the `task_type` row for `(ward_id, type)`. Refuses `todo` (managed in code).
- `updateTransitionAssignee(transitionId, userId | null)`

All scoped to the current user's ward.

---

## 5. Navigation

The "Tasks" entry already exists in `components/site-header.tsx` (`NAV_ITEMS`) and points to `/tasks`. No header changes needed. Add `/tasks/settings` as a child of "Tasks" in the nav dropdown? **Decision: no** — settings is reachable only via the gear button on `/tasks`, to keep the nav clean. (Revisit if users get lost.)

---

## 6. Files to create / modify

| File | Action |
|---|---|
| `docs/DATABASE_SCHEMA.md` | Edit §8 (task: drop `agenda_item_id`, add `completed_at`, rename type literals in the comment) and §9 (`assign_to_role` → `assign_to_user_id`). Add a new section for the `task_type` table. |
| `prisma/schema.prisma` | Add `task`, `task_type`, `task_type_state`, `task_type_state_transition` models + relations to `ward`/`user`/`member`. `task_type` uses `@@id([ward_id, type])`. |
| `prisma/migrations/<ts>_add_tasks_phase1/migration.sql` | Generated by `bun run db:migrate`. |
| `lib/tasks/defaults.ts` | New. Default type metadata (names, durations), state sequences, and transitions per type; includes the built-in `todo` definition. |
| `lib/tasks/types.ts` | New. Shared TS types: `TaskType`, `TaskState`, `Task` (client shape), constants. |
| `lib/tasks/states.ts` | New. Helpers: `getStatesForType(ward_id, type)` with the `todo` built-in fallback; `getNextStateTransition(...)`. |
| `app/tasks/page.tsx` | Rewrite: server component loading data + `<TasksView>`. |
| `app/tasks/tasks-view.tsx` | New. Header + filters + new-task form + active/past lists. |
| `app/tasks/tasks-list.tsx` | New. The table/card list + row components (assignee dropdown, advance button, description editor, delete dialog). |
| `app/tasks/actions.ts` | New. Server actions from §3.3. |
| `app/tasks/settings/page.tsx` | New. Server component. |
| `app/tasks/settings/tasks-settings-view.tsx` | New. Seed button + task-types editor + transitions editor. |
| `app/tasks/settings/actions.ts` | New. `seedTaskDefaults`, `resetTaskDefaults`, `updateTaskType`, `updateTransitionAssignee`. |
| `components/ui/combobox.tsx` (or popover+command based autocomplete) | New, if not already present. Add via the shadcn skill. Used for member + assignee autocompletes. |

---

## 7. Deviations from `DATABASE_SCHEMA.md`

1. **`task.agenda_item_id` removed** (and its index). Will be re-added in a later migration when agenda linking is implemented. Explicitly requested by the user.
2. **`task.completed_at` added** (nullable `TEXT`). Needed for the past-tasks-by-completion-date view. Not in the original schema.
3. **`task_state` renamed to `task_type_state`**
4. **`task_state_transition` renamed to `task_type_state_transition`**
5. **`task_type_state_transition.assign_to_role` → `assign_to_user_id`** (FK to `user`, nullable). Phase 1 has no roles table; reassignment targets a specific user instead. Will be revisited when a roles/role-holders feature lands.
6. **New `task_type` table** added (composite PK `(ward_id, type)`, with `name` + `duration_minutes`). Not present in the original schema. `todo` is intentionally never stored in it.

All four are noted in `docs/DATABASE_SCHEMA.md` and in the migration.

---

## 8. Verification / testing

- `bun run db:migrate` succeeds; `migration.sql` reviewed.
- `bunx prisma migrate status` clean.
- Lint / typecheck commands pass (per repo conventions — check `package.json` scripts).
- Manual: create a `todo` task on a fresh ward (no seeding) → works via built-in fallback.
- Manual: seed defaults on `/tasks/settings`, create one of each type, advance each through its states, confirm `completed_at` set on final state and task moves to the past-tasks section.
- Manual: inline assignee change, inline description edit, delete with confirmation.
- Manual: resize to mobile widths — form stacks, table → cards, filters wrap, no horizontal scroll.
