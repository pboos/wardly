"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TaskTypeDef, WardUser } from "@/lib/tasks/types";
import {
  resetTaskDefaults,
  seedTaskDefaults,
  updateStateAssignee,
  updateTaskType,
} from "./actions";

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

  // Types that are in the DB (not built-in).
  const dbTypes = taskTypes.filter((t) => !t.isBuiltIn);
  const allSeeded = dbTypes.length > 0 && dbTypes.every((t) => t.states.length > 0);

  const [resetOpen, setResetOpen] = useState(false);

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

  // Types that have seeded state rows → show a states card each.
  const typesWithStates = taskTypes.filter((t) => t.states.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {/* A. Seed defaults */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Defaults</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Seed the default task types and states for your ward. You can then
            customize names, durations, and state assignees below.
          </p>
          <ul className="flex flex-col gap-1">
            {taskTypes.map((t) => {
              const available = t.isBuiltIn || t.states.length > 0;
              return (
                <li key={t.type} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full",
                      available ? "bg-primary text-primary-foreground" : "border border-border",
                    )}
                  >
                    {available && <IconCheck className="size-3" />}
                  </span>
                  <span>{t.name}</span>
                  {t.isBuiltIn && (
                    <span className="text-xs text-muted-foreground">(always available)</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={allSeeded}
              onClick={() => run(() => seedTaskDefaults(), "Defaults seeded.")}
            >
              Seed defaults
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </section>

      {/* B. Task types editor */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Task types</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
          <ul className="flex flex-col gap-1">
            {taskTypes
              .filter((t) => t.isBuiltIn)
              .map((t) => (
                <li
                  key={t.type}
                  className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                >
                  <span>{t.name}</span>
                  <span>Always available</span>
                </li>
              ))}
          </ul>
        </div>
      </section>

      {/* C. States editor */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">States</h2>
        {typesWithStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No states seeded yet. Click &ldquo;Seed defaults&rdquo; above to configure states.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {typesWithStates.map((t) => (
              <StatesCard
                key={t.type}
                typeDef={t}
                userItems={userItems}
                onSave={(stateId, userId) =>
                  run(() => updateStateAssignee(stateId, userId), "State updated.")
                }
              />
            ))}
          </div>
        )}
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
            <DialogDescription>
              This deletes and re-seeds all task types and states for your ward. Any
              assignee configured on states will be cleared. Existing tasks are not
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setResetOpen(false);
                run(() => resetTaskDefaults(), "Defaults reset.");
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onSave: (stateId: string, userId: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium">{typeDef.name}</h3>
      <ul className="flex flex-col gap-2">
        {typeDef.states.map((s) => (
          <li key={s.id ?? s.state} className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                onChange={(v) => {
                  if (s.id) onSave(s.id, v);
                }}
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
