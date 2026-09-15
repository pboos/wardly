"use client";
import { UserAvatar } from "@/components/user-avatar";
import type { Task } from "@/lib/tasks/types";
import { InlineCombobox } from "./inline-combobox";
type Item = { value: string; label: string };
export function AssigneeCell({
  task,
  userItems,
  onUpdate,
}: {
  task: Task;
  userItems: Item[];
  onUpdate: (v: string | null) => void;
}) {
  const assigneeName =
    task.assigned_user_name ??
    (task.assigned_user_id
      ? (userItems.find((u) => u.value === task.assigned_user_id)?.label ?? "?")
      : "?");
  return (
    <InlineCombobox
      items={userItems}
      value={task.assigned_user_id}
      onChange={onUpdate}
      clearable
      searchPlaceholder="Search users…"
      emptyText="No users found."
      clearLabel="No assignee"
      align="center"
    >
      {task.assigned_user_id ? (
        <button
          type="button"
          className="hover:opacity-80"
          aria-label="Change assignee"
        >
          <UserAvatar name={assigneeName} size="sm" />
        </button>
      ) : (
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted"
          aria-label="Assign user"
        >
          +
        </button>
      )}
    </InlineCombobox>
  );
}
