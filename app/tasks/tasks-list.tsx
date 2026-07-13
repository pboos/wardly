"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck, IconDots, IconEdit, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Label } from "@/components/ui/label";
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
import { findStateDef, findTypeDef } from "@/lib/tasks/utils";
import type {
  StateGroup,
  Task,
  TaskStateDef,
  TaskTypeDef,
  WardMember,
  WardUser,
} from "@/lib/tasks/types";
import { TaskStateIcon } from "./status-progress-icon";
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

const STATE_GROUP_LABELS: Record<StateGroup, string> = {
  not_started: "Not started",
  active: "Active",
  closed: "Closed",
};
const STATE_GROUP_ORDER: StateGroup[] = ["not_started", "active", "closed"];

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

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const editTask = editTaskId ? localTasks.find((t) => t.id === editTaskId) ?? null : null;

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
                  <TableHead className="w-28"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Assignee</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {localTasks.map((task) => {
                  const typeDef = findTypeDef(taskTypes, task.type);
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
                        <TypeBadge taskType={typeDef} />
                      </TableCell>
                      <TableCell>
                        <MemberTitleCell
                          title={task.title}
                          showTitle={typeDef?.configuration.showTaskTitle ?? true}
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
            const typeDef = findTypeDef(taskTypes, editTask.type);
            const targetStateDef = typeDef ? findStateDef(typeDef, draft.state) : null;
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
              localPatch.completed_at = isClosed ? new Date().toISOString() : null;
              if (stateAssignTo !== null) localPatch.assigned_user_id = stateAssignTo;
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
                toast.error(e instanceof Error ? e.message : "Failed to save task.", {
                  action: { label: "Reload", onClick: () => router.refresh() },
                });
                router.refresh();
              }
            });
          }}
        />
      )}
    </>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function StatusCell({
  task,
  taskTypes,
  onChangeState,
}: {
  task: Task;
  taskTypes: TaskTypeDef[];
  onChangeState: (toState: string, isClosed: boolean, assignToUserId: string | null) => void;
}) {
  const typeDef = findTypeDef(taskTypes, task.type);
  if (!typeDef) return null;
  const stateDef = findStateDef(typeDef, task.state);
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

function StatePicker({
  typeDef,
  value,
  onSelect,
  showLabel = false,
  align = "start",
  buttonClassName,
}: {
  typeDef: TaskTypeDef;
  value: string;
  onSelect: (toState: string, isClosed: boolean, assignToUserId: string | null) => void;
  showLabel?: boolean;
  align?: "start" | "center" | "end";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = findStateDef(typeDef, value);
  if (!current) return null;

  const grouped: Record<StateGroup, TaskStateDef[]> = {
    not_started: [],
    active: [],
    closed: [],
  };
  for (const s of typeDef.states) {
    grouped[s.state_group].push(s);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {showLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full justify-start gap-2 font-normal", buttonClassName)}
            aria-label="Change status"
          >
            <TaskStateIcon stateDef={current} size={16} />
            <span className="truncate">{current.label}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(buttonClassName)}
            aria-label="Change status"
          >
            <TaskStateIcon stateDef={current} size={20} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Search states…" />
          <CommandList>
            <CommandEmpty>No states found.</CommandEmpty>
            {STATE_GROUP_ORDER.filter((g) => grouped[g].length > 0).map((g) => (
              <CommandGroup key={g} heading={STATE_GROUP_LABELS[g]}>
                {grouped[g].map((s) => (
                  <CommandItem
                    key={s.state}
                    value={s.label}
                    onSelect={() => {
                      onSelect(s.state, s.state_group === "closed", s.assign_to_user_id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <TaskStateIcon stateDef={s} size={16} />
                    <span>{s.label}</span>
                    <IconCheck
                      className={cn(
                        "ml-auto",
                        s.state === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TypeBadge({ taskType, size }: { taskType: TaskTypeDef | undefined, size?: "big" | "small" | undefined }) {
  const name = taskType?.name ?? "-";
  const short = taskType?.name_short ?? name.slice(0, 2);
  const color = taskType?.color ?? "#71717a";
  return (
    <Badge
      variant="secondary"
      className="text-white"
      style={{ backgroundColor: color }}
      title={name}
    >
      {size === "big" ? name : short}
    </Badge>
  );
}

function MemberTitleCell({
  title,
  showTitle,
  memberName,
}: {
  title: string | null;
  showTitle: boolean;
  memberName: string | null;
}) {
  const hasTitle = showTitle && title;
  const hasMember = !!memberName;

  if (hasTitle && hasMember) {
    return (
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-sm font-medium">{memberName}</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
    );
  }
  if (hasTitle) {
    return <span className="text-sm font-medium">{title}</span>;
  }
  if (hasMember) {
    return <span className="text-sm font-medium">{memberName}</span>;
  }
  return <span className="text-sm text-muted-foreground">Untitled</span>;
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

function TaskActions({
  task,
  past,
  onEdit,
  onReopen,
}: {
  task: Task;
  past: boolean;
  onEdit: () => void;
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
          <DropdownMenuItem onSelect={() => onEdit()}>
            <IconEdit className="size-4" />
            Edit
          </DropdownMenuItem>
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

/* ------------------------------- Edit modal ------------------------------- */

function EditTaskModal({
  task,
  taskTypes,
  memberItems,
  userItems,
  onClose,
  onSave,
}: {
  task: Task;
  taskTypes: TaskTypeDef[];
  memberItems: Item[];
  userItems: Item[];
  onClose: () => void;
  onSave: (draft: {
    title: string | null;
    memberId: string | null;
    assignedUserId: string | null;
    state: string;
    description: string | null;
  }) => void;
}) {
  const typeDef = findTypeDef(taskTypes, task.type);
  const showTitle = typeDef?.configuration.showTaskTitle ?? true;

  const [title, setTitle] = useState(task.title ?? "");
  const [memberId, setMemberId] = useState(task.member_id);
  const [assignedUserId, setAssignedUserId] = useState(task.assigned_user_id);
  const [state, setState] = useState(task.state);
  const [description, setDescription] = useState(task.description ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title: title.trim() || null,
      memberId,
      assignedUserId,
      state,
      description: description.trim() || null,
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {showTitle && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-member">Member</Label>
            <Combobox
              items={memberItems}
              value={memberId}
              onChange={setMemberId}
              placeholder="Select member"
              searchPlaceholder="Search members…"
              emptyText="No members found."
              clearable
              clearLabel="No member"
            />
          </div>

          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-28 font-medium">Type</TableCell>
                <TableCell>
                  {typeDef ? (
                    <TypeBadge taskType={typeDef} size="big" />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-28 font-medium">Status</TableCell>
                <TableCell>
                  {typeDef ? (
                    <StatePicker
                      typeDef={typeDef}
                      value={state}
                      showLabel
                      align="start"
                      onSelect={(toState) => setState(toState)}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Assignee</TableCell>
                <TableCell>
                  <Combobox
                    items={userItems}
                    value={assignedUserId}
                    onChange={setAssignedUserId}
                    placeholder="Select assignee"
                    searchPlaceholder="Search users…"
                    emptyText="No users found."
                    clearable
                    clearLabel="No assignee"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add details…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
