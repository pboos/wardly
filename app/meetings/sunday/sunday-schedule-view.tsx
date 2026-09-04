"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import {
  addSundayMeetingAfterLatest,
  addSundayMeetingBeforeEarliest,
  bootstrapSundaySchedule,
} from "./actions";
import { formatDate, speakerCount } from "./sunday-schedule-cells";
import { ScheduleMobileCard } from "./sunday-schedule-mobile-card";
import { ScheduleTableRow } from "./sunday-schedule-table-row";
import { SundayScheduleBoundaryAction } from "./sunday-schedule-boundary-action";
import { SundaySettingsDialog } from "./sunday-settings-dialog";

type ScheduleData = {
  currentSunday: string;
  range: { start: string; end: string };
  contentLocale: string;
  timeZone: string;
  rows: SundayMeeting[];
  hasEarlier: boolean;
  hasLater: boolean;
  showBefore: boolean;
  showAfter: boolean;
  earlierCursor: string;
  laterCursor: string;
};

export function SundayScheduleView({
  schedule,
  members,
}: {
  schedule: ScheduleData;
  members: SundayMeetingMemberHistory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const speakerColumns = Math.max(
    3,
    ...schedule.rows.map(speakerCount),
  );

  function run(action: () => Promise<unknown>, errorMessage: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : errorMessage, {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Sunday sacrament meeting
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(schedule.range.start)} to {formatDate(schedule.range.end)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schedule.hasEarlier && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/meetings/sunday?before=${schedule.earlierCursor}`}>
                <IconArrowLeft data-icon="inline-start" />
                Earlier
              </Link>
            </Button>
          )}
          {schedule.hasLater && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/meetings/sunday?after=${schedule.laterCursor}`}>
                Later
                <IconArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
          <SundaySettingsDialog
            contentLocale={schedule.contentLocale}
            timeZone={schedule.timeZone}
          />
          <Button size="sm" asChild>
            <Link href="/meetings/sunday/leading">
              Open leading view
              <IconChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </header>

      {schedule.rows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Sunday meetings yet</CardTitle>
            <CardDescription>
              Start the persisted schedule with the ward-local current or upcoming Sunday.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => run(bootstrapSundaySchedule, "Could not start the Sunday schedule.")}>
              <IconPlus data-icon="inline-start" />
              Add current Sunday
            </Button>
          </CardContent>
        </Card>
      )}

      {schedule.rows.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-background">
                    Date
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Leading</TableHead>
                  <TableHead>Organist(s)</TableHead>
                  <TableHead>Conductor(s)</TableHead>
                  <TableHead>Opening hymn</TableHead>
                  <TableHead>Sacrament hymn</TableHead>
                  <TableHead>Interlude hymn</TableHead>
                  <TableHead>Closing hymn</TableHead>
                  <TableHead>Information</TableHead>
                  <TableHead>Opening prayer</TableHead>
                  <TableHead>Closing prayer</TableHead>
                  {Array.from({ length: speakerColumns }, (_, index) => (
                    <TableHead key={index}>Speaker {index + 1}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.showBefore && (
                  <SundayScheduleBoundaryAction
                    desktop
                    colSpan={12 + speakerColumns}
                    accessibleName="Add Sunday before the earliest meeting"
                    action={() => addSundayMeetingBeforeEarliest()}
                    run={run}
                  />
                )}
                {schedule.rows.map((row) => (
                  <ScheduleTableRow
                    key={row.id}
                    meeting={row}
                    speakerColumns={speakerColumns}
                    members={members}
                    run={run}
                    currentSunday={schedule.currentSunday}
                  />
                ))}
                {schedule.showAfter && (
                  <SundayScheduleBoundaryAction
                    desktop
                    colSpan={12 + speakerColumns}
                    accessibleName="Add Sunday after the latest meeting"
                    action={() => addSundayMeetingAfterLatest()}
                    run={run}
                  />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {schedule.showBefore && (
              <SundayScheduleBoundaryAction
                accessibleName="Add Sunday before the earliest meeting"
                action={() => addSundayMeetingBeforeEarliest()}
                run={run}
              />
            )}
            {schedule.rows.map((row) => (
              <ScheduleMobileCard
                key={row.id}
                meeting={row}
                members={members}
                run={run}
                currentSunday={schedule.currentSunday}
              />
            ))}
            {schedule.showAfter && (
              <SundayScheduleBoundaryAction
                accessibleName="Add Sunday after the latest meeting"
                action={() => addSundayMeetingAfterLatest()}
                run={run}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
