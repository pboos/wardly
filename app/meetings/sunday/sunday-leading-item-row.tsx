"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  isCarryForwardEligible,
  type SundayMeetingItem,
  type SundayMeetingMemberHistory,
  type SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import type { SundayAgendaMove } from "@/lib/sunday-meetings/agenda";
import { CarryForwardButton } from "./sunday-carry-forward-button";
import { ITEM_LABELS, SLOT_LABELS } from "./sunday-leading-labels";
import { PERSON_EDITORS, personTitle } from "./sunday-item-editors";
import { SundayItemPersonEditor } from "./sunday-item-person-editor";
import { SundayItemContentEditor } from "./sunday-item-content-editor";
import { SundayItemActions } from "./sunday-item-actions";
import type { SundayMutationRunner } from "./use-sunday-mutation";

export function SundayLeadingItemRow({
  item,
  members,
  showSupportText,
  supportText,
  moveUp,
  moveDown,
  pending,
  run,
}: {
  item: SundayMeetingItem;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
  moveUp: SundayAgendaMove | null;
  moveDown: SundayAgendaMove | null;
  pending: boolean;
  run: SundayMutationRunner;
}) {
  const actions = (
    <SundayItemActions
      item={item}
      moveUp={moveUp}
      moveDown={moveDown}
      showSupportText={showSupportText}
      pending={pending}
      run={run}
    />
  );
  if (item.type === "transition") {
    return (
      <li
        className="flex flex-wrap items-center gap-2 py-3"
        aria-label="Agenda transition"
      >
        <Separator className="flex-1" />
        {actions}
      </li>
    );
  }
  const detail =
    item.type === "hymn"
      ? item.metadata?.hymnNumber
        ? `Hymn ${item.metadata.hymnNumber}`
        : "No hymn selected"
      : item.content ||
        item.task?.title ||
        item.personNameResolved ||
        "No details entered";
  return (
    <li className="flex flex-col gap-2">
      {showSupportText &&
        supportText.map((block) => (
          <p
            key={block.id}
            className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {block.text}
          </p>
        ))}
      <Card>
        <CardHeader className="gap-3">
          <CardTitle>
            {item.slot ? SLOT_LABELS[item.slot] : ITEM_LABELS[item.type]}
          </CardTitle>
          <CardDescription>{detail}</CardDescription>
          <div className="flex flex-wrap items-center gap-2">
            <SundayItemContentEditor item={item} />
            {isCarryForwardEligible(item.type) && (
              <CarryForwardButton item={item} />
            )}
            {actions}
          </div>
        </CardHeader>
        {PERSON_EDITORS[item.type] && (
          <CardContent>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {personTitle(item.type)}
              </span>
              <div className="flex flex-wrap gap-2">
                <SundayItemPersonEditor item={item} members={members} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </li>
  );
}
