"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
  SundayMeetingType,
} from "@/lib/sunday-meetings/types";
import { SUNDAY_MEETING_TYPE_LABELS, SUNDAY_MEETING_TYPES } from "@/lib/sunday-meetings/types";
import { virtualAgendaForMeeting } from "@/lib/sunday-meetings/templates";
import {
  findSlotItem,
  leaderOfMeeting,
  participantsByType,
  speakersOfMeeting,
} from "@/lib/sunday-meetings/slots";
import {
  addSundayAgendaItem,
  deleteSundayAgendaItem,
  updateSundayAgendaItem,
  updateSundayMeetingInformation,
  upsertSundaySlotItem,
} from "./actions";
import { SundayInlineHymnEditor } from "./sunday-inline-hymn-editor";
import { SundayInlinePeopleEditor } from "./sunday-inline-people-editor";
import { TextDialog } from "./sunday-text-dialog";

/**
 * The editable cells shared by the desktop schedule row and the mobile card.
 * Every cell derives its value from the meeting's ordered items via the
 * slot helpers and writes through the item-based server actions.
 */

type HymnSlot = "opening_hymn" | "sacrament_hymn" | "interlude" | "closing_hymn";
type PrayerSlot = "opening_prayer" | "closing_prayer";
type ParticipantType = "organist" | "music_conductor";

export function speakerCount(meeting: SundayMeeting): number {
  return speakersOfMeeting(meeting.items).length;
}

export function EmptyCell() {
  return <span className="text-muted-foreground">-</span>;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function MeetingTypePicker({
  meeting,
  onChange,
}: {
  meeting: SundayMeeting;
  onChange: (type: SundayMeetingType) => void;
}) {
  return (
    <Select value={meeting.type} onValueChange={(value) => onChange(value as SundayMeetingType)}>
      <SelectTrigger aria-label={`Meeting type for ${meeting.date}`} size="sm" className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SUNDAY_MEETING_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {SUNDAY_MEETING_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Leading cell: the single conducting-leader item (participants section). */
export function LeaderPicker({
  meeting,
  members,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
}) {
  const leader = leaderOfMeeting(meeting.items);
  return (
    <SundayInlinePeopleEditor
      label="Meeting leader"
      items={leader ? [leader] : []}
      members={members}
      maxPeople={1}
      onAdd={(person) => upsertSundaySlotItem(meeting.id, { type: "leader", section: "participants", person })}
      onRemove={(item) => updateSundayAgendaItem(item.id, { person: null })}
    />
  );
}

/** Organist/conductor cells: one participants item per person. */
export function MeetingPeopleCell({
  meeting,
  role,
  members,
}: {
  meeting: SundayMeeting;
  role: ParticipantType;
  members: SundayMeetingMemberHistory[];
}) {
  const label = role === "organist" ? "Organist" : "Music conductor";

  return (
    <SundayInlinePeopleEditor
      label={label}
      items={participantsByType(meeting.items, role)}
      members={members}
      onAdd={(person) => addSundayAgendaItem(meeting.id, { type: role, section: "participants", person })}
      // Delete the row directly: participant items are one-person-per-row, and
      // the auto-delete-on-null-person path could leave a role-text-only row behind.
      onRemove={(item) => deleteSundayAgendaItem(item.id)}
    />
  );
}

/**
 * Hymn cells. Empty virtual slots render an editor too — the first save
 * creates the row (upsert); clearing a number empties and removes it.
 * The interlude keeps its dual hymn-number / musical-number behavior.
 */
export function HymnCell({
  meeting,
  slot,
}: {
  meeting: SundayMeeting;
  slot: HymnSlot;
}) {
  const entry = virtualAgendaForMeeting(meeting.type).find((candidate) => candidate.slot === slot);
  if (!entry) return <EmptyCell />;
  const item = findSlotItem(meeting.items, slot);

  return (
    <SundayInlineHymnEditor
      item={item ?? null}
      allowMusicalNumber={slot === "interlude"}
      onSave={(input) =>
        item
          ? updateSundayAgendaItem(item.id, input)
          : upsertSundaySlotItem(meeting.id, { ...input, section: entry.section })
      }
    />
  );
}

export function InformationCell({ meeting }: { meeting: SundayMeeting }) {
  return (
    <TextDialog
      title="Meeting information"
      triggerLabel={meeting.information ?? "Add information"}
      initialValue={meeting.information ?? ""}
      multiline
      onSave={(value) => updateSundayMeetingInformation(meeting.id, value || null)}
    />
  );
}

/** Opening/closing prayer cells: the single prayer person of the slot section. */
export function PrayerCell({
  meeting,
  slot,
  members,
}: {
  meeting: SundayMeeting;
  slot: PrayerSlot;
  members: SundayMeetingMemberHistory[];
}) {
  const entry = virtualAgendaForMeeting(meeting.type).find((candidate) => candidate.slot === slot);
  if (!entry) return <EmptyCell />;
  const item = findSlotItem(meeting.items, slot);
  const title = slot === "opening_prayer" ? "Opening prayer" : "Closing prayer";

  return (
    <SundayInlinePeopleEditor
      items={item ? [item] : []}
      members={members}
      label={title}
      maxPeople={1}
      onAdd={(person) =>
        item
          ? updateSundayAgendaItem(item.id, { person })
          : upsertSundaySlotItem(meeting.id, { type: "prayer", section: entry.section, person })
      }
      onRemove={(removed) => updateSundayAgendaItem(removed.id, { person: null })}
    />
  );
}

/**
 * Speaker n cell: the n-th talk item in the program. Filling an empty cell
 * creates the talk; removing the person clears it (a topic-only talk row
 * stays, an empty row disappears).
 */
export function SpeakerCell({
  meeting,
  index,
  local,
  members,
}: {
  meeting: SundayMeeting;
  index: number;
  local: boolean;
  members: SundayMeetingMemberHistory[];
}) {
  if (!local || meeting.type === "childrens_sacrament_presentation") {
    return <EmptyCell />;
  }
  const talk = speakersOfMeeting(meeting.items)[index] ?? null;

  return (
    <SundayInlinePeopleEditor
      items={talk?.personNameResolved ? [talk] : []}
      members={members}
      label={`Speaker ${index + 1}`}
      maxPeople={1}
      onAdd={(person) =>
        talk
          ? updateSundayAgendaItem(talk.id, { person })
          : addSundayAgendaItem(meeting.id, { type: "talk", section: "program", person })
      }
      onRemove={(removed) => updateSundayAgendaItem(removed.id, { person: null })}
    />
  );
}
