"use client";

import { useSundayMutation } from "./use-sunday-mutation";

import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SUNDAY_MEETING_TYPE_LABELS } from "@/lib/sunday-meetings/types";
import { nextSunday, previousSunday } from "@/lib/sunday-meetings/calendar";
import type { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";
import { SundayLeadingAgenda } from "./sunday-leading-agenda";
import { SundayLeadingParticipants } from "./sunday-leading-participants";
import { SundayAssignmentHistoryDialog } from "./sunday-assignment-history-dialog";

type LeadingData = Awaited<ReturnType<typeof loadLeadingSundayMeeting>>;

export function SundayLeadingView({ data }: { data: LeadingData }) {
  const { meeting } = data;
  const { pending, run } = useSundayMutation();
  const previousDate = previousSunday(meeting.date);
  const nextDate = nextSunday(meeting.date);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/${previousDate}`}>
              <IconArrowLeft data-icon="inline-start" />
              Previous Sunday
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/${nextDate}`}>
              Next Sunday
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {formatDate(meeting.date)}
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SundayAssignmentHistoryDialog
            members={data.memberHistory}
            today={data.today}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/${meeting.date}/leading`}>Leading mode</Link>
          </Button>
        </div>
      </header>

      {!data.isLocal ? (
        <Alert>
          <AlertTitle>No local agenda</AlertTitle>
          <AlertDescription>
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]} is recorded as a date and
            type only.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!data.isReadyToLead && (
            <Alert>
              <AlertTitle>Choose a meeting leader</AlertTitle>
              <AlertDescription>
                A local meeting needs one leader before it is ready to lead.
              </AlertDescription>
            </Alert>
          )}

          <SundayLeadingParticipants
            meeting={meeting}
            members={data.memberHistory}
            showSupportText={true}
            supportText={[]}
          />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Agenda</h2>
            <SundayLeadingAgenda
              taskCandidates={data.taskCandidates}
              pending={pending}
              meeting={meeting}
              members={data.memberHistory}
              showSupportText={true}
              supportText={[]}
              run={run}
            />
          </section>
        </>
      )}
    </div>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
