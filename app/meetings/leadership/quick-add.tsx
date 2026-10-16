"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { MAX_AGENDA_MINUTES } from "@/lib/leadership-meetings/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
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
      <InputGroup className="w-24 shrink-0" data-disabled={pending}>
        <InputGroupInput
          disabled={pending}
          aria-label="Planned minutes"
          type="number"
          min={1}
          max={MAX_AGENDA_MINUTES}
          required
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          className="min-w-0 text-right"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>min</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <Button disabled={pending} type="submit">
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">Add</span>
        <span className="sr-only sm:hidden">Add item</span>
      </Button>
    </form>
  );
}
