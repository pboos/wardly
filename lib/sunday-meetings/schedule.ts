export const SUNDAY_SCHEDULE_POLICY = {
  priorLimit: 3,
  currentLimit: 12,
  cursorPageLimit: 16,
} as const;

export function safeSundayCursor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return undefined;
    return date.getUTCDay() === 0 ? value : undefined;
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
