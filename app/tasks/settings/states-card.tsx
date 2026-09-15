"use client";
import { Combobox } from "@/components/ui/combobox";
import type { TaskType } from "@/lib/tasks/types";
import { TaskTypeIcon } from "../task-type-icon";

export function StatesCard({
  typeDef,
  userItems,
  onSave,
}: {
  typeDef: TaskType;
  userItems: { value: string; label: string }[];
  onSave: (taskType: string, state: string, userId: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <TaskTypeIcon type={typeDef.type} />
        {typeDef.name}
      </h3>
      <ul className="flex flex-col gap-2">
        {typeDef.states.map((s) => (
          <li
            key={s.state}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <span className="text-sm sm:w-64">
              {s.label}
              {s.state_group === "closed" && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (closed)
                </span>
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
