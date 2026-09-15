"use client";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Task, TaskType } from "@/lib/tasks/types";
import { findTaskType } from "@/lib/tasks/utils";
import { useState } from "react";
import { StatePicker } from "./state-picker";
import { TypeBadge } from "./type-badge";
type Item = { value: string; label: string };
export function EditTaskModal({
  task,
  taskTypes,
  memberItems,
  userItems,
  onClose,
  onSave,
}: {
  task: Task;
  taskTypes: TaskType[];
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
  const typeDef = findTaskType(taskTypes, task.type);
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
