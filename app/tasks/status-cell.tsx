"use client";
import type { Task, TaskType } from "@/lib/tasks/types";
import { findTaskState, findTaskType } from "@/lib/tasks/utils";
import { StatePicker } from "./state-picker";
export function StatusCell({
  task,
  taskTypes,
  onChangeState,
}: {
  task: Task;
  taskTypes: TaskType[];
  onChangeState: (
    toState: string,
    isClosed: boolean,
    assignToUserId: string | null,
  ) => void;
}) {
  const typeDef = findTaskType(taskTypes, task.type);
  if (!typeDef) return null;
  const stateDef = findTaskState(typeDef, task.state);
  if (!stateDef) return null;

  return (
    <StatePicker
      typeDef={typeDef}
      value={task.state}
      showLabel={false}
      align="start"
      onSelect={(toState, isClosed, assignToUserId) =>
        onChangeState(toState, isClosed, assignToUserId)
      }
    />
  );
}
