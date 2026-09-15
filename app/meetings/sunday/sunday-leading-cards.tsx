"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";

export function AssignmentHistoryCard({
  members,
}: {
  members: SundayMeetingMemberHistory[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment history</CardTitle>
        <CardDescription>
          Members with the oldest or no past talk/prayer assignment appear
          first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-sm text-muted-foreground">
                Talk: {member.lastTalk?.date ?? "Never"} | Prayer:{" "}
                {member.lastPrayer?.date ?? "Never"}
              </span>
              <span className="text-sm text-muted-foreground">
                Upcoming:{" "}
                {member.nextTalk?.date ?? member.nextPrayer?.date ?? "None"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
