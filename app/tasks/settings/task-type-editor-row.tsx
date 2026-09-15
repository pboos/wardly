"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { TaskTypeIcon } from "../task-type-icon";

export function TaskTypeEditorRow({
  type,
  name,
  durationMinutes,
  onSave,
}: {
  type: string;
  name: string;
  durationMinutes?: number;
  onSave: (name: string, durationMinutes: number) => void;
}) {
  const [localName, setLocalName] = useState(name);
  const [localDuration, setLocalDuration] = useState(
    durationMinutes !== undefined ? String(durationMinutes) : "",
  );
  const dirty =
    localName.trim() !== name ||
    (localDuration === "" ? undefined : Number(localDuration)) !==
      durationMinutes;

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5 sm:flex-1">
        <Label htmlFor={`name-${type}`}>
          <TaskTypeIcon type={type} />
          Name
        </Label>
        <Input
          id={`name-${type}`}
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-32">
        <Label htmlFor={`duration-${type}`}>Duration (min)</Label>
        <Input
          id={`duration-${type}`}
          type="number"
          inputMode="numeric"
          min={0}
          value={localDuration}
          onChange={(e) => setLocalDuration(e.target.value)}
        />
      </div>
      <Button
        disabled={!dirty}
        onClick={() =>
          onSave(
            localName.trim() || name,
            localDuration === "" ? 0 : Number(localDuration),
          )
        }
      >
        Save
      </Button>
    </li>
  );
}
