import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  buildSundayAssignmentHistoryRows,
  type SundayAssignmentKind,
} from "@/lib/sunday-meetings/history";
import type { SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";

export function SundayAssignmentHistoryList({
  members,
  kind,
  includeNeverAssigned,
  today,
}: {
  members: SundayMeetingMemberHistory[];
  kind: SundayAssignmentKind;
  includeNeverAssigned: boolean;
  today: string;
}) {
  const rows = buildSundayAssignmentHistoryRows(
    members,
    kind,
    includeNeverAssigned,
  );
  const title = kind === "prayer" ? "Prayers" : "Talks";

  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h2 className="font-medium">
        {title} ({rows.length})
      </h2>
      {rows.length ? (
        <ol className="flex flex-col divide-y">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                {row.name}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {row.latest ? (
                  <>
                    <time dateTime={row.latest.date}>
                      {formatDate(row.latest.date)}
                    </time>
                    {row.latest.date >= today && (
                      <Badge variant="secondary">Upcoming</Badge>
                    )}
                  </>
                ) : (
                  "Never recorded"
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Alert>
          <AlertTitle>No members to show</AlertTitle>
          <AlertDescription>
              {includeNeverAssigned
                ? "No eligible current members."
                : `No eligible members have recorded ${kind} assignments.`}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
