"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceField } from "./choice-field";

export function RemovalChoice({
  repeating,
  pending,
  onRemove,
}: {
  repeating: boolean;
  pending: boolean;
  onRemove: (scope: "this" | "future") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"this" | "future">("this");
  if (!open)
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Remove item
      </Button>
    );
  return (
    <div className="flex w-full flex-col gap-3 rounded-md border p-3">
      <ChoiceField
        id="removal-scope"
        label="Remove item from"
        value={scope}
        onChange={(value) => setScope(value === "future" ? "future" : "this")}
        options={[
          { value: "this", label: "This meeting only" },
          ...(repeating
            ? [{ value: "future", label: "This and future meetings" }]
            : []),
        ]}
      />
      <p className="text-sm text-muted-foreground">
        {scope === "future"
          ? "Stops this recurring item and removes its pending discussions from this and future meetings. Past discussions, notes, and tasks are kept."
          : "Removes this appearance. Future recurring appearances, discussion history, notes, and tasks are kept."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => void onRemove(scope)}
        >
          Confirm removal
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Keep item
        </Button>
      </div>
    </div>
  );
}
