"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldSet, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  AgendaRow,
  LeadershipData,
} from "@/lib/leadership-meetings/loaders";
import type { MeetingCommand } from "@/lib/leadership-meetings/types";
import { ChoiceField } from "./choice-field";
export function DiscussionTasksForm({
  item,
  data,
  pending,
  onSave,
}: {
  item: AgendaRow;
  data: LeadershipData;
  pending: boolean;
  onSave: (command: MeetingCommand) => Promise<boolean>;
}) {
  const [mode, setMode] = useState("new"),
    [title, setTitle] = useState(""),
    [assignee, setAssignee] = useState("none"),
    [taskId, setTaskId] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          mode === "new"
            ? {
                kind: "task",
                itemId: item.id,
                title,
                assignedUserId: assignee === "none" ? null : assignee,
                requestId,
              }
            : { kind: "link", itemId: item.id, taskId },
        ).then((saved) => {
          if (saved) {
            setTitle("");
            setTaskId("");
            setRequestId(crypto.randomUUID());
          }
        });
      }}
    >
      <FieldSet disabled={pending}>
        <ChoiceField
          id="task-mode"
          label="Task"
          value={mode}
          onChange={setMode}
          options={[
            { value: "new", label: "Create follow-up task" },
            { value: "existing", label: "Link existing task" },
          ]}
        />
        {mode === "new" ? (
          <>
            <Field>
              <FieldLabel htmlFor="followup-title">Action to take</FieldLabel>
              <Input
                id="followup-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <ChoiceField
              id="followup-assignee"
              label="Assigned to"
              value={assignee}
              onChange={setAssignee}
              options={[
                { value: "none", label: "Unassigned" },
                ...data.users.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </>
        ) : (
          <ChoiceField
            id="followup-existing"
            label="Existing open task"
            value={taskId}
            onChange={setTaskId}
            options={data.tasks.map((t) => ({
              value: t.id,
              label: t.title || "Untitled task",
            }))}
          />
        )}
        <Button
          type="submit"
          disabled={pending || (mode === "existing" && !taskId)}
        >
          {pending ? "Saving…" : "Save task link"}
        </Button>
      </FieldSet>
    </form>
  );
}
