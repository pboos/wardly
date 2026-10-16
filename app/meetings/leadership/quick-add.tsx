"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function QuickAdd({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (
    title: string,
    minutes: number,
    requestId: string,
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [minutes, setMinutes] = useState("5");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(title, Number(minutes), requestId).then((saved) => {
          if (saved) {
            setTitle("");
            setRequestId(crypto.randomUUID());
          }
        });
      }}
    >
      <Input
        disabled={pending}
        aria-label="Agenda item title"
        placeholder="Add agenda item"
        required
        maxLength={200}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-0 flex-1"
      />
      <Input
        disabled={pending}
        aria-label="Planned minutes"
        type="number"
        min={1}
        max={240}
        required
        value={minutes}
        onChange={(event) => setMinutes(event.target.value)}
        className="w-16 sm:w-20"
      />
      <Button disabled={pending} type="submit">
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">Add</span>
        <span className="sr-only sm:hidden">Add item</span>
      </Button>
    </form>
  );
}
