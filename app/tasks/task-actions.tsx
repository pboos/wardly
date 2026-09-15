"use client";
import { Button } from "@/components/ui/button";
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
import type { Task } from "@/lib/tasks/types";
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTask } from "./actions";
export function TaskActions({
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
            <DropdownMenuItem onSelect={() => onReopen()}>
              Reopen
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            variant="destructive"
          >
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
