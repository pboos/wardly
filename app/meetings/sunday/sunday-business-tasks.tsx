"use client";

import { useId, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { SundayMeetingTaskCandidateGroup } from "@/lib/sunday-meetings/types";
import { addSuggestedSundayTasks } from "./actions";
import { ITEM_LABELS } from "./sunday-leading-labels";
import type { SundayMutationRunner } from "./use-sunday-mutation";

export function SundayBusinessTasks({
  groups,
  meetingId,
  pending,
  run,
}: {
  groups: SundayMeetingTaskCandidateGroup[];
  meetingId: string;
  pending: boolean;
  run: SundayMutationRunner;
}) {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const contentId = useId();
  const tasks = groups
    .flatMap((group) => group.items)
    .filter((task) => task.scheduledMeeting?.id !== meetingId);
  const selectedIds = selected.filter((id) =>
    tasks.some((task) => task.id === id),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <IconChevronDown data-icon="inline-start" />
          ) : (
            <IconChevronRight data-icon="inline-start" />
          )}
          Available tasks ({tasks.length})
        </Button>
        {expanded && tasks.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !selectedIds.length}
            onClick={() =>
              run(async () => {
                await addSuggestedSundayTasks(meetingId, selectedIds);
                setSelected([]);
              }, "Could not add tasks.")
            }
          >
            {pending
              ? "Saving…"
              : `Add selected${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
          </Button>
        )}
      </div>
      <div id={contentId} hidden={!expanded}>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No available tasks for this meeting.
          </p>
        ) : (
          <FieldSet disabled={pending}>
            <FieldLegend className="sr-only">
              Tasks available for Ward business
            </FieldLegend>
            <FieldDescription>
              Select tasks to add to this Sunday. Tasks scheduled elsewhere will
              move here.
            </FieldDescription>
            <FieldGroup>
              {tasks.map((task) => {
                const id = `${contentId}-${task.id}`;
                return (
                  <Field
                    key={task.id}
                    orientation="horizontal"
                    data-disabled={pending}
                  >
                    <Checkbox
                      id={id}
                      disabled={pending}
                      checked={selectedIds.includes(task.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked === true
                            ? [...new Set([...current, task.id])]
                            : current.filter((value) => value !== task.id),
                        )
                      }
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={id}>
                        {task.memberName ?? task.title ?? "Untitled task"}
                      </FieldLabel>
                      <FieldDescription>
                        {ITEM_LABELS[task.itemType]}
                        {task.memberName && task.title
                          ? ` · ${task.title}`
                          : ""}
                      </FieldDescription>
                      {task.scheduledMeeting && (
                        <FieldDescription>
                          Moves from {task.scheduledMeeting.date}
                        </FieldDescription>
                      )}
                    </FieldContent>
                  </Field>
                );
              })}
            </FieldGroup>
          </FieldSet>
        )}
      </div>
    </div>
  );
}
