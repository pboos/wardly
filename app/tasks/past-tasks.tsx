"use client";
import type { Task, TaskType, WardMember, WardUser } from "@/lib/tasks/types";
import { useState } from "react";
import { TasksList } from "./tasks-list";
export function PastTasks({
  tasks,
  users,
  members,
  taskTypes,
}: {
  tasks: Task[];
  users: WardUser[];
  members: WardMember[];
  taskTypes: TaskType[];
}) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
        <span>Past tasks</span>
        <span className="text-muted-foreground">{tasks.length}</span>
      </summary>
      <div className="border-t border-border p-3">
        <TasksList
          tasks={tasks}
          users={users}
          members={members}
          taskTypes={taskTypes}
          past
        />
      </div>
    </details>
  );
}
