"use client";

import {
  IconChevronDown,
  IconChevronUp,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  SundayMeeting,
  SundayMeetingItem,
  SundayMeetingItemType,
  SundayMeetingMemberHistory,
  SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import { isCarryForwardEligible } from "@/lib/sunday-meetings/types";
import type { SundayVirtualSlot } from "@/lib/sunday-meetings/templates";
import {
  agendaRowItem,
  agendaRowSection,
  type SundayAgendaMove,
  type SundayAgendaRow,
} from "@/lib/sunday-meetings/agenda";
import {
  addSundayAgendaItem,
  deleteSundayAgendaItem,
  moveSundayAgendaItem,
  updateSundayAgendaItem,
  upsertSundaySlotItem,
} from "./actions";
import { HymnCell } from "./sunday-schedule-cells";
import { SundayInlineHymnEditor } from "./sunday-inline-hymn-editor";
import { SundayPersonDialog } from "./sunday-person-dialog";
import { CarryForwardButton, ItemContentDialog } from "./sunday-leading-item-dialogs";
import { ITEM_LABELS, SECTION_LABELS, SLOT_LABELS, hasSundayPerson } from "./sunday-leading-labels";

/**
 * One rendered agenda row: a bound or empty virtual slot, a persisted
 * item, or a lazy single-person editor. Transitions render as full-width
 * separators; conductor text only shows with the support text.
 */

type HymnSlotName = "opening_hymn" | "sacrament_hymn" | "interlude" | "closing_hymn";

function isHymnSlot(slot: SundayVirtualSlot): slot is HymnSlotName {
  return (
    slot === "opening_hymn" ||
    slot === "sacrament_hymn" ||
    slot === "interlude" ||
    slot === "closing_hymn"
  );
}

/** Types whose row carries one person; talk/prayer keep their history indicator. */
const PERSON_EDITORS: Partial<
  Record<SundayMeetingItemType, { title?: string; history?: "speaker" | "prayer" }>
> = {
  prayer: { history: "prayer" },
  talk: { title: "Speaker", history: "speaker" },
  sacrament_blessing: {},
  sacrament_passing: {},
  musical_number: {},
  primary_presentation: {},
  calling_sustain: {},
  calling_release: {},
  priesthood_aaronic_inform: {},
  child_naming_blessing: {},
  member_welcome: {},
  convert_confirmation: {},
  custom_program: {},
};

function personTitle(type: SundayMeetingItemType): string {
  return PERSON_EDITORS[type]?.title ?? ITEM_LABELS[type];
}

/** Dialog label of the item text; null when the type has no text editor. */
function contentLabel(type: SundayMeetingItemType): string | null {
  if (type === "talk") return "Talk topic";
  if (type === "prayer" || type === "hymn" || type === "transition") return null;
  return "Item details";
}

function rowTitle(row: SundayAgendaRow): string {
  if (row.kind === "slot") return SLOT_LABELS[row.slot];
  if (row.kind === "empty_person") return ITEM_LABELS[row.type];
  return ITEM_LABELS[row.item.type];
}

function rowDetail(row: SundayAgendaRow): string {
  const item = agendaRowItem(row);
  if (!item) {
    return row.kind === "slot" && isHymnSlot(row.slot)
      ? "No hymn selected"
      : "No details entered";
  }
  if (item.type === "hymn") {
    const hymnNumber = item.metadata?.hymnNumber;
    return hymnNumber ? `Hymn ${hymnNumber}` : "No hymn selected";
  }
  if (item.type === "musical_number") {
    return item.content || "Musical number details not entered";
  }
  return (
    item.content ||
    item.task?.title ||
    item.personNameResolved ||
    "No details entered"
  );
}

export function SundayLeadingItemRow({
  row,
  meeting,
  members,
  showSupportText,
  supportText,
  moveUp,
  moveDown,
  run,
}: {
  row: SundayAgendaRow;
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
  moveUp: SundayAgendaMove | null;
  moveDown: SundayAgendaMove | null;
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  const item = agendaRowItem(row);

  if (row.kind === "item" && row.item.type === "transition") {
    const transition = row.item;
    return (
      <li className="flex items-center gap-2 py-3" aria-label="Agenda transition">
        <Separator className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move transition earlier"
          disabled={!moveUp}
          onClick={() =>
            moveUp && run(
              () => moveSundayAgendaItem(transition.id, moveUp),
              "Could not reorder agenda.",
            )
          }
        >
          <IconChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move transition later"
          disabled={!moveDown}
          onClick={() =>
            moveDown && run(
              () => moveSundayAgendaItem(transition.id, moveDown),
              "Could not reorder agenda.",
            )
          }
        >
          <IconChevronDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete transition"
          onClick={() => run(() => deleteSundayAgendaItem(transition.id), "Could not delete transition.")}
        >
          <IconTrash />
        </Button>
      </li>
    );
  }

  if (row.kind === "item" && row.item.type === "conductor_text" && !showSupportText) {
    return null;
  }

  const title = rowTitle(row);
  const section = agendaRowSection(row);

  return (
    <li className="flex flex-col gap-2">
      {showSupportText && supportText.map((block) => (
        <p key={block.id} className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {block.text}
        </p>
      ))}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{rowDetail(row)}</CardDescription>
            </div>
            <Badge variant={row.kind === "slot" ? "outline" : "secondary"}>
              {SECTION_LABELS[section]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderEditors(row, meeting, members)}
            {item && isCarryForwardEligible(item.type) && <CarryForwardButton item={item} />}
            {row.kind === "item" && (
              <ItemRowActions item={row.item} moveUp={moveUp} moveDown={moveDown} run={run} />
            )}
          </div>
        </CardHeader>
        {item && PERSON_EDITORS[item.type] && (
          <CardContent>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{personTitle(item.type)}</span>
              <div className="flex flex-wrap gap-2">
                <ItemPersonDialog item={item} members={members} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </li>
  );
}

/** Move/delete controls of one persisted, non-slot row. */
function ItemRowActions({
  item,
  moveUp,
  moveDown,
  run,
}: {
  item: SundayMeetingItem;
  moveUp: SundayAgendaMove | null;
  moveDown: SundayAgendaMove | null;
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move agenda item earlier"
        disabled={!moveUp}
        onClick={() =>
          moveUp && run(
            () => moveSundayAgendaItem(item.id, moveUp),
            "Could not reorder agenda.",
          )
        }
      >
        <IconChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move agenda item later"
        disabled={!moveDown}
        onClick={() =>
          moveDown && run(
            () => moveSundayAgendaItem(item.id, moveDown),
            "Could not reorder agenda.",
          )
        }
      >
        <IconChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete agenda item"
        onClick={() => run(() => deleteSundayAgendaItem(item.id), "Could not delete agenda item.")}
      >
        <IconTrash />
      </Button>
    </>
  );
}

/** The person dialog of one persisted row: the person lives on the row itself. */
function ItemPersonDialog({
  item,
  members,
}: {
  item: SundayMeetingItem;
  members: SundayMeetingMemberHistory[];
}) {
  const history = PERSON_EDITORS[item.type]?.history ?? null;
  return (
    <SundayPersonDialog
      item={item}
      members={members}
      title={personTitle(item.type)}
      triggerLabel={`Assign ${personTitle(item.type).toLowerCase()}`}
      roleWithHistory={history}
      onSave={(person) => updateSundayAgendaItem(item.id, { person })}
      onDelete={() => updateSundayAgendaItem(item.id, { person: null })}
    />
  );
}

function renderEditors(
  row: SundayAgendaRow,
  meeting: SundayMeeting,
  members: SundayMeetingMemberHistory[],
): React.ReactNode {
  if (row.kind === "slot") {
    if (isHymnSlot(row.slot)) {
      return <HymnCell meeting={meeting} slot={row.slot} />;
    }
    if (row.slot === "opening_prayer" || row.slot === "closing_prayer") {
      const slotItem = row.item;
      return (
        <SundayPersonDialog
          item={slotItem}
          members={members}
          title={rowTitle(row)}
          triggerLabel={`Assign ${rowTitle(row).toLowerCase()}`}
          roleWithHistory="prayer"
          onSave={(person) =>
            slotItem
              ? updateSundayAgendaItem(slotItem.id, { person })
              : upsertSundaySlotItem(meeting.id, {
                  type: "prayer",
                  section: row.section,
                  person,
                })
          }
          onDelete={
            slotItem
              ? () => updateSundayAgendaItem(slotItem.id, { person: null })
              : undefined
          }
        />
      );
    }
    const programItem = row.item;
    return (
      <ItemContentDialog
        label="Item details"
        triggerLabel={programItem ? "Edit details" : "Add details"}
        initialValue={programItem?.content ?? ""}
        onSave={(value) =>
          programItem
            ? updateSundayAgendaItem(programItem.id, { content: value })
            : upsertSundaySlotItem(meeting.id, {
                type: "primary_presentation",
                section: row.section,
                content: value,
              })
        }
      />
    );
  }

  if (row.kind === "empty_person") {
    if (row.type === "talk") {
      return (
        <SundayPersonDialog
          item={null}
          members={members}
          title="Speaker"
          triggerLabel="Assign speaker"
          detailLabel="Talk topic"
          roleWithHistory="speaker"
          onSave={(person, topic) =>
            hasSundayPerson(person) || topic
              ? addSundayAgendaItem(meeting.id, {
                  type: "talk",
                  section: row.section,
                  person,
                  content: topic,
                }).then(() => undefined)
              : Promise.resolve()
          }
        />
      );
    }
    return (
      <SundayPersonDialog
        item={null}
        members={members}
        title={ITEM_LABELS[row.type]}
        triggerLabel="Assign person"
        onSave={(person) =>
          hasSundayPerson(person)
            ? addSundayAgendaItem(meeting.id, {
                type: row.type,
                section: row.section,
                person,
              }).then(() => undefined)
            : Promise.resolve()
        }
      />
    );
  }

  const item = row.item;
  if (item.type === "hymn") {
    return (
      <SundayInlineHymnEditor
        item={item}
        allowMusicalNumber={false}
        onSave={(input) => updateSundayAgendaItem(item.id, input)}
      />
    );
  }
  const label = contentLabel(item.type);
  return label ? (
    <ItemContentDialog
      label={label}
      triggerLabel="Edit details"
      initialValue={item.content ?? ""}
      onSave={(value) => updateSundayAgendaItem(item.id, { content: value })}
    />
  ) : null;
}
