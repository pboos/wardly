import type { withDefaultStateValues } from "./utils";

type DefaultTaskType = Parameters<typeof withDefaultStateValues>[0][number];

const common = {
  name_short: "AP",
  color: "#1d4ed8",
  configuration: { durationMinutes: 30, showTaskTitle: true },
  enabled: true,
  source: "default",
} satisfies Omit<DefaultTaskType, "type" | "name" | "states">;

const interview = {
  state: "todo",
  label: "Interview",
  color: "#475569",
  state_group: "not_started",
  assign_to_user_id: null,
} satisfies DefaultTaskType["states"][number];

const sustain = {
  state: "sustain",
  color: "#7e22ce",
  state_group: "active",
  assign_to_user_id: null,
} satisfies Omit<DefaultTaskType["states"][number], "label">;

const ordination = {
  state: "confer_ordain",
  label: "(Confer &) Ordain",
  color: "#b45309",
  state_group: "active",
  assign_to_user_id: null,
} satisfies DefaultTaskType["states"][number];

const record = {
  state: "record",
  label: "Record in LCR",
  color: "#0f766e",
  state_group: "active",
  assign_to_user_id: null,
} satisfies DefaultTaskType["states"][number];

const done = {
  state: "done",
  label: "Done",
  color: "#15803d",
  state_group: "closed",
  assign_to_user_id: null,
} satisfies DefaultTaskType["states"][number];

export const AARONIC_TASK_TYPES: DefaultTaskType[] = [
  {
    ...common,
    type: "priesthood_aaronic",
    name: "Aaronic Priesthood",
    states: [
      interview,
      { ...sustain, label: "Sustain in front of quorum" },
      ordination,
      record,
      {
        state: "in_front_of_ward",
        label: "In front of ward",
        color: "#7e22ce",
        state_group: "active",
        assign_to_user_id: null,
        sunday_meeting_item_type: "priesthood_aaronic_inform",
      },
      done,
    ],
  },
  {
    ...common,
    type: "priesthood_aaronic_adult",
    name: "Aaronic Priesthood (Adult)",
    states: [
      interview,
      {
        ...sustain,
        label: "Sustain in front of ward",
        sunday_meeting_item_type: "calling_sustain",
      },
      { ...ordination, label: "Confer & Ordain" },
      record,
      done,
    ],
  },
];
