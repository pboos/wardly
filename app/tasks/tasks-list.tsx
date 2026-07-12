"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck, IconDots, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { findStateDef, findTypeDef, getNextState } from "@/lib/tasks/utils";
import type { Task, TaskTypeDef, WardMember, WardUser } from "@/lib/tasks/types";
import {
  changeTaskState,
  deleteTask,
  reopenTask,
  updateTaskAssignee,
  updateTaskDescription,
  updateTaskMember,
  updateTaskTitle,
} from "./actions";

type Item = { value: string; label: string };

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
  taskTypes: TaskTypeDef[];
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
    () => members.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` })),
    [members],
  );
  const userItems = useMemo(
    () => users.map((u) => ({ value: u.id, label: u.name })),
    [users],
  );

  function updateLocal(id: string, patch: Partial<Task>) {
    setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
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

  return (
    <>
      {localTasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {past ? "No past tasks." : "No tasks yet."}
        </p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type / Title / Member</TableHead>
                  <TableHead className="w-32">Assignee</TableHead>
                  <TableHead className="w-48">State</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {localTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <TaskContent
                        task={task}
                        taskTypes={taskTypes}
                        memberItems={memberItems}
                        onUpdateMember={(v) => {
                          updateLocal(task.id, { member_id: v });
                          runAction(() => updateTaskMember(task.id, v));
                        }}
                        onUpdateTitle={(v) => {
                          updateLocal(task.id, { title: v });
                          runAction(() => updateTaskTitle(task.id, v));
                        }}
                        onUpdateDescription={(v) => {
                          updateLocal(task.id, { description: v });
                          runAction(() => updateTaskDescription(task.id, v));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <AssigneeCell
                        task={task}
                        userItems={userItems}
                        onUpdate={(v) => {
                          updateLocal(task.id, { assigned_user_id: v });
                          runAction(() => updateTaskAssignee(task.id, v));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <StateCell
                        task={task}
                        taskTypes={taskTypes}
                        past={past}
                        onChangeState={(toState, isClosed, assignToUserId) => {
                          updateLocal(task.id, {
                            state: toState,
                            completed_at: isClosed ? new Date().toISOString() : null,
                            ...(assignToUserId !== null
                              ? { assigned_user_id: assignToUserId }
                              : {}),
                          });
                          runAction(() => changeTaskState(task.id, toState));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TaskActions
                        task={task}
                        past={past}
                        onReopen={() => {
                          updateLocal(task.id, { completed_at: null });
                          runAction(() => reopenTask(task.id));
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: card list */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {localTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <TaskContent
                    task={task}
                    taskTypes={taskTypes}
                    memberItems={memberItems}
                    onUpdateMember={(v) => {
                      updateLocal(task.id, { member_id: v });
                      runAction(() => updateTaskMember(task.id, v));
                    }}
                    onUpdateTitle={(v) => {
                      updateLocal(task.id, { title: v });
                      runAction(() => updateTaskTitle(task.id, v));
                    }}
                    onUpdateDescription={(v) => {
                      updateLocal(task.id, { description: v });
                      runAction(() => updateTaskDescription(task.id, v));
                    }}
                  />
                  <TaskActions
                    task={task}
                    past={past}
                    onReopen={() => {
                      updateLocal(task.id, { completed_at: null });
                      runAction(() => reopenTask(task.id));
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <AssigneeCell
                    task={task}
                    userItems={userItems}
                    onUpdate={(v) => {
                      updateLocal(task.id, { assigned_user_id: v });
                      runAction(() => updateTaskAssignee(task.id, v));
                    }}
                  />
                  <StateCell
                    task={task}
                    taskTypes={taskTypes}
                    past={past}
                    onChangeState={(toState, isClosed, assignToUserId) => {
                      updateLocal(task.id, {
                        state: toState,
                        completed_at: isClosed ? new Date().toISOString() : null,
                        ...(assignToUserId !== null
                          ? { assigned_user_id: assignToUserId }
                          : {}),
                      });
                      runAction(() => changeTaskState(task.id, toState));
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function TaskContent({
  task,
  taskTypes,
  memberItems,
  onUpdateMember,
  onUpdateTitle,
  onUpdateDescription,
}: {
  task: Task;
  taskTypes: TaskTypeDef[];
  memberItems: Item[];
  onUpdateMember: (v: string | null) => void;
  onUpdateTitle: (v: string | null) => void;
  onUpdateDescription: (v: string | null) => void;
}) {
  const typeDef = findTypeDef(taskTypes, task.type);
  const showTitle = typeDef?.configuration.showTaskTitle ?? true;
  const memberLabel = task.member_id
    ? memberItems.find((m) => m.value === task.member_id)?.label ?? null
    : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={task.type} taskTypes={taskTypes} />
        <InlineCombobox
          items={memberItems}
          value={task.member_id}
          onChange={onUpdateMember}
          clearable
          searchPlaceholder="Search members…"
          emptyText="No members found."
          clearLabel="No member"
          align="start"
        >
          {memberLabel ? (
            <button type="button" className="rounded px-1.5 py-0.5 text-sm font-medium hover:bg-muted">
              {memberLabel}
            </button>
          ) : (
            <button type="button" className="rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted">
              + Member
            </button>
          )}
        </InlineCombobox>
      </div>

      {showTitle && (
        <InlineTextEdit
          value={task.title}
          onSave={onUpdateTitle}
          placeholder="Untitled"
          className="text-sm font-medium"
        />
      )}

      <InlineDescriptionEdit value={task.description} onSave={onUpdateDescription} />
    </div>
  );
}

function TypeBadge({ type, taskTypes }: { type: string; taskTypes: TaskTypeDef[] }) {
  const typeDef = findTypeDef(taskTypes, type);
  const name = typeDef?.name ?? type;
  const color = typeDef?.color ?? "#71717a";
  return (
    <Badge
      variant="secondary"
      className="text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </Badge>
  );
}

function AssigneeCell({
  task,
  userItems,
  onUpdate,
}: {
  task: Task;
  userItems: Item[];
  onUpdate: (v: string | null) => void;
}) {
  const assigneeName =
    task.assigned_user_name ??
    (task.assigned_user_id ? userItems.find((u) => u.value === task.assigned_user_id)?.label ?? "?" : "?");
  return (
    <InlineCombobox
      items={userItems}
      value={task.assigned_user_id}
      onChange={onUpdate}
      clearable
      searchPlaceholder="Search users…"
      emptyText="No users found."
      clearLabel="No assignee"
      align="center"
    >
      {task.assigned_user_id ? (
        <button type="button" className="hover:opacity-80" aria-label="Change assignee">
          <UserAvatar name={assigneeName} size="sm" />
        </button>
      ) : (
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted"
          aria-label="Assign user"
        >
          +
        </button>
      )}
    </InlineCombobox>
  );
}

function StateCell({
  task,
  taskTypes,
  past,
  onChangeState,
}: {
  task: Task;
  taskTypes: TaskTypeDef[];
  past: boolean;
  onChangeState: (toState: string, isClosed: boolean, assignToUserId: string | null) => void;
}) {
  const typeDef = findTypeDef(taskTypes, task.type);
  if (!typeDef) return null;

  const stateDef = findStateDef(typeDef, task.state);

  if (past) {
    return (
      <span className="text-sm text-muted-foreground">
        {formatDate(task.completed_at)}
      </span>
    );
  }

  if (!stateDef) return null;
  const isClosed = stateDef.state_group === "closed";
  const next = getNextState(typeDef, task.state);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant={isClosed ? "secondary" : "outline"}
        size="sm"
        disabled={isClosed}
        onClick={() => {
          if (next) {
            onChangeState(next.state, next.state_group === "closed", next.assign_to_user_id);
          }
        }}
        className="gap-1.5 text-white"
        style={{ backgroundColor: stateDef.color }}
      >
        <IconCheck className="size-4" />
        {stateDef.label}
      </Button>
      <StateDropdown
        typeDef={typeDef}
        currentState={task.state}
        onSelect={(toState, isClosed, assignToUserId) =>
          onChangeState(toState, isClosed, assignToUserId)
        }
      />
    </div>
  );
}

function StateDropdown({
  typeDef,
  currentState,
  onSelect,
}: {
  typeDef: TaskTypeDef;
  currentState: string;
  onSelect: (toState: string, isClosed: boolean, assignToUserId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Change state">
          <IconDots className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search states…" />
          <CommandList>
            <CommandEmpty>No states found.</CommandEmpty>
            <CommandGroup>
              {typeDef.states.map((s) => (
                <CommandItem
                  key={s.state}
                  value={s.label}
                  onSelect={() => {
                    onSelect(s.state, s.state_group === "closed", s.assign_to_user_id);
                    setOpen(false);
                  }}
                  className="text-white"
                  style={{ backgroundColor: s.color }}
                >
                  {s.label}
                  {s.state_group === "closed" && (
                    <span className="ml-auto text-xs text-white/70">closed</span>
                  )}
                  {s.state === currentState && (
                    <IconCheck className="ml-1 size-3.5" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TaskActions({
  task,
  past,
  onReopen,
}: {
  task: Task;
  past: boolean;
  onReopen: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, start] = useTransition();

  function handleDelete() {
    start(async () => {
      try {
        await deleteTask(task.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete task.", {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Task actions">
            <IconDots className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {past && (
            <DropdownMenuItem onSelect={() => onReopen()}>Reopen</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)} variant="destructive">
            <IconTrash className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                handleDelete();
              }}
            >
              <IconTrash className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------- Inline edit widgets --------------------------- */

function InlineTextEdit({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim() || null;
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className="h-7"
          aria-label="Edit title"
        />
        <Button type="button" size="xs" onClick={commit}>
          Save
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className={cn("truncate rounded px-1.5 py-0.5 text-left hover:bg-muted", className)}
      title={value ?? placeholder}
    >
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </button>
  );
}

function InlineDescriptionEdit({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing && !value) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
      >
        + Description
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <Textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="min-h-16"
          aria-label="Edit description"
        />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="xs"
            onClick={() => {
              const next = draft.trim() || null;
              if (next !== value) onSave(next);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="line-clamp-1 max-w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted"
      title={value ?? ""}
    >
      {value}
    </button>
  );
}

/* ------------------------------ Inline combobox ---------------------------- */

function InlineCombobox({
  items,
  value,
  onChange,
  clearable,
  searchPlaceholder,
  emptyText,
  clearLabel,
  align = "start",
  children,
}: {
  items: Item[];
  value: string | null;
  onChange: (v: string | null) => void;
  clearable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  {clearLabel ?? "Clear"}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={(label) => {
                    const match = items.find((i) => i.label === label);
                    onChange(match ? match.value : item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <IconCheck
                    className={cn(
                      "ml-auto",
                      selected?.value === item.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* --------------------------------- Helpers --------------------------------- */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
