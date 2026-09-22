"use client";
import {
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isCarryForwardEligible,
  type SundayMeetingItem,
} from "@/lib/sunday-meetings/types";
import { CarryForwardButton } from "./sunday-carry-forward-button";
import {
  AGENDA_SECTIONS,
  type SundayAgendaMove,
} from "@/lib/sunday-meetings/agenda";
import {
  deleteSundayAgendaItem as deleteSundayAgendaItemAction,
  moveSundayAgendaItem as moveSundayAgendaItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import { SECTION_LABELS } from "./sunday-leading-labels";
import type { SundayMutationRunner } from "./use-sunday-mutation";

export function SundayItemActions({
  item,
  moveUp,
  moveDown,
  showSupportText,
  pending,
  run,
}: {
  item: SundayMeetingItem;
  moveUp: SundayAgendaMove | null;
  moveDown: SundayAgendaMove | null;
  showSupportText: boolean;
  pending: boolean;
  run: SundayMutationRunner;
}) {
  const { execute: deleteSundayAgendaItem } = useAppMutation(
    deleteSundayAgendaItemAction,
  );
  const { execute: moveSundayAgendaItem } = useAppMutation(
    moveSundayAgendaItemAction,
  );

  function move(input: SundayAgendaMove) {
    run(
      () => moveSundayAgendaItem(item.id, input),
      "Could not reorder agenda.",
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {isCarryForwardEligible(item.type) && (
        <CarryForwardButton item={item} disabled={pending} />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move agenda item earlier"
        disabled={pending || !moveUp}
        onClick={() => moveUp && move(moveUp)}
      >
        <IconChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move agenda item later"
        disabled={pending || !moveDown}
        onClick={() => moveDown && move(moveDown)}
      >
        <IconChevronDown />
      </Button>
      {!item.slot && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label="More agenda item actions"
            >
              <IconDots />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to section</DropdownMenuLabel>
            <DropdownMenuGroup>
              {AGENDA_SECTIONS.filter(
                (section) => section !== item.section,
              ).map((section) => (
                <DropdownMenuItem
                  key={section}
                  disabled={pending}
                  onSelect={() => move({ section, showSupportText })}
                >
                  {SECTION_LABELS[section]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onSelect={() =>
                  run(
                    () => deleteSundayAgendaItem(item.id),
                    "Could not delete agenda item.",
                  )
                }
              >
                <IconTrash /> Delete agenda item
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
