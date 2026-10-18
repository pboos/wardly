"use client";
import { UserAssignee } from "@/components/user-assignee";
import type { Task } from "@/lib/tasks/types";
export function AssigneeCell({
  task,
  userItems,
  onUpdate,
}: {
  task: Task;
  userItems: { value: string; label: string }[];
  onUpdate: (value: string | null) => void;
}) {
  return (
    <UserAssignee
      items={userItems}
      value={task.assigned_user_id}
      name={task.assigned_user_name}
      onChange={onUpdate}
      label={task.assigned_user_id ? "Change assignee" : "Assign user"}
    />
  );
}
