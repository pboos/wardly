/** Max number of past tasks loaded on the /tasks page. */
export const PAST_LIMIT = 50;

export type TaskTypeConfiguration = {
  /** Default duration in minutes copied onto a new task. `todo` has none. */
  durationMinutes?: number;
  /** Whether the title field is shown for tasks of this type. */
  showTaskTitle: boolean;
};

export type TaskStateDef = {
  /** Omitted in seed data; present when loaded from the database. */
  id?: string;
  state: string;
  label: string;
  color: string;
  order_index: number;
  is_final: boolean;
  assign_to_user_id: string | null;
};

export type TaskTypeDef = {
  type: string;
  name: string;
  name_short: string;
  color: string;
  configuration: TaskTypeConfiguration;
  isBuiltIn: boolean;
  states: TaskStateDef[];
};

/** Client shape of a task row. */
export type Task = {
  id: string;
  ward_id: string;
  type: string;
  state: string;
  title: string | null;
  description: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  member_id: string | null;
  member_first_name: string | null;
  member_last_name: string | null;
  deadline: string | null;
  priority: string;
  duration_minutes: number | null;
  completed_at: string | null;
  created_at: string;
};

/** Client shape of a ward user (for assignee autocomplete). */
export type WardUser = {
  id: string;
  name: string;
  email: string;
};

/** Client shape of a ward member (for member autocomplete). */
export type WardMember = {
  id: string;
  first_name: string;
  last_name: string;
};
