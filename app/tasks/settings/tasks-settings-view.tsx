"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskTypeDef, WardUser } from "@/lib/tasks/types";
import { updateStateAssignee, updateTaskType } from "./actions";

export function TasksSettingsView({
  users,
  taskTypes,
}: {
  users: WardUser[];
  taskTypes: TaskTypeDef[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const userItems = useMemo(() => users.map((u) => ({ value: u.id, label: u.name })), [users]);

  const dbTypes = taskTypes.filter((taskType) => taskType.source !== "default");
  const defaultTypes = taskTypes.filter((taskType) => taskType.source === "default");

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
                  <span>{t.name}</span>
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
                  run(() => updateStateAssignee(taskType, state, userId), "State updated.")
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TaskTypeEditorRow({
  type,
  name,
  durationMinutes,
  onSave,
}: {
  type: string;
  name: string;
  durationMinutes?: number;
  onSave: (name: string, durationMinutes: number) => void;
}) {
  const [localName, setLocalName] = useState(name);
  const [localDuration, setLocalDuration] = useState(
    durationMinutes !== undefined ? String(durationMinutes) : "",
  );
  const dirty =
    localName.trim() !== name ||
    (localDuration === "" ? undefined : Number(localDuration)) !== durationMinutes;

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5 sm:flex-1">
        <Label htmlFor={`name-${type}`}>Name</Label>
        <Input
          id={`name-${type}`}
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-32">
        <Label htmlFor={`duration-${type}`}>Duration (min)</Label>
        <Input
          id={`duration-${type}`}
          type="number"
          inputMode="numeric"
          min={0}
          value={localDuration}
          onChange={(e) => setLocalDuration(e.target.value)}
        />
      </div>
      <Button
        disabled={!dirty}
        onClick={() =>
          onSave(localName.trim() || name, localDuration === "" ? 0 : Number(localDuration))
        }
      >
        Save
      </Button>
    </li>
  );
}

function StatesCard({
  typeDef,
  userItems,
  onSave,
}: {
  typeDef: TaskTypeDef;
  userItems: { value: string; label: string }[];
  onSave: (taskType: string, state: string, userId: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium">{typeDef.name}</h3>
      <ul className="flex flex-col gap-2">
        {typeDef.states.map((s) => (
          <li key={s.state} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm sm:w-64">
              {s.label}
              {s.state_group === "closed" && (
                <span className="ml-1.5 text-xs text-muted-foreground">(closed)</span>
              )}
            </span>
            <div className="sm:w-56">
              <Combobox
                items={userItems}
                value={s.assign_to_user_id}
                onChange={(v) => onSave(typeDef.type, s.state, v)}
                placeholder="Keep current assignee"
                searchPlaceholder="Search users…"
                emptyText="No users found."
                clearable
                clearLabel="Keep current"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
