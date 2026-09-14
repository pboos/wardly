"use client";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SundayMeetingItem,
  SundayMeetingSection,
} from "@/lib/sunday-meetings/types";
import {
  AGENDA_SECTIONS,
  type SundayAgendaMove,
} from "@/lib/sunday-meetings/agenda";
import { deleteSundayAgendaItem, moveSundayAgendaItem } from "./actions";
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
  function move(input: SundayAgendaMove) {
    run(
      () => moveSundayAgendaItem(item.id, input),
      "Could not reorder agenda.",
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
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
        <>
          <Select
            value=""
            disabled={pending}
            onValueChange={(section) =>
              move({
                section: section as SundayMeetingSection,
                showSupportText,
              })
            }
          >
            <SelectTrigger aria-label="Move to section" size="sm">
              <SelectValue placeholder="Move to section" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {AGENDA_SECTIONS.filter(
                  (section) => section !== item.section,
                ).map((section) => (
                  <SelectItem key={section} value={section}>
                    {SECTION_LABELS[section]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete agenda item"
            disabled={pending}
            onClick={() =>
              run(
                () => deleteSundayAgendaItem(item.id),
                "Could not delete agenda item.",
              )
            }
          >
            <IconTrash />
          </Button>
        </>
      )}
    </div>
  );
}
