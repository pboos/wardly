import type {
  SundayItemMetadata,
  SundayMeetingItemType,
  SundayMeetingSection,
} from "./types.ts";
import { SECTION_ORDER, defaultRank } from "./templates.ts";

/** Multiplier applied to the default rank to compute the default sort key. */
export const RANK_STEP = 100;

type SortableItem = {
  id: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  orderIndex: number | null;
  createdAt: string;
};

/** Effective sort key: the manual override or the default rank position. */
export function sortKey(item: {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  orderIndex: number | null;
}): number {
  return item.orderIndex ?? defaultRank(item.section, item.type) * RANK_STEP;
}

/** Final item order: section, sort key, creation time, then id (deterministic). */
export function sortSundayItems<T extends SortableItem>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      SECTION_ORDER[left.section] - SECTION_ORDER[right.section] ||
      sortKey(left) - sortKey(right) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

/**
 * The placement for a move (or insertion): the new `order_index` for the
 * moved item plus the local re-keys needed to keep a tied neighbour block
 * after it, in their current relative order.
 */
export type MovePlan = {
  orderIndex: number;
  rekeys: { id: string; orderIndex: number }[];
};

/**
 * The `order_index` that places `movedItemId` right after the item with id
 * `afterItemId` within `targetSection` (`null` = the section's start).
 * `movedItemId` may be null when a brand-new item is being inserted.
 *
 * When the anchor's next same-section neighbour shares the anchor's sort
 * key (a tie group, e.g. several talks at the default position), the tied
 * items that must stay after the moved item are re-keyed locally — spread
 * evenly between the anchor's key and the next distinct key (or +1 steps at
 * the section's end) — so "right after the anchor" is always representable
 * without renumbering anything else. Returns null when the position cannot
 * be represented (unknown anchor or float degeneracy).
 */
export function computeMovePlan<T extends SortableItem>(
  items: readonly T[],
  movedItemId: string | null,
  afterItemId: string | null,
  targetSection: SundayMeetingSection,
): MovePlan | null {
  const sectionItems = sortSundayItems(
    items.filter(
      (item) => item.section === targetSection && item.id !== movedItemId,
    ),
  );

  if (afterItemId === null) {
    const first = sectionItems[0];
    return { orderIndex: first ? sortKey(first) - 1 : -1, rekeys: [] };
  }

  const anchorIndex = sectionItems.findIndex((item) => item.id === afterItemId);
  if (anchorIndex < 0) {
    return null;
  }

  const anchor = sectionItems[anchorIndex];
  const a = sortKey(anchor);
  if (anchorIndex === sectionItems.length - 1) {
    return { orderIndex: a + 1, rekeys: [] };
  }

  const next = sectionItems[anchorIndex + 1];
  const b = sortKey(next);
  if (b > a) {
    const midpoint = (a + b) / 2;
    if (midpoint <= a || midpoint >= b) {
      return null;
    }
    return { orderIndex: midpoint, rekeys: [] };
  }

  // Tie: the chain after the anchor shares the anchor's key and must stay
  // after the moved item, in its current relative order.
  const chain: T[] = [];
  for (let index = anchorIndex + 1; index < sectionItems.length; index += 1) {
    if (sortKey(sectionItems[index]) !== a) {
      break;
    }
    chain.push(sectionItems[index]);
  }
  const afterChain = sectionItems[anchorIndex + 1 + chain.length];
  const nextDistinctKey = afterChain ? sortKey(afterChain) : null;
  const step =
    nextDistinctKey !== null
      ? (nextDistinctKey - a) / (chain.length + 2)
      : 1;
  if (step <= 0 || a + step <= a) {
    return null;
  }
  return {
    orderIndex: a + step,
    rekeys: chain.map((item, index) => ({
      id: item.id,
      orderIndex: a + step * (index + 2),
    })),
  };
}

/**
 * The `order_index` that lands an item at the END of a section: one past
 * the highest effective key present, including the default keys of the
 * section's virtual (empty-editor) slots passed as `phantomKeys`.
 */
export function sectionEndKey<T extends SortableItem>(
  items: readonly T[],
  section: SundayMeetingSection,
  phantomKeys: readonly number[] = [],
): number {
  let max = -1;
  for (const item of items) {
    if (item.section !== section) {
      continue;
    }
    const key = sortKey(item);
    if (key > max) {
      max = key;
    }
  }
  for (const key of phantomKeys) {
    if (key > max) {
      max = key;
    }
  }
  return max + 1;
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
  item: ItemDataShape & { taskId: string | null },
): boolean {
  if (item.type === "transition" || item.taskId) {
    return false;
  }
  return isItemDataEmpty(item);
}
