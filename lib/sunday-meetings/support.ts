import type {
  HymnReference,
  SundayMeeting,
  SundayMeetingAssignment,
  SundayMeetingItem,
  SundayMeetingSupportText,
} from "./types";

export function resolvePresider(
  assignments: SundayMeetingAssignment[],
): SundayMeetingAssignment | null {
  // Product decision: visitor roles never imply presiding without an override.
  return (
    assignments.find(
      (assignment) =>
        assignment.role === "visitor" && assignment.isPresidingOverride,
    ) ?? null
  );
}

export function resolveHymn(
  number: number | null,
  contentLocale: string,
): HymnReference {
  // TODO: Replace this placeholder with ward-language JSON hymn catalogs.
  void contentLocale;
  return {
    number,
    title: number === null ? null : `Hymn ${number}`,
    text: null,
  };
}

function namesFor(
  item: SundayMeetingItem,
  roles: readonly string[],
): string | null {
  const names = item.assignments
    .filter((assignment) => roles.includes(assignment.role))
    .map((assignment) => assignment.name);
  return names.length > 0 ? names.join(", ") : null;
}

function wordingForItem(item: SundayMeetingItem): string | null {
  const subject = namesFor(item, ["subject"]);
  const detail = item.content?.trim() || item.task?.title?.trim() || null;

  switch (item.type) {
    case "calling_sustain":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for ${detail}` : " for sustaining"}.`;
    case "calling_release":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for release from ${detail}` : " for release"}.`;
    case "priesthood_aaronic_inform":
      return `Placeholder: present ${subject ?? "the member"}${detail ? ` for ${detail}` : " for Aaronic Priesthood information"}.`;
    case "child_naming_blessing":
      return `Placeholder: invite ${namesFor(item, ["officiant"]) ?? "the officiant"} to name and bless ${subject ?? "the child"}.`;
    case "member_welcome":
      return `Placeholder: welcome ${subject ?? "the new member"} to the ward.`;
    case "convert_confirmation":
      return `Placeholder: invite ${namesFor(item, ["officiant"]) ?? "the officiant"} to confirm ${subject ?? "the new convert"}.`;
    default:
      return null;
  }
}

export function generateSupportText(
  meeting: SundayMeeting,
  contentLocale: string,
): SundayMeetingSupportText[] {
  // TODO: Load these wording templates from ward-language assets by locale.
  void contentLocale;

  const blocks: SundayMeetingSupportText[] = [];
  const visitors = meeting.assignments.filter(
    (assignment) => assignment.role === "visitor",
  );
  if (visitors.length > 0) {
    blocks.push({
      id: "visitor-welcome",
      position: "meeting",
      itemId: null,
      text: `Placeholder: welcome ${visitors.map((visitor) => visitor.name).join(", ")}.`,
    });
  }

  if (meeting.presider) {
    blocks.push({
      id: "presiding-authority",
      position: "meeting",
      itemId: null,
      text: `Placeholder: acknowledge ${meeting.presider.name} as presiding.`,
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
