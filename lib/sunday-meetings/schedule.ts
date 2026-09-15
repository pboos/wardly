import { isSunday } from "./calendar.ts";
import type { SundayMeetingType } from "./types.ts";

export const SUNDAY_SCHEDULE_POLICY = {
  priorLimit: 3,
  currentLimit: 12,
  cursorPageLimit: 16,
} as const;

export function getSundayScheduleDisplayState(
  type: SundayMeetingType,
  date: string,
  currentSunday: string,
) {
  return {
    isCurrent: date === currentSunday,
    hasSubtleFill: type !== "sacrament" && type !== "fast_testimony",
  } as const;
}

export function safeSundayCursor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return isSunday(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function shouldFallbackToDefaultSchedule(
  pageLength: number,
  hasPersistedMeetings: boolean,
  hasCursor: boolean,
): boolean {
  return pageLength === 0 && hasPersistedMeetings && hasCursor;
}

export function getScheduleBoundaryVisibility(
  selectedDates: readonly string[],
  earliestDate: string | null,
  latestDate: string | null,
) {
  if (selectedDates.length === 0) {
    return {
      hasEarlier: false,
      hasLater: false,
      showBefore: false,
      showAfter: false,
    } as const;
  }

  const firstDate = selectedDates[0];
  const lastDate = selectedDates.at(-1);
  const hasEarlier = Boolean(earliestDate && firstDate && earliestDate < firstDate);
  const hasLater = Boolean(latestDate && lastDate && latestDate > lastDate);

  return {
    hasEarlier,
    hasLater,
    showBefore: !hasEarlier,
    showAfter: !hasLater,
  } as const;
}
