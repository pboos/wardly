"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export function LegacyImportDialog({
  date,
  pending,
  onClose,
  onImport,
}: {
  date: string;
  pending: boolean;
  onClose: () => void;
  onImport: (
    items: { id: string; name: string; durationMin: number }[],
  ) => Promise<void>;
}) {
  const [legacy] = useState(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("wardly.bishopric-meeting.v1") ?? "null",
      );
      if (
        !value ||
        typeof value !== "object" ||
        !("items" in value) ||
        !Array.isArray(value.items)
      )
        return [];
      return value.items
        .filter(
          (item): item is { id: string; name: string; durationMin: number } =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            Number.isInteger(item.durationMin) &&
            item.durationMin > 0 &&
            item.durationMin <= 240,
        )
        .slice(0, 100);
    } catch {
      return [];
    }
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import this browser’s old agenda</DialogTitle>
          <DialogDescription>
            Add {legacy.length} one-time items to the meeting on {date}. The old
            list has no reliable meeting date, so completion marks are not
            imported. Repeating the import does not duplicate items.
          </DialogDescription>
        </DialogHeader>
        {legacy.length ? (
          <ul className="max-h-64 list-disc overflow-y-auto pl-5 text-sm">
            {legacy.map((item) => (
              <li key={item.id}>
                {item.name} · {item.durationMin} min
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved agenda was found in this browser.
          </p>
        )}
        <Button
          disabled={pending || !legacy.length}
          onClick={() => void onImport(legacy)}
        >
          {pending ? "Importing…" : "Import into this meeting"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
