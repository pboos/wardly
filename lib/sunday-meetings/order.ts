import type {
  SundayItemMetadata,
  SundayMeetingItemType,
  SundayMeetingSection,
} from "./types.ts";
import { SECTION_ORDER } from "./templates.ts";

export type OrderedItem = {
  id: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  orderIndex: number;
  slot?: string | null;
};

export function sortSundayItems<T extends OrderedItem>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      SECTION_ORDER[a.section] - SECTION_ORDER[b.section] ||
      a.orderIndex - b.orderIndex ||
      a.id.localeCompare(b.id),
  );
}

export function hasAdjacentConductorText(
  items: readonly OrderedItem[],
): boolean {
  const ordered = sortSundayItems(items);
  return ordered.some(
    (item, index) =>
      item.type === "conductor_text" &&
      ordered[index - 1]?.type === "conductor_text",
  );
}

function validMove<T extends OrderedItem>(items: T[]): T[] | null {
  return hasAdjacentConductorText(items) ? null : items;
}

export function renumberItems<T extends OrderedItem>(items: readonly T[]): T[] {
  const positions = new Map<SundayMeetingSection, number>();
  return items.map((item) => {
    const orderIndex = positions.get(item.section) ?? 0;
    positions.set(item.section, orderIndex + 1);
    return { ...item, orderIndex };
  });
}

export function nextPosition(
  items: readonly OrderedItem[],
  section: SundayMeetingSection,
): number {
  return (
    Math.max(
      -1,
      ...items
        .filter((item) => item.section === section)
        .map((item) => item.orderIndex),
    ) + 1
  );
}

export type SundayAgendaMove =
  | { direction: "up" | "down"; showSupportText: boolean; section?: never }
  | {
      section: SundayMeetingSection;
      showSupportText: boolean;
      direction?: never;
    };

/** Hidden conductor text travels with the following visible entry.
 * Trailing wording travels with the last entry of the section. */
function movementGroups<T extends OrderedItem>(
  items: T[],
  showSupportText: boolean,
): T[][] {
  if (showSupportText) return items.map((item) => [item]);
  const groups: T[][] = [];
  let pending: T[] = [];
  for (const item of items) {
    pending.push(item);
    if (item.type !== "conductor_text") {
      groups.push(pending);
      pending = [];
    }
  }
  if (pending.length) {
    if (groups.length) groups[groups.length - 1].push(...pending);
    else groups.push(pending);
  }
  return groups;
}

/** One shared operation for UI availability and transactional server writes. */
export function moveAgendaItems<T extends OrderedItem>(
  items: readonly T[],
  itemId: string,
  move: SundayAgendaMove,
): T[] | null {
  const ordered = sortSundayItems(items);
  const item = ordered.find((entry) => entry.id === itemId);
  if (
    !item ||
    item.section === "participants" ||
    (!move.showSupportText && item.type === "conductor_text")
  )
    return null;
  const groups = movementGroups(
    ordered.filter((entry) => entry.section === item.section),
    move.showSupportText,
  );
  const index = groups.findIndex((group) =>
    group.some((entry) => entry.id === itemId),
  );
  if (move.direction) {
    const neighbor = index + (move.direction === "up" ? -1 : 1);
    if (neighbor < 0 || neighbor >= groups.length) return null;
    [groups[index], groups[neighbor]] = [groups[neighbor], groups[index]];
    const replacement = renumberItems(groups.flat());
    return validMove(
      sortSundayItems([
        ...ordered.filter((entry) => entry.section !== item.section),
        ...replacement,
      ]),
    );
  }
  if (
    move.section === "participants" ||
    move.section === item.section ||
    groups[index].some((entry) => entry.slot)
  )
    return null;
  const moving = groups[index];
  const ids = new Set(moving.map((entry) => entry.id));
  const remaining = ordered.filter((entry) => !ids.has(entry.id));
  const start = nextPosition(remaining, move.section);
  return validMove(
    renumberItems(
      sortSundayItems([
        ...remaining,
        ...moving.map((entry, offset) => ({
          ...entry,
          section: move.section,
          orderIndex: start + offset,
        })),
      ]),
    ),
  );
}

type ItemDataShape = {
  type: SundayMeetingItemType;
  content: string | null;
  metadata: SundayItemMetadata | null;
  personMemberId: string | null;
  personName: string | null;
};

/**
 * True when a row carries no user data at all: no non-empty content, no
 * metadata values (a metadata object with only absent/undefined keys counts
 * as empty), and no person.
 */
export function isItemDataEmpty(item: ItemDataShape): boolean {
  const hasContent = Boolean(item.content?.trim());
  const hasMetadata =
    item.metadata !== null &&
    Object.values(item.metadata).some(
      (value) => value !== undefined && value !== null,
    );
  const hasPerson =
    Boolean(item.personMemberId) || Boolean(item.personName?.trim());
  return !hasContent && !hasMetadata && !hasPerson;
}

/**
 * True when the auto-delete rule applies to a row: it carries no user data
 * and is not exempt. `transition` rows are managed only explicitly, and a
 * task link counts as data — clearing a task item's person or text must not
 * silently unlink the task from the agenda.
 */
export function isAutoDeletableItem(
  item: ItemDataShape & { taskId: string | null; slot?: string | null },
): boolean {
  if (item.slot || item.type === "transition" || item.taskId) {
    return false;
  }
  return isItemDataEmpty(item);
}
