"use client";
import type { TaskType, WardUser } from "@/lib/tasks/types";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { TaskTypeIcon } from "../task-type-icon";
import { updateStateAssignee, updateTaskType } from "./actions";
import { StatesCard } from "./states-card";
import { TaskTypeEditorRow } from "./task-type-editor-row";

export function TasksSettingsView({
  users,
  taskTypes,
}: {
  users: WardUser[];
  taskTypes: TaskType[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const userItems = useMemo(
    () => users.map((u) => ({ value: u.id, label: u.name })),
    [users],
  );

  const dbTypes = taskTypes.filter((taskType) => taskType.source !== "default");
  const defaultTypes = taskTypes.filter(
    (taskType) => taskType.source === "default",
  );

  function run(fn: () => Promise<void>, okMsg: string) {
    start(async () => {
      try {
        await fn();
        toast.success(okMsg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed.", {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  // Show an assignment editor for every resolved lifecycle.
  const typesWithStates = taskTypes.filter((t) => t.states.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Task types</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          {dbTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No database-backed task types have been configured.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {dbTypes.map((t) => (
                <TaskTypeEditorRow
                  key={t.type}
                  type={t.type}
                  name={t.name}
                  durationMinutes={t.configuration.durationMinutes}
                  onSave={(name, durationMinutes) =>
                    run(
                      () => updateTaskType(t.type, { name, durationMinutes }),
                      "Task type updated.",
                    )
                  }
                />
              ))}
            </ul>
          )}
          {defaultTypes.length > 0 && (
            <ul className="flex flex-col gap-1">
              {defaultTypes.map((t) => (
                <li
                  key={t.type}
                  className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                >
                  <span className="flex items-center gap-2">
                    <TaskTypeIcon type={t.type} />
                    {t.name}
                  </span>
                  <span>Automatic</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">States</h2>
        {typesWithStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No states are configured for this ward.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {typesWithStates.map((t) => (
              <StatesCard
                key={t.type}
                typeDef={t}
                userItems={userItems}
                onSave={(taskType, state, userId) =>
                  run(
                    () => updateStateAssignee(taskType, state, userId),
                    "State updated.",
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
