import type { TaskTypeDef } from "./types";
import { withDefaultStateValues } from "./utils";

/**
 * Default seed data for the eight non-built-in task types. Used by the
 * "Seed defaults" action to populate `task_type` and `task_type_state`
 * rows for a ward. `isBuiltIn` is always `false` and `id` is omitted on
 * states (the database generates UUIDs on insert).
 *
 * Shape matches `TaskTypeDef[]` so seed data and loaded data use the
 * same structure.
 */
export const SEED_DEFAULTS: TaskTypeDef[] = withDefaultStateValues([
  {
    type: "temple_recommend",
    name: "Temple recommend",
    name_short: "T",
    color: "#6366f1",
    configuration: { durationMinutes: 30, showTaskTitle: false },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "organize_stake", label: "Organize stake", color: "#f59e0b", state_group: "active", assign_to_user_id: null },
      { state: "stake_interview", label: "Stake interview", color: "#f97316", state_group: "active", assign_to_user_id: null },
      { state: "print_handout", label: "Print handout", color: "#a855f7", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
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
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "print_handout", label: "Print handout", color: "#a855f7", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
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
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
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
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "talk_to_person", label: "Talk to person", color: "#0ea5e9", state_group: "active", assign_to_user_id: null },
      { state: "in_front_of_ward", label: "Sustain in front of ward", color: "#06b6d4", state_group: "active", assign_to_user_id: null },
      { state: "set_apart", label: "Set apart", color: "#14b8a6", state_group: "active", assign_to_user_id: null },
      { state: "record", label: "Record in LCR", color: "#64748b", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
    ],
  },
  {
    type: "priesthood_aaronic",
    name: "Aaronic Priesthood",
    name_short: "AP",
    color: "#1d4ed8",
    configuration: { durationMinutes: 30, showTaskTitle: true },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#475569", state_group: "not_started", assign_to_user_id: null },
      { state: "interview", label: "Interview", color: "#2563eb", state_group: "active", assign_to_user_id: null },
      { state: "sustain", label: "Sustain in front of quorum", color: "#7e22ce", state_group: "active", assign_to_user_id: null },
      { state: "confer_ordain", label: "(Confer &) Ordain", color: "#b45309", state_group: "active", assign_to_user_id: null },
      { state: "record", label: "Record in LCR", color: "#0f766e", state_group: "active", assign_to_user_id: null },
      { state: "in_front_of_ward", label: "In front of ward", color: "#7e22ce", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#15803d", state_group: "closed", assign_to_user_id: null },
    ],
  },
  {
    type: "priesthood_melchizedek",
    name: "Melchizedek Priesthood",
    name_short: "MP",
    color: "#6d28d9",
    configuration: { durationMinutes: 30, showTaskTitle: true },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#475569", state_group: "not_started", assign_to_user_id: null },
      { state: "interview", label: "Interview", color: "#2563eb", state_group: "active", assign_to_user_id: null },
      { state: "stake_interview", label: "Stake interview", color: "#2563eb", state_group: "active", assign_to_user_id: null },
      { state: "sustain", label: "Sustain at stake conference", color: "#7e22ce", state_group: "active", assign_to_user_id: null },
      { state: "confer_ordain", label: "Confer & Ordain", color: "#b45309", state_group: "active", assign_to_user_id: null },
      { state: "report", label: "Report ordination to stake", color: "#0f766e", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#15803d", state_group: "closed", assign_to_user_id: null },
    ],
  },
  {
    type: "calling_release",
    name: "Calling Release",
    name_short: "CR",
    color: "#f59e0b",
    configuration: { durationMinutes: 10, showTaskTitle: true },
    isBuiltIn: false,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "talk_to_person", label: "Talk to person", color: "#0ea5e9", state_group: "active", assign_to_user_id: null },
      { state: "in_front_of_ward", label: "In front of ward", color: "#06b6d4", state_group: "active", assign_to_user_id: null },
      { state: "record", label: "Record in LCR", color: "#64748b", state_group: "active", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
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
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
    ],
  },
]);
