import type { Task, TaskType } from "./types";

/** Stable sorting preserves the incoming newest-first order for equal ties. */
export function sortTasksByProgress<T extends Pick<Task, "type" | "state">>(
  tasks: T[],
  taskTypes: TaskType[],
): T[] {
  const types = new Map(taskTypes.map((type) => [type.type, type]));
  const progress = (task: T) =>
    types.get(task.type)?.states.find((state) => state.state === task.state)
      ?.progress_percentage ?? 0;

  return [...tasks].sort(
    (a, b) =>
      progress(b) - progress(a) ||
      (types.get(a.type)?.name ?? a.type).localeCompare(
        types.get(b.type)?.name ?? b.type,
      ),
  );
}
