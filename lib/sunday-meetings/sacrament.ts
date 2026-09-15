import type { SundayMeetingItemType } from "./types.ts";

export function isSacramentRole(type: SundayMeetingItemType): boolean {
  return type === "sacrament_blessing" || type === "sacrament_passing";
}

/** Group each sacrament role within its section, anchored at its standard slot. */
export function groupSacramentItems<
  T extends {
    type: SundayMeetingItemType;
    section: string;
    slot?: string | null;
  },
>(items: readonly T[]): T[][] {
  const groups: T[][] = [];
  const seen = new Set<T>();
  for (const item of items) {
    if (seen.has(item)) continue;
    if (!isSacramentRole(item.type)) {
      groups.push([item]);
      continue;
    }
    const peers = items.filter(
      (other) => other.type === item.type && other.section === item.section,
    );
    const anchor = peers.find((other) => other.slot) ?? peers[0];
    if (item !== anchor) continue;
    const group = [anchor, ...peers.filter((other) => other !== anchor)];
    group.forEach((other) => seen.add(other));
    groups.push(group);
  }
  return groups;
}
