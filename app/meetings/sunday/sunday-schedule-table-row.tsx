"use client";

import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { isLocalMeetingType } from "@/lib/sunday-meetings/types";
import { getSundayScheduleDisplayState } from "@/lib/sunday-meetings/schedule";
import { cn } from "@/lib/utils";
import { updateSundayMeetingType } from "./actions";
import {
  EmptyCell,
  HymnCell,
  InformationCell,
  LeaderPicker,
  MeetingPeopleCell,
  MeetingTypePicker,
  PrayerCell,
  SpeakerCell,
  formatDate,
} from "./sunday-schedule-cells";

/** One Sunday in the desktop schedule table. */
export function ScheduleTableRow({
  meeting,
  speakerColumns,
  members,
  run,
  currentSunday,
}: {
  meeting: SundayMeeting;
  speakerColumns: number;
  members: SundayMeetingMemberHistory[];
  run: (action: () => Promise<unknown>, errorMessage: string) => void;
  currentSunday: string;
}) {
  const local = isLocalMeetingType(meeting.type);
  const displayState = getSundayScheduleDisplayState(meeting.type, meeting.date, currentSunday);
  const rowClassName = cn(
    "group",
    displayState.hasSubtleFill &&
      "bg-yellow-100/60 hover:bg-yellow-100/60 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/20",
    displayState.isCurrent &&
      "font-semibold [&>td]:border-y-2 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:border-primary",
  );
  const dateCellClassName = cn(
    "sticky left-0 z-10 bg-background",
    displayState.hasSubtleFill
      ? "group-hover:bg-yellow-100/60 dark:group-hover:bg-yellow-900/20"
      : "group-hover:bg-muted/50",
    displayState.hasSubtleFill &&
      "bg-yellow-100/60 dark:bg-yellow-900/20",
  );

  return (
    <TableRow className={rowClassName}>
      <TableCell className={cn("font-medium", dateCellClassName)}>
        <Link
          className="underline-offset-4 hover:underline"
          href={`/meetings/sunday/leading?date=${meeting.date}`}
        >
          {formatDate(meeting.date)}
        </Link>
      </TableCell>
      <TableCell>
        <MeetingTypePicker
          meeting={meeting}
          onChange={(type) => run(() => updateSundayMeetingType(meeting.id, type), "Could not update meeting type.")}
        />
      </TableCell>
      <TableCell>
        {local ? (
          <LeaderPicker meeting={meeting} members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        {local ? (
          <MeetingPeopleCell meeting={meeting} role="organist" members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        {local ? (
          <MeetingPeopleCell meeting={meeting} role="music_conductor" members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="opening_hymn" />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="sacrament_hymn" />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="interlude" />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="closing_hymn" />
      </TableCell>
      <TableCell>
        {local ? <InformationCell meeting={meeting} /> : <EmptyCell />}
      </TableCell>
      <TableCell>
        <PrayerCell meeting={meeting} slot="opening_prayer" members={members} />
      </TableCell>
      <TableCell>
        <PrayerCell meeting={meeting} slot="closing_prayer" members={members} />
      </TableCell>
      {Array.from({ length: speakerColumns }, (_, index) => (
        <TableCell key={index}>
          <SpeakerCell
            meeting={meeting}
            index={index}
            local={local}
            members={members}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}
