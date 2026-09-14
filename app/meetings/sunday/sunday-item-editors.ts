import type { SundayMeetingItemType } from "@/lib/sunday-meetings/types";
import { ITEM_LABELS } from "./sunday-leading-labels";

/** Types whose row carries one person; talk/prayer keep their history indicator. */
export const PERSON_EDITORS: Partial<
  Record<
    SundayMeetingItemType,
    { title?: string; history?: "speaker" | "prayer" }
  >
> = {
  prayer: { history: "prayer" },
  talk: { title: "Speaker", history: "speaker" },
  sacrament_blessing: {},
  sacrament_passing: {},
  primary_presentation: {},
  calling_sustain: {},
  calling_release: {},
  priesthood_aaronic_inform: {},
  child_naming_blessing: {},
  member_welcome: {},
  convert_confirmation: {},
  custom_program: {},
};

export function personTitle(type: SundayMeetingItemType): string {
  return PERSON_EDITORS[type]?.title ?? ITEM_LABELS[type];
}

/** Dialog label of the item text; null when the type has no text editor. */
export function contentLabel(type: SundayMeetingItemType): string | null {
  if (type === "talk") return "Talk topic";
  if (
    [
      "prayer",
      "hymn",
      "transition",
      "convert_confirmation",
      "member_welcome",
      "child_naming_blessing",
    ].includes(type)
  )
    return null;
  if (type === "ward_business" || type === "conductor_text")
    return ITEM_LABELS[type];
  return "Item details";
}
