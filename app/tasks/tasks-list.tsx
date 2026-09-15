"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task, TaskType, WardMember, WardUser } from "@/lib/tasks/types";
import { findTaskState, findTaskType } from "@/lib/tasks/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changeTaskState,
  reopenTask,
  updateTaskAssignee,
  updateTaskDescription,
  updateTaskMember,
  updateTaskTitle,
} from "./actions";
import { AssigneeCell } from "./assignee-cell";
import { EditTaskModal } from "./edit-task-modal";
import { MemberTitleCell } from "./member-title-cell";
import { StatusCell } from "./status-cell";
import { TaskActions } from "./task-actions";
import { TypeBadge } from "./type-badge";
export function TasksList({
  tasks,
  users,
  members,
  taskTypes,
  past,
}: {
  tasks: Task[];
  users: WardUser[];
  members: WardMember[];
  taskTypes: TaskType[];
  past: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setLocalTasks(tasks);
  }

  const memberItems = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: `${m.first_name} ${m.last_name}`,
      })),
    [members],
  );
  const userItems = useMemo(
    () => users.map((u) => ({ value: u.id, label: u.name })),
    [users],
  );

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const editTask = editTaskId
    ? (localTasks.find((t) => t.id === editTaskId) ?? null)
    : null;

  function updateLocal(id: string, patch: Partial<Task>) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  function runAction(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed.", {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  function getMemberName(task: Task): string | null {
    if (!task.member_id) return null;
    const first = task.member_first_name ?? "";
    const last = task.member_last_name ?? "";
    const joined = `${first} ${last}`.trim();
    if (joined) return joined;
    return memberItems.find((m) => m.value === task.member_id)?.label ?? null;
  }

  return (
    <>
      {localTasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {past ? "No past tasks." : "No tasks yet."}
        </p>
      ) : (
        <>
          {/* Desktop: table */}
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-16">
                    <span className="sr-only">Task type</span>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Assignee</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {localTasks.map((task) => {
                  const typeDef = findTaskType(taskTypes, task.type);
                  const memberName = getMemberName(task);

                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => setEditTaskId(task.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <StatusCell
                          task={task}
                          taskTypes={taskTypes}
                          onChangeState={(
                            toState,
                            isClosed,
                            assignToUserId,
                          ) => {
                            updateLocal(task.id, {
                              state: toState,
                              completed_at: isClosed
                                ? new Date().toISOString()
                                : null,
                              ...(assignToUserId !== null
                                ? { assigned_user_id: assignToUserId }
                                : {}),
                            });
                            runAction(() => changeTaskState(task.id, toState));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TypeBadge taskType={typeDef} />
                      </TableCell>
                      <TableCell>
                        <MemberTitleCell
                          title={task.title}
                          showTitle={
                            typeDef?.configuration.showTaskTitle ?? true
                          }
                          memberName={memberName}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <AssigneeCell
                          task={task}
                          userItems={userItems}
                          onUpdate={(v) => {
                            updateLocal(task.id, { assigned_user_id: v });
                            runAction(() => updateTaskAssignee(task.id, v));
                          }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TaskActions
                          task={task}
                          past={past}
                          onEdit={() => setEditTaskId(task.id)}
                          onReopen={() => {
                            updateLocal(task.id, { completed_at: null });
                            runAction(() => reopenTask(task.id));
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {editTask && (
        <EditTaskModal
          key={editTask.id}
          task={editTask}
          taskTypes={taskTypes}
          memberItems={memberItems}
          userItems={userItems}
          onClose={() => setEditTaskId(null)}
          onSave={(draft) => {
            const id = editTask.id;
            const typeDef = findTaskType(taskTypes, editTask.type);
            const targetStateDef = typeDef
              ? findTaskState(typeDef, draft.state)
              : null;
            const isClosed = targetStateDef?.state_group === "closed";
            const stateAssignTo = targetStateDef?.assign_to_user_id ?? null;

            const localPatch: Partial<Task> = {};
            const ops: Promise<void>[] = [];

            if (draft.title !== editTask.title) {
              localPatch.title = draft.title;
              ops.push(updateTaskTitle(id, draft.title));
            }
            if (draft.memberId !== editTask.member_id) {
              localPatch.member_id = draft.memberId;
              ops.push(updateTaskMember(id, draft.memberId));
            }
            if (draft.state !== editTask.state) {
              localPatch.state = draft.state;
              localPatch.completed_at = isClosed
                ? new Date().toISOString()
                : null;
              if (stateAssignTo !== null)
                localPatch.assigned_user_id = stateAssignTo;
              ops.push(changeTaskState(id, draft.state));
            } else if (draft.assignedUserId !== editTask.assigned_user_id) {
              localPatch.assigned_user_id = draft.assignedUserId;
              ops.push(updateTaskAssignee(id, draft.assignedUserId));
            }
            if (draft.description !== editTask.description) {
              localPatch.description = draft.description;
              ops.push(updateTaskDescription(id, draft.description));
            }

            if (Object.keys(localPatch).length > 0) updateLocal(id, localPatch);
            setEditTaskId(null);

            if (ops.length === 0) return;
            start(async () => {
              try {
                await Promise.all(ops);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Failed to save task.",
                  {
                    action: {
                      label: "Reload",
                      onClick: () => router.refresh(),
                    },
                  },
                );
                router.refresh();
              }
            });
          }}
        />
      )}
    </>
  );
}
