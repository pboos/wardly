"use client";
import { Combobox } from "@/components/ui/combobox";
import type { TaskType } from "@/lib/tasks/types";
import { TaskTypeIcon } from "./task-type-icon";
import { ToggleButton } from "./toggle-button";
type Filter = "all" | "mine" | string;
export function Filters({
  filter,
  onFilterChange,
  taskTypes,
}: {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  taskTypes: TaskType[];
}) {
  const typeItems = taskTypes.map((t) => ({
    value: t.type,
    label: t.name,
    icon: <TaskTypeIcon type={t.type} />,
  }));
  const selectedType =
    typeof filter === "string" && filter !== "all" && filter !== "mine"
      ? filter
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleButton
        active={filter === "all"}
        onClick={() => onFilterChange("all")}
      >
        All
      </ToggleButton>
      <ToggleButton
        active={filter === "mine"}
        onClick={() => onFilterChange("mine")}
      >
        Mine
      </ToggleButton>
      {typeItems.length > 0 && (
        <div className="w-44">
          <Combobox
            items={typeItems}
            value={selectedType}
            onChange={(v) => onFilterChange(v ?? "all")}
            placeholder="Filter by type"
            searchPlaceholder="Search types…"
            emptyText="No types found."
            clearable
            clearLabel="All types"
          />
        </div>
      )}
    </div>
  );
}
