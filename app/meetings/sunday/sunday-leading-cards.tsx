"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  SundayMeetingMemberHistory,
  SundayMeetingTaskCandidateGroup,
} from "@/lib/sunday-meetings/types";
import { addSuggestedSundayTask } from "./actions";
import { ITEM_LABELS } from "./sunday-leading-labels";

/** Static cards below the agenda: task candidates and member history. */

export function SuggestedTasksCard({
  groups,
  meetingId,
  run,
}: {
  groups: SundayMeetingTaskCandidateGroup[];
  meetingId: string;
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested task presentations</CardTitle>
        <CardDescription>
          Tasks stay linked after they are placed on this agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.itemType} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{ITEM_LABELS[group.itemType]}</p>
            {group.items.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{task.memberName ?? task.title ?? "Untitled task"}</span>
                  {task.title && task.memberName && <span className="text-sm text-muted-foreground">{task.title}</span>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => run(() => addSuggestedSundayTask(meetingId, task.id), "Could not add task item.")}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AssignmentHistoryCard({ members }: { members: SundayMeetingMemberHistory[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment history</CardTitle>
        <CardDescription>
          Members with the oldest or no past talk/prayer assignment appear first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-sm text-muted-foreground">
                Talk: {member.lastTalk?.date ?? "Never"} | Prayer: {member.lastPrayer?.date ?? "Never"}
              </span>
              <span className="text-sm text-muted-foreground">
                Upcoming: {member.nextTalk?.date ?? member.nextPrayer?.date ?? "None"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
