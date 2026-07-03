"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CountdownRing } from "./countdown-ring";

export type TimerModalProps = {
  open: boolean;
  status: "idle" | "running" | "elapsed";
  remainingMs: number;
  totalMs: number;
  itemName: string;
  onExtend: (min: number) => void;
  onStop: () => void;
  onAbort: () => void;
  onDone: () => void;
};

export function TimerModal({
  open,
  status,
  remainingMs,
  totalMs,
  itemName,
  onExtend,
  onStop,
  onAbort,
  onDone,
}: TimerModalProps) {
  const elapsed = status === "elapsed";
  const progress =
    totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) return;
      }}
    >
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {elapsed ? "Time's up!" : itemName || "Timer"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {elapsed ? `${itemName}` : "Counting down"}
          </DialogDescription>
        </DialogHeader>

        <CountdownRing
          remainingMs={remainingMs}
          progress={progress}
          elapsed={elapsed}
        />

        <div className="flex flex-col gap-2">
          {elapsed ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => onExtend(1)}>
                  +1 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(2)}>
                  +2 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(5)}>
                  +5 min
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" onClick={onAbort}>
                  Abort
                </Button>
                <Button size="sm" onClick={onDone}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => onExtend(1)}>
                  +1 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(2)}>
                  +2 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(5)}>
                  +5 min
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onStop}>
                Stop
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
