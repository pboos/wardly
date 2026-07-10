"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Task, TaskTypeDef, WardMember, WardUser } from "@/lib/tasks/types";
import { createTask } from "./actions";
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
  taskTypes: TaskTypeDef[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

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

  // New-task form state
  const [type, setType] = useState<string>(taskTypes[0]?.type ?? "todo");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeSelectRef = useRef<HTMLButtonElement>(null);

  const currentTypeDef = taskTypes.find((t) => t.type === type);
  const showTitle = currentTypeDef?.configuration.showTaskTitle ?? true;

  function resetForm() {
    setType(taskTypes[0]?.type ?? "todo");
    setMemberId(null);
    setTitle("");
    setAssignedUserId(null);
    setError(null);
  }

  function submit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle && !memberId) {
      setError("A task requires either a title or a member.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createTask({
          type,
          title: trimmedTitle || null,
          memberId,
          assignedUserId,
        });
        resetForm();
        typeSelectRef.current?.focus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create task.", {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  function handleEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  // Filters
  const [filter, setFilter] = useState<Filter>("all");

  const filteredActive = useMemo(() => {
    if (filter === "all") return activeTasks;
    if (filter === "mine") return activeTasks.filter((t) => t.assigned_user_id === currentUserId);
    return activeTasks.filter((t) => t.type === filter);
  }, [activeTasks, filter, currentUserId]);

  return (
    <div className="flex flex-col gap-6">
      <NewTaskForm
        type={type}
        onTypeChange={setType}
        memberId={memberId}
        onMemberChange={setMemberId}
        title={title}
        onTitleChange={setTitle}
        assignedUserId={assignedUserId}
        onAssigneeChange={setAssignedUserId}
        showTitle={showTitle}
        error={error}
        typeSelectRef={typeSelectRef}
        memberItems={memberItems}
        userItems={userItems}
        taskTypes={taskTypes}
        onEnter={handleEnter}
        onSubmit={submit}
      />

      <Filters filter={filter} onFilterChange={setFilter} taskTypes={taskTypes} />

      <TasksList
        tasks={filteredActive}
        users={users}
        members={members}
        taskTypes={taskTypes}
        past={false}
      />

      <PastTasks tasks={pastTasks} users={users} members={members} taskTypes={taskTypes} />
    </div>
  );
}

function NewTaskForm({
  type,
  onTypeChange,
  memberId,
  onMemberChange,
  title,
  onTitleChange,
  assignedUserId,
  onAssigneeChange,
  showTitle,
  error,
  typeSelectRef,
  memberItems,
  userItems,
  taskTypes,
  onEnter,
  onSubmit,
}: {
  type: string;
  onTypeChange: (t: string) => void;
  memberId: string | null;
  onMemberChange: (v: string | null) => void;
  title: string;
  onTitleChange: (v: string) => void;
  assignedUserId: string | null;
  onAssigneeChange: (v: string | null) => void;
  showTitle: boolean;
  error: string | null;
  typeSelectRef: React.RefObject<HTMLButtonElement | null>;
  memberItems: { value: string; label: string }[];
  userItems: { value: string; label: string }[];
  taskTypes: TaskTypeDef[];
  onEnter: (e: React.KeyboardEvent) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1.5 sm:w-44">
        <Label htmlFor="new-task-type">Type</Label>
        <Select value={type} onValueChange={(v) => onTypeChange(v)}>
          <SelectTrigger id="new-task-type" ref={typeSelectRef} onKeyDown={onEnter} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taskTypes.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-1">
        <Label htmlFor="new-task-member">Member</Label>
        <Combobox
          items={memberItems}
          value={memberId}
          onChange={onMemberChange}
          placeholder="Select member"
          searchPlaceholder="Search members…"
          emptyText="No members found."
          clearable
          onKeyDown={onEnter}
        />
      </div>

      {showTitle && (
        <div className="flex flex-col gap-1.5 sm:flex-1">
          <Label htmlFor="new-task-title">Title</Label>
          <Input
            id="new-task-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={onEnter}
            placeholder="Task title"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:w-48">
        <Label htmlFor="new-task-assignee">Assignee</Label>
        <Combobox
          items={userItems}
          value={assignedUserId}
          onChange={onAssigneeChange}
          placeholder="Select assignee"
          searchPlaceholder="Search users…"
          emptyText="No users found."
          clearable
          onKeyDown={onEnter}
        />
      </div>

      <Button type="submit" className="sm:mb-px sm:self-end">
        Add task
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-full">
          {error}
        </p>
      )}
    </form>
  );
}

function Filters({
  filter,
  onFilterChange,
  taskTypes,
}: {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  taskTypes: TaskTypeDef[];
}) {
  const typeItems = taskTypes.map((t) => ({ value: t.type, label: t.name }));
  const selectedType = typeof filter === "string" && filter !== "all" && filter !== "mine" ? filter : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleButton active={filter === "all"} onClick={() => onFilterChange("all")}>
        All
      </ToggleButton>
      <ToggleButton active={filter === "mine"} onClick={() => onFilterChange("mine")}>
        Mine
      </ToggleButton>
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
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className={cn(!active && "text-muted-foreground")}
    >
      {children}
    </Button>
  );
}

function PastTasks({
  tasks,
  users,
  members,
  taskTypes,
}: {
  tasks: Task[];
  users: WardUser[];
  members: WardMember[];
  taskTypes: TaskTypeDef[];
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
        <TasksList tasks={tasks} users={users} members={members} taskTypes={taskTypes} past />
      </div>
    </details>
  );
}
