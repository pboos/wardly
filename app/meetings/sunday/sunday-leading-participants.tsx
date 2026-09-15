"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
  SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import { SundayContextPeople } from "./sunday-context-people";

export function SundayLeadingParticipants({
  meeting,
  members,
  showSupportText,
  supportText,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting context</CardTitle>
        {meeting.information && (
          <CardDescription>{meeting.information}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SundayContextPeople
          meeting={meeting}
          members={members}
          type="leader"
          label="Meeting leader"
        />
        <SundayContextPeople
          meeting={meeting}
          members={members}
          type="organist"
          label="Organist"
        />
        <SundayContextPeople
          meeting={meeting}
          members={members}
          type="music_conductor"
          label="Music conductor"
        />
        <SundayContextPeople
          meeting={meeting}
          members={members}
          type="visitor"
          label="Visitor"
        />
        <SundayContextPeople
          meeting={meeting}
          members={members}
          type="presiding"
          label="Presiding"
        />
        {showSupportText && supportText.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {supportText.map((block) => (
              <p key={block.id}>{block.text}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
