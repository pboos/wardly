import {
  isLocalMeetingType,
  type SundayMeeting,
  type SundayMeetingItem,
  type SundayMeetingSection,
} from "./types.ts";
import {
  defaultRank,
  virtualAgendaForMeeting,
  virtualSlotType,
  type SundayVirtualAgendaEntry,
  type SundayVirtualSlot,
} from "./templates.ts";
import {
  computeMovePlan,
  RANK_STEP,
  sectionEndKey,
  sortKey,
  sortSundayItems,
  type MovePlan,
} from "./order.ts";
import { findSlotItem } from "./slots.ts";

/**
 * View model for the agenda flow of a local Sunday meeting: the virtual
 * standard slots (empty editors while no row exists) merged with the
 * persisted items in their final order. The `participants` section is
 * header context, not agenda flow, and never appears here.
 */

/** Sections the agenda flow renders, in handbook order. */
export const AGENDA_SECTIONS = [
  "opening",
  "business",
  "sacrament",
  "program",
  "closing",
] as const satisfies readonly SundayMeetingSection[];

/** Item types offered as lazy single-person editors before a row exists. */
export type SundayAgendaLazyPersonType =
  | "sacrament_blessing"
  | "sacrament_passing"
  | "talk";

export type SundayAgendaRow =
  | {
      kind: "slot";
      slot: SundayVirtualSlot;
      section: SundayMeetingSection;
      /** The persisted item backing the slot, null while the slot is empty. */
      item: SundayMeetingItem | null;
    }
  | { kind: "item"; item: SundayMeetingItem }
  | {
      kind: "empty_person";
      type: SundayAgendaLazyPersonType;
      section: SundayMeetingSection;
    };

/** The persisted item behind a row, or null for the empty editors. */
export function agendaRowItem(row: SundayAgendaRow): SundayMeetingItem | null {
  return row.kind === "item" ? row.item : row.kind === "slot" ? row.item : null;
}

export function agendaRowSection(row: SundayAgendaRow): SundayMeetingSection {
  return row.kind === "item" ? row.item.section : row.section;
}

/**
 * All agenda rows of a meeting, section by section in handbook order:
 * persisted items in final order with the empty virtual-slot editors
 * merged in at their default positions.
 */
export function buildAgendaRows(meeting: SundayMeeting): SundayAgendaRow[] {
  if (!isLocalMeetingType(meeting.type)) {
    return [];
  }
  const virtualAgenda = virtualAgendaForMeeting(meeting.type);
  const rows: SundayAgendaRow[] = [];
  for (const section of AGENDA_SECTIONS) {
    rows.push(...buildSectionRows(meeting, section, virtualAgenda));
  }
  return rows;
}

type PhantomRow = { key: number; row: SundayAgendaRow };

function buildSectionRows(
  meeting: SundayMeeting,
  section: SundayMeetingSection,
  virtualAgenda: readonly SundayVirtualAgendaEntry[],
): SundayAgendaRow[] {
  const items = sortSundayItems(
    meeting.items.filter((item) => item.section === section),
  );

  const slotByItemId = new Map<string, SundayAgendaRow>();
  const phantoms: PhantomRow[] = [];
  for (const entry of virtualAgenda) {
    if (entry.section !== section) {
      continue;
    }
    const bound = findSlotItem(meeting.items, entry.slot);
    if (bound) {
      slotByItemId.set(bound.id, {
        kind: "slot",
        slot: entry.slot,
        section,
        item: bound,
      });
    } else {
      phantoms.push({
        key: defaultRank(section, entry.type) * RANK_STEP,
        row: { kind: "slot", slot: entry.slot, section, item: null },
      });
    }
  }

  if (section === "sacrament") {
    pushSacramentPersonEditor(phantoms, meeting, "sacrament_blessing");
    pushSacramentPersonEditor(phantoms, meeting, "sacrament_passing");
  }

  phantoms.sort((left, right) => left.key - right.key);

  const rows: SundayAgendaRow[] = [];
  let nextPhantom = 0;
  for (const item of items) {
    const key = sortKey(item);
    while (nextPhantom < phantoms.length && phantoms[nextPhantom].key < key) {
      rows.push(phantoms[nextPhantom].row);
      nextPhantom += 1;
    }
    rows.push(slotByItemId.get(item.id) ?? { kind: "item", item });
  }
  for (; nextPhantom < phantoms.length; nextPhantom += 1) {
    rows.push(phantoms[nextPhantom].row);
  }

  // One trailing empty talk editor; filling it appends a new talk row.
  if (
    section === "program" &&
    meeting.type !== "childrens_sacrament_presentation"
  ) {
    rows.push({ kind: "empty_person", type: "talk", section });
  }
  return rows;
}

function pushSacramentPersonEditor(
  phantoms: PhantomRow[],
  meeting: SundayMeeting,
  type: Extract<SundayAgendaLazyPersonType, "sacrament_blessing" | "sacrament_passing">,
): void {
  const filled = meeting.items.some(
    (item) => item.section === "sacrament" && item.type === type,
  );
  if (!filled) {
    phantoms.push({
      key: defaultRank("sacrament", type) * RANK_STEP,
      row: { kind: "empty_person", type, section: "sacrament" },
    });
  }
}

/**
 * The move expressed as `moveSundayItem` input: moving up lands right
 * before the row above (after the nearest persisted item above it, at the
 * start of its section, or — when only empty editors are above — at the end
 * of the previous section); moving down lands after the nearest persisted
 * row below. Null when the move is not possible — the candidate position
 * cannot be represented or the item would not actually end up there.
 */
export type SundayAgendaMove =
  | { afterItemId: string; section?: undefined; position?: undefined }
  | {
      afterItemId: null;
      section: SundayMeetingSection;
      /** Where within the section a null anchor places the item. */
      position?: "start" | "end";
    };

export function agendaMoveTarget(
  rows: readonly SundayAgendaRow[],
  itemId: string,
  direction: "up" | "down",
): SundayAgendaMove | null {
  const index = rows.findIndex((row) => agendaRowItem(row)?.id === itemId);
  if (index < 0) {
    return null;
  }

  let candidate: SundayAgendaMove | null = null;
  if (direction === "up") {
    if (index === 0) {
      return null;
    }
    const anchor = nearestPersistedItem(rows, index - 2, "backwards");
    const above = rows[index - 1];
    if (anchor) {
      candidate = { afterItemId: anchor.id };
    } else if (agendaRowItem(above)) {
      // Only a phantom-editor gap below the persisted row directly above:
      // swap with it by landing at the start of its section.
      candidate = { afterItemId: null, section: agendaRowSection(above) };
    } else if (agendaRowSection(above) !== agendaRowSection(rows[index])) {
      // First row of a section with only empty editors above: land at the
      // end of the previous section so the move tracks the visual row.
      candidate = {
        afterItemId: null,
        section: agendaRowSection(above),
        position: "end",
      };
    } else {
      candidate = { afterItemId: null, section: agendaRowSection(above) };
    }
  } else {
    const below = nearestPersistedItem(rows, index + 1, "forwards");
    if (!below) {
      return null;
    }
    candidate = { afterItemId: below.id };
  }

  // Simulate the move: only offer it when it achieves the intended landing.
  const items = rows
    .map((row) => agendaRowItem(row))
    .filter((item): item is SundayMeetingItem => item !== null);
  const moved = items.find((item) => item.id === itemId);
  if (!moved) {
    return null;
  }
  const targetSection = candidate.afterItemId
    ? (items.find((item) => item.id === candidate.afterItemId)?.section ?? null)
    : candidate.section;
  if (!targetSection) {
    return null;
  }

  let plan: MovePlan | null;
  let landing: "afterAnchor" | "sectionStart" | "sectionEnd";
  if (candidate.afterItemId) {
    plan = computeMovePlan(
      items,
      itemId,
      candidate.afterItemId,
      targetSection,
    );
    landing = "afterAnchor";
  } else if (candidate.position === "end") {
    plan = {
      orderIndex: sectionEndKey(items, targetSection, phantomRowKeys(rows, targetSection)),
      rekeys: [],
    };
    landing = "sectionEnd";
  } else {
    plan = computeMovePlan(items, itemId, null, targetSection);
    landing = "sectionStart";
  }
  if (!plan) {
    return null;
  }

  const rekeyById = new Map(
    plan.rekeys.map((rekey) => [rekey.id, rekey.orderIndex]),
  );
  const simulated = sortSundayItems([
    ...items
      .filter((item) => item.id !== itemId)
      .map((item) => {
        const rekey = rekeyById.get(item.id);
        return rekey === undefined ? item : { ...item, orderIndex: rekey };
      }),
    { ...moved, section: targetSection, orderIndex: plan.orderIndex },
  ]);
  const finalIndex = simulated.findIndex((item) => item.id === itemId);
  if (landing === "afterAnchor") {
    const anchorIndex = simulated.findIndex(
      (item) => item.id === candidate.afterItemId,
    );
    if (finalIndex !== anchorIndex + 1) {
      return null;
    }
  } else if (landing === "sectionStart") {
    if (finalIndex !== 0) {
      return null;
    }
  } else {
    const lastInSection = [...simulated]
      .reverse()
      .find((item) => item.section === targetSection);
    if (lastInSection?.id !== itemId) {
      return null;
    }
  }
  return candidate;
}

/** Default sort keys of the empty-editor (phantom) rows of a section. */
function phantomRowKeys(
  rows: readonly SundayAgendaRow[],
  section: SundayMeetingSection,
): number[] {
  const keys: number[] = [];
  for (const row of rows) {
    if (agendaRowItem(row) !== null || agendaRowSection(row) !== section) {
      continue;
    }
    if (row.kind === "slot") {
      keys.push(
        defaultRank(row.section, virtualSlotType(row.slot)) * RANK_STEP,
      );
    } else if (row.kind === "empty_person") {
      keys.push(defaultRank(row.section, row.type) * RANK_STEP);
    }
  }
  return keys;
}

function nearestPersistedItem(
  rows: readonly SundayAgendaRow[],
  start: number,
  direction: "backwards" | "forwards",
): SundayMeetingItem | null {
  if (direction === "backwards") {
    for (let index = Math.min(start, rows.length - 1); index >= 0; index -= 1) {
      const item = agendaRowItem(rows[index]);
      if (item) {
        return item;
      }
    }
  } else {
    for (let index = Math.max(start, 0); index < rows.length; index += 1) {
      const item = agendaRowItem(rows[index]);
      if (item) {
        return item;
      }
    }
  }
  return null;
}
