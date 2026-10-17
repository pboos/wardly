"use client";
import { FieldDescription, FieldGroup, FieldSet } from "@/components/ui/field";
import type {
  AgendaRow,
  LeadershipData,
} from "@/lib/leadership-meetings/loaders";
import type { MeetingCommand } from "@/lib/leadership-meetings/types";
import { ChoiceField } from "./choice-field";
export function DiscussionAssignment({
  item,
  data,
  editable,
  pending,
  onSave,
}: {
  item: AgendaRow;
  data: LeadershipData;
  editable: boolean;
  pending: boolean;
  onSave: (command: MeetingCommand) => Promise<boolean>;
}) {
  const defaultName =
    data.users.find((user) => user.id === item.defaultAssignedUserId)?.name ??
    "Unassigned";
  if (!editable)
    return (
      <p className="text-sm text-muted-foreground">
        Assigned to:{" "}
        {data.users.find((user) => user.id === item.assignedUserId)?.name ??
          "Unassigned"}
      </p>
    );
  return (
    <FieldSet disabled={pending}>
      <FieldGroup>
        <ChoiceField
          id="discussion-assignee"
          label="Assigned to"
          value={
            !item.assignmentOverridden &&
            item.assignedUserId === item.defaultAssignedUserId
              ? "default"
              : (item.assignedUserId ?? "unassigned")
          }
          onChange={(value) => {
            void onSave({
              kind: "assign",
              itemId: item.id,
              assignment:
                value === "default"
                  ? { kind: "default" }
                  : {
                      kind: "override",
                      userId: value === "unassigned" ? null : value,
                    },
            });
          }}
          options={[
            {
              value: "default",
              label: `Use ${item.repeating ? "recurring " : ""}default (${defaultName})`,
            },
            { value: "unassigned", label: "Unassigned" },
            ...data.users.map((user) => ({ value: user.id, label: user.name })),
          ]}
        />
        <FieldDescription>
          Changes apply to this discussion only.
        </FieldDescription>
      </FieldGroup>
    </FieldSet>
  );
}
