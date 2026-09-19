"use client";

import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TaskType, WardMember, WardUser } from "@/lib/tasks/types";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createTask } from "./actions";
import { TaskChoiceStep } from "./task-choice-step";
import { TaskTypeIcon } from "./task-type-icon";

type Step = "type" | "member" | "title" | "assignee";

export function NewTaskDialog({
  taskTypes,
  members,
  users,
  onCreated,
  onPendingChange,
}: {
  taskTypes: TaskType[];
  members: WardMember[];
  users: WardUser[];
  onCreated: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<TaskType | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const showTitle = type?.configuration.showTaskTitle ?? true;
  const member = members.find((m) => m.id === memberId);

  async function submit(assignedUserId: string | null) {
    if (saving.current || !type) return;
    const trimmedTitle = showTitle ? title.trim() : "";
    if (!memberId && !trimmedTitle) {
      setError("Enter a title or choose a member.");
      setStep(showTitle ? "title" : "member");
      return;
    }
    saving.current = true;
    setPending(true);
    onPendingChange(true);
    setError(null);
    try {
      await createTask({
        type: type.type,
        memberId,
        title: trimmedTitle || null,
        assignedUserId,
      });
      toast.success("Task added.");
      onCreated();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to create task. Please try again.",
      );
    } finally {
      saving.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }

  function nextTitle() {
    if (!memberId && !title.trim()) {
      setError("Enter a title or go back to choose a member.");
      return;
    }
    setError(null);
    setStep("assignee");
  }

  return (
    <DialogContent
      className="max-h-[90dvh] overflow-y-auto"
      showCloseButton={!pending}
    >
      <DialogHeader>
        <DialogTitle>Add task</DialogTitle>
        <DialogDescription>
          Choose a type, then fill in each field. Enter confirms your choice;
          the last field adds the task.
        </DialogDescription>
      </DialogHeader>
      {type && step !== "type" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <TaskTypeIcon type={type.type} />
          <span>{type.name}</span>
          {member && (
            <span>
              · {member.first_name} {member.last_name}
            </span>
          )}
          {showTitle && title.trim() && <span>· {title.trim()}</span>}
        </div>
      )}
      <FieldGroup>
        {step === "type" && (
          <TaskChoiceStep
            key="type"
            label="Task type"
            disabled={pending}
            items={taskTypes.map((t) => ({
              value: t.type,
              label: t.name,
              type: t.type,
            }))}
            onChoose={(value) => {
              const selected = taskTypes.find((t) => t.type === value);
              if (!selected) return;
              setType(selected);
              if (!selected.configuration.showTaskTitle) setTitle("");
              setError(null);
              setStep("member");
            }}
          />
        )}
        {step === "member" && (
          <TaskChoiceStep
            key="member"
            label="Member"
            disabled={pending}
            optionalLabel={showTitle ? "Skip member" : undefined}
            items={members.map((m) => ({
              value: m.id,
              label: `${m.first_name} ${m.last_name}`,
              exclusionTags: m.exclusionTags,
            }))}
            onChoose={(value) => {
              setMemberId(value);
              setError(null);
              setStep(showTitle ? "title" : "assignee");
            }}
          />
        )}
        {step === "title" && (
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="new-task-title">
              Title{memberId ? " (optional)" : ""}
            </FieldLabel>
            <Input
              id="new-task-title"
              autoFocus
              value={title}
              aria-invalid={!!error}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!e.nativeEvent.isComposing && !e.repeat) nextTitle();
                }
              }}
            />
          </Field>
        )}
        {step === "assignee" && (
          <TaskChoiceStep
            key="assignee"
            label="Assignee"
            disabled={pending}
            optionalLabel="Leave unassigned"
            items={users.map((u) => ({ value: u.id, label: u.name }))}
            onChoose={(value) => void submit(value)}
          />
        )}
      </FieldGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          Adding task…
        </p>
      )}
      <DialogFooter>
        {step !== "type" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              setStep(
                step === "member"
                  ? "type"
                  : step === "title"
                    ? "member"
                    : showTitle
                      ? "title"
                      : "member",
              );
            }}
          >
            Back
          </Button>
        )}
        {step === "title" && <Button onClick={nextTitle}>Next</Button>}
      </DialogFooter>
    </DialogContent>
  );
}
