import type {
  SundayMeeting,
  SundayMeetingItem,
  SundayMeetingSupportText,
} from "./types.ts";

/**
 * The presider is the person on the meeting's single `presiding` item
 * (participants section). Returns null when the meeting has none.
 */
export function resolvePresider(meeting: SundayMeeting): SundayMeetingItem | null {
  return meeting.items.find((item) => item.type === "presiding") ?? null;
}

function wordingForItem(item: SundayMeetingItem): string | null {
  const subject = item.personNameResolved;
  const detail = item.content?.trim() || item.task?.title?.trim() || null;

  switch (item.type) {
    case "calling_sustain":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for ${detail}` : " for sustaining"}.`;
    case "calling_release":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for release from ${detail}` : " for release"}.`;
    case "priesthood_aaronic_inform":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for ${detail}` : " for Aaronic Priesthood information"}.`;
    case "child_naming_blessing":
      return `Placeholder: name and bless ${subject ?? "the child"}${detail ? ` (${detail})` : ""}.`;
    case "member_welcome":
      return `Placeholder: welcome ${subject ?? "the new member"} to the ward.`;
    case "convert_confirmation":
      return `Placeholder: confirm ${subject ?? "the new convert"}.`;
    default:
      return null;
  }
}

function describeVisitor(visitor: SundayMeetingItem): string {
  const role = visitor.content?.trim();
  const name = visitor.personNameResolved ?? "visitor";
  return role ? `${name} (${role})` : name;
}

export function generateSupportText(
  meeting: SundayMeeting,
  contentLocale: string,
): SundayMeetingSupportText[] {
  // TODO: Load these wording templates from ward-language assets by locale.
  void contentLocale;

  const blocks: SundayMeetingSupportText[] = [];

  const visitors = meeting.items.filter((item) => item.type === "visitor");
  if (visitors.length > 0) {
    blocks.push({
      id: "visitor-welcome",
      position: "meeting",
      itemId: null,
      text: `Placeholder: welcome ${visitors.map(describeVisitor).join(", ")}.`,
    });
  }

  const presider = meeting.presider;
  if (presider) {
    blocks.push({
      id: "presiding-authority",
      position: "meeting",
      itemId: null,
      text: `Placeholder: acknowledge ${presider.personNameResolved ?? "the presiding authority"} as presiding.`,
    });
  }

  for (const item of meeting.items) {
    const text = wordingForItem(item);
    if (text) {
      blocks.push({
        id: `item-${item.id}`,
        position: "before_item",
        itemId: item.id,
        text,
      });
    }
  }

  return blocks;
}
