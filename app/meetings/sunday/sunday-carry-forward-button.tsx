"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { carrySundayAgendaItemForward } from "./actions";

export function CarryForwardButton({ item }: { item: SundayMeetingItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function move() {
    startTransition(async () => {
      try {
        const result = await carrySundayAgendaItemForward(item.id);
        setOpen(false);
        toast.success(`Moved to ${result.destinationDate}.`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not carry item forward.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Carry forward
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carry this item forward?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The item, its linked task, and its people will move to the next
            eligible local Sunday meeting.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={move}>
              Move item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
