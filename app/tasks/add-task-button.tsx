"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import type { TaskType, WardMember, WardUser } from "@/lib/tasks/types";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { NewTaskDialog } from "./new-task-dialog";

export function AddTaskButton({
  taskTypes,
  members,
  users,
}: {
  taskTypes: TaskType[];
  members: WardMember[];
  users: WardUser[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const disabled = taskTypes.length === 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        disabled ||
        open ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "n"
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            'input, textarea, select, [role="combobox"], [role="textbox"], [contenteditable]',
          ))
      )
        return;
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
        )
      )
        return;
      event.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disabled, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="icon"
          disabled={disabled}
          aria-label="Add task"
          aria-keyshortcuts="n"
          title={disabled ? "No task types are enabled" : "Add task (N)"}
        >
          <IconPlus />
        </Button>
      </DialogTrigger>
      {open && (
        <NewTaskDialog
          taskTypes={taskTypes}
          members={members}
          users={users}
          onCreated={() => setOpen(false)}
          onPendingChange={setPending}
        />
      )}
    </Dialog>
  );
}
