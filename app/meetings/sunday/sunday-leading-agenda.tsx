"use client";
import type {
  SundayMeeting,
  SundayMeetingTaskCandidateGroup,
  SundayMeetingMemberHistory,
  SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import {
  AGENDA_SECTIONS,
  agendaMoveTarget,
  buildAgendaRows,
} from "@/lib/sunday-meetings/agenda";
import { SundayBusinessTasks } from "./sunday-business-tasks";
import { SundayLeadingItemRow } from "./sunday-leading-item-row";
import { SundayAddSpeaker } from "./sunday-add-speaker";
import { AddAgendaItemDialog } from "./sunday-leading-add-item";
import { SECTION_LABELS } from "./sunday-leading-labels";
import type { SundayMutationRunner } from "./use-sunday-mutation";

export function SundayLeadingAgenda({
  meeting,
  taskCandidates,
  members,
  showSupportText,
  supportText,
  pending,
  run,
}: {
  meeting: SundayMeeting;
  taskCandidates: SundayMeetingTaskCandidateGroup[];
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
  pending: boolean;
  run: SundayMutationRunner;
}) {
  const rows = buildAgendaRows(meeting, showSupportText);
  return (
    <div className="flex flex-col gap-6" aria-busy={pending}>
      {AGENDA_SECTIONS.map((section) => (
        <section
          key={section}
          className="flex flex-col gap-3"
          aria-label={SECTION_LABELS[section]}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-medium">{SECTION_LABELS[section]}</h3>
            <AddAgendaItemDialog
              meeting={meeting}
              section={section}
              disabled={pending}
            />
          </div>
          <ol className="flex flex-col gap-2">
            {rows
              .filter((row) => row.item.section === section)
              .map(({ item, people }) => (
                <SundayLeadingItemRow
                  key={item.id}
                  item={item}
                  people={people}
                  members={members}
                  showSupportText={showSupportText}
                  supportText={supportText.filter(
                    (block) => block.itemId === item.id,
                  )}
                  moveUp={agendaMoveTarget(
                    meeting.items,
                    item.id,
                    "up",
                    showSupportText,
                  )}
                  moveDown={agendaMoveTarget(
                    meeting.items,
                    item.id,
                    "down",
                    showSupportText,
                  )}
                  pending={pending}
                  run={run}
                />
              ))}
          </ol>
          {section === "business" && (
            <SundayBusinessTasks
              key={meeting.id}
              groups={taskCandidates}
              meetingId={meeting.id}
              pending={pending}
              run={run}
            />
          )}
          {section === "program" &&
            meeting.type !== "childrens_sacrament_presentation" && (
              <div>
                <SundayAddSpeaker meetingId={meeting.id} members={members} />
              </div>
            )}
        </section>
      ))}
    </div>
  );
}
