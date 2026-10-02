"use client";

import { useId, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { SundayMeetingTaskCandidateGroup } from "@/lib/sunday-meetings/types";
import { addSuggestedSundayTasks as addSuggestedSundayTasksAction } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import { SundayTaskText } from "./sunday-task-text";
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
  const { execute: addSuggestedSundayTasks } = useAppMutation(
    addSuggestedSundayTasksAction,
  );
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const tasks = groups
    .flatMap((group) => group.items)
    .filter((task) => task.scheduledMeeting?.id !== meetingId);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
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
      <div id={contentId} hidden={!expanded}>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No available tasks for this meeting.
          </p>
        ) : (
          <ul
            aria-label="Tasks available for Ward business"
            className="flex flex-col divide-y"
          >
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-2 py-1.5"
              >
                <SundayTaskText task={task} />
                {task.scheduledMeeting && (
                  <span className="text-xs text-muted-foreground">
                    Moves from {task.scheduledMeeting.date}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  aria-label={`Add task: ${task.memberName ?? task.title ?? task.typeLabel}`}
                  onClick={() =>
                    run(
                      () => addSuggestedSundayTasks(meetingId, [task.id]),
                      "Could not add task.",
                    )
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
