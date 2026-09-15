import { Badge } from "@/components/ui/badge";
import type { TaskType } from "@/lib/tasks/types";
import { TaskTypeIcon } from "./task-type-icon";

export function TypeBadge({
  taskType,
  size,
}: {
  taskType: TaskType | undefined;
  size?: "big" | "small";
}) {
  const name = taskType?.name ?? "Unknown task type";
  return (
    <Badge
      variant="secondary"
      title={name}
      aria-label={name}
      tabIndex={size === "big" ? undefined : 0}
      className="group"
    >
      <TaskTypeIcon type={taskType?.type ?? ""} />
      {size === "big" ? (
        name
      ) : (
        <span className="sr-only group-focus:not-sr-only">{name}</span>
      )}
    </Badge>
  );
}
