import type { TaskTypeDef } from "./types";

/**
 * Default seed data for the five non-built-in task types. Used by the
 * "Seed defaults" action to populate `task_type` and `task_type_state`
 * rows for a ward. `isBuiltIn` is always `false` and `id` is omitted on
 * states (the database generates UUIDs on insert).
 *
 * Shape matches `TaskTypeDef[]` so seed data and loaded data use the
 * same structure.
 */
export const SEED_DEFAULTS: TaskTypeDef[] = [
  {
    type: "temple_recommend",
    name: "Temple recommend",
    name_short: "T",
    color: "#6366f1",
    configuration: { durationMinutes: 30, showTaskTitle: false },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", order_index: 0, state_group: "not_started", progress_percentage: 0, assign_to_user_id: null },
      { state: "organize_stake", label: "Organize stake", color: "#f59e0b", order_index: 1, state_group: "active", progress_percentage: 0.5, assign_to_user_id: null },
      { state: "stake_interview", label: "Stake interview", color: "#f97316", order_index: 2, state_group: "active", progress_percentage: 0.5, assign_to_user_id: null },
      { state: "print_handout", label: "Print handout", color: "#a855f7", order_index: 3, state_group: "active", progress_percentage: 0.5, assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", order_index: 4, state_group: "closed", progress_percentage: 1, assign_to_user_id: null },
    ],
  },
  {
    type: "temple_recommend_limited",
    name: "Temple recommend (limited)",
    name_short: "TL",
    color: "#818cf8",
    configuration: { durationMinutes: 30, showTaskTitle: false },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", order_index: 0, state_group: "not_started", progress_percentage: 0, assign_to_user_id: null },
      { state: "print_handout", label: "Print handout", color: "#a855f7", order_index: 1, state_group: "active", progress_percentage: 0.5, assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", order_index: 2, state_group: "closed", progress_percentage: 1, assign_to_user_id: null },
    ],
  },
  {
    type: "youth_interview",
    name: "Youth interview",
    name_short: "Y",
    color: "#22c55e",
    configuration: { durationMinutes: 15, showTaskTitle: false },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", order_index: 0, state_group: "not_started", progress_percentage: 0, assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", order_index: 1, state_group: "closed", progress_percentage: 1, assign_to_user_id: null },
    ],
  },
  {
    type: "calling",
    name: "Calling",
    name_short: "C",
    color: "#f59e0b",
    configuration: { durationMinutes: 10, showTaskTitle: true },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", order_index: 0, state_group: "not_started", progress_percentage: 0, assign_to_user_id: null },
      { state: "pray", label: "Pray", color: "#8b5cf6", order_index: 1, state_group: "active", progress_percentage: 0.2, assign_to_user_id: null },
      { state: "interview_person", label: "Interview person", color: "#0ea5e9", order_index: 2, state_group: "active", progress_percentage: 0.4, assign_to_user_id: null },
      { state: "in_front_of_ward", label: "In front of ward", color: "#06b6d4", order_index: 3, state_group: "active", progress_percentage: 0.6, assign_to_user_id: null },
      { state: "set_apart", label: "Set apart", color: "#14b8a6", order_index: 4, state_group: "active", progress_percentage: 0.8, assign_to_user_id: null },
      { state: "entering_in_system", label: "Entering in system", color: "#64748b", order_index: 5, state_group: "active", progress_percentage: 0.8, assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", order_index: 6, state_group: "closed", progress_percentage: 1, assign_to_user_id: null },
    ],
  },
  {
    type: "check_in",
    name: "Check-in",
    name_short: "CI",
    color: "#14b8a6",
    configuration: { durationMinutes: 15, showTaskTitle: true },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", order_index: 0, state_group: "not_started", progress_percentage: 0, assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", order_index: 1, state_group: "closed", progress_percentage: 1, assign_to_user_id: null },
    ],
  },
];
