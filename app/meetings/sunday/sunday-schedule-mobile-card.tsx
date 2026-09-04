"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
} from "@/lib/sunday-meetings/types";
import {
  SUNDAY_MEETING_TYPE_LABELS,
  isLocalMeetingType,
} from "@/lib/sunday-meetings/types";
import { getSundayScheduleDisplayState } from "@/lib/sunday-meetings/schedule";
import { cn } from "@/lib/utils";
import { updateSundayMeetingType } from "./actions";
import {
  HymnCell,
  InformationCell,
  LeaderPicker,
  MeetingPeopleCell,
  MeetingTypePicker,
  PrayerCell,
  SpeakerCell,
  formatDate,
  speakerCount,
} from "./sunday-schedule-cells";

/** One Sunday as a card on small screens. */
export function ScheduleMobileCard({
  meeting,
  members,
  run,
  currentSunday,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  run: (action: () => Promise<unknown>, errorMessage: string) => void;
  currentSunday: string;
}) {
  const local = isLocalMeetingType(meeting.type);
  const displayState = getSundayScheduleDisplayState(meeting.type, meeting.date, currentSunday);

  return (
    <Card
      className={cn(
        displayState.hasSubtleFill && "bg-yellow-100/60 dark:bg-yellow-900/20",
        displayState.isCurrent && "font-semibold ring-2 ring-primary",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{formatDate(meeting.date)}</CardTitle>
            <CardDescription>{SUNDAY_MEETING_TYPE_LABELS[meeting.type]}</CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/meetings/sunday/leading?date=${meeting.date}`}>Lead</Link>
          </Button>
        </div>
        <MeetingTypePicker
          meeting={meeting}
          onChange={(type) => run(() => updateSundayMeetingType(meeting.id, type), "Could not update meeting type.")}
        />
      </CardHeader>
      {local && (
        <CardContent className="flex flex-col gap-4">
          <MobileEditorRow label="Leading">
            <LeaderPicker meeting={meeting} members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Organists">
            <MeetingPeopleCell meeting={meeting} role="organist" members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Music conductors">
            <MeetingPeopleCell meeting={meeting} role="music_conductor" members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Opening hymn">
            <HymnCell meeting={meeting} slot="opening_hymn" />
          </MobileEditorRow>
          <MobileEditorRow label="Sacrament hymn">
            <HymnCell meeting={meeting} slot="sacrament_hymn" />
          </MobileEditorRow>
          <MobileEditorRow label="Interlude">
            <HymnCell meeting={meeting} slot="interlude" />
          </MobileEditorRow>
          <MobileEditorRow label="Closing hymn">
            <HymnCell meeting={meeting} slot="closing_hymn" />
          </MobileEditorRow>
          <MobileEditorRow label="Information">
            <InformationCell meeting={meeting} />
          </MobileEditorRow>
          <MobileEditorRow label="Opening prayer">
            <PrayerCell meeting={meeting} slot="opening_prayer" members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Closing prayer">
            <PrayerCell meeting={meeting} slot="closing_prayer" members={members} />
          </MobileEditorRow>
          {Array.from({ length: Math.max(3, speakerCount(meeting)) }, (_, index) => (
            <MobileEditorRow key={index} label={`Speaker ${index + 1}`}>
              <SpeakerCell meeting={meeting} index={index} local members={members} />
            </MobileEditorRow>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function MobileEditorRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}
