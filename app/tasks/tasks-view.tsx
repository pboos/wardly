"use client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Task, TaskType, WardMember, WardUser } from "@/lib/tasks/types";
import { useMemo, useState } from "react";
import { AddTaskButton } from "./add-task-button";
import { Filters } from "./filters";
import { PastTasks } from "./past-tasks";
import { TasksList } from "./tasks-list";
type Filter = "all" | "mine" | string;
export function TasksView({
  activeTasks,
  pastTasks,
  users,
  members,
  taskTypes,
  currentUserId,
}: {
  activeTasks: Task[];
  pastTasks: Task[];
  users: WardUser[];
  members: WardMember[];
  taskTypes: TaskType[];
  currentUserId: string;
}) {
  const enabledTaskTypes = taskTypes.filter((taskType) => taskType.enabled);

  // Filters
  const [filter, setFilter] = useState<Filter>("all");

  const filteredActive = useMemo(() => {
    if (filter === "all") return activeTasks;
    if (filter === "mine")
      return activeTasks.filter((t) => t.assigned_user_id === currentUserId);
    return activeTasks.filter((t) => t.type === filter);
  }, [activeTasks, filter, currentUserId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <Filters
          filter={filter}
          onFilterChange={setFilter}
          taskTypes={enabledTaskTypes}
        />
        <AddTaskButton
          taskTypes={enabledTaskTypes}
          members={members}
          users={users}
        />
      </div>
      {enabledTaskTypes.length === 0 && (
        <Alert>
          <AlertTitle>No task types are enabled</AlertTitle>
          <AlertDescription>
            Enable a task type before adding tasks.
          </AlertDescription>
        </Alert>
      )}

      <TasksList
        tasks={filteredActive}
        users={users}
        members={members}
        taskTypes={taskTypes}
        past={false}
      />

      <PastTasks
        tasks={pastTasks}
        users={users}
        members={members}
        taskTypes={taskTypes}
      />
    </div>
  );
}
