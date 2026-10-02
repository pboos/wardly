import type { DigestTask } from "./reminder-email";

const GROUPS = [
  {
    name: "Temple",
    types: [
      "temple_recommend",
      "temple_recommend_limited",
      "temple_endowment_living",
      "temple_sealing_living",
    ],
  },
  {
    name: "Priesthood",
    types: ["priesthood_aaronic", "priesthood_melchizedek"],
  },
  { name: "Callings", types: ["calling", "calling_release"] },
  {
    name: "Interviews & recommendations",
    types: [
      "youth_interview",
      "check_in",
      "patriarchal_blessing_recommend",
      "missionary_recommendation",
    ],
  },
  {
    name: "Children & ordinances",
    types: ["child_baptism", "child_naming_blessing"],
  },
  { name: "Other tasks", types: [] },
];

export function digestProgress(task: DigestTask): number {
  return Number.isFinite(task.progress)
    ? Math.max(0, Math.min(1, task.progress ?? 0))
    : 0;
}

/** Stable ties retain the service's newest-created-first input order. */
export function groupDigestTasks(tasks: DigestTask[]) {
  const grouped = GROUPS.map((group) => ({
    ...group,
    tasks: [] as DigestTask[],
  }));
  for (const task of tasks) {
    const group =
      grouped.find((group) => group.types.includes(task.typeKey ?? "")) ??
      grouped[grouped.length - 1];
    group.tasks.push(task);
  }
  return grouped
    .filter((group) => group.tasks.length)
    .map((group) => ({
      name: group.name,
      tasks: group.tasks.sort(
        (a, b) =>
          digestProgress(b) - digestProgress(a) || a.type.localeCompare(b.type),
      ),
    }));
}
