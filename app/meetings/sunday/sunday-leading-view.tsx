"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SUNDAY_MEETING_TYPE_LABELS } from "@/lib/sunday-meetings/types";
import { nextSunday, previousSunday } from "@/lib/sunday-meetings/calendar";
import type { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";
import { AddAgendaItemDialog } from "./sunday-leading-add-item";
import {
  AssignmentHistoryCard,
  SuggestedTasksCard,
} from "./sunday-leading-cards";
import { SundayLeadingAgenda } from "./sunday-leading-agenda";
import { SundayLeadingParticipants } from "./sunday-leading-participants";

type LeadingData = Awaited<ReturnType<typeof loadLeadingSundayMeeting>>;

export function SundayLeadingView({ data }: { data: LeadingData }) {
  const { meeting } = data;
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The agreed leading default keeps supporting wording out of the way.
  const [showSupportText, setShowSupportText] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function run(action: () => Promise<unknown>, fallback: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallback, {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  const previousDate = previousSunday(meeting.date);
  const nextDate = nextSunday(meeting.date);
  const meetingSupport = data.supportText.filter(
    (block) => block.position === "meeting",
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/leading?date=${previousDate}`}>
              <IconArrowLeft data-icon="inline-start" />
              Previous Sunday
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/leading?date=${nextDate}`}>
              Next Sunday
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{formatDate(meeting.date)}</p>
          <h1 className="text-2xl font-semibold text-foreground">
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showSupportText}
            onClick={() => setShowSupportText((current) => !current)}
          >
            {showSupportText ? (
              <IconEyeOff data-icon="inline-start" />
            ) : (
              <IconEye data-icon="inline-start" />
            )}
            {showSupportText ? "Hide support text" : "Show support text"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "Hide assignment history" : "Show assignment history"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday?anchor=${meeting.date}`}>Schedule</Link>
          </Button>
        </div>
      </header>

      {!data.isLocal ? (
        <Alert>
          <AlertTitle>No local agenda</AlertTitle>
          <AlertDescription>
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]} is recorded as a date and type only.
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
            showSupportText={showSupportText}
            supportText={meetingSupport}
          />

          {showHistory && <AssignmentHistoryCard members={data.memberHistory} />}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Agenda</h2>
              <AddAgendaItemDialog meeting={meeting} />
            </div>
            <SundayLeadingAgenda
              meeting={meeting}
              members={data.memberHistory}
              showSupportText={showSupportText}
              supportText={data.supportText.filter(
                (block) => block.position === "before_item",
              )}
              run={run}
            />
          </section>

          <SuggestedTasksCard
            groups={data.taskCandidates}
            meetingId={meeting.id}
            run={run}
          />
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
