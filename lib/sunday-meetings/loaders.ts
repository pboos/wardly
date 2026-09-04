import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertSunday,
  localToday,
  nextSunday,
  upcomingSunday,
} from "./calendar.ts";
import { createOrLoadSundayMeeting } from "./service.ts";
import { generateSupportText, resolvePresider } from "./support.ts";
import { buildSundayMeetingMemberHistory } from "./history.ts";
import { loadSundayMeetingTaskCandidates } from "./tasks.ts";
import {
  SUNDAY_SCHEDULE_POLICY,
  getScheduleBoundaryVisibility,
  safeSundayCursor,
  shouldFallbackToDefaultSchedule,
} from "./schedule.ts";
import { sortSundayItems } from "./order.ts";
import {
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingType,
  parseItemMetadata,
  type SundayMeeting,
  type SundayMeetingItem,
  type SundayMeetingMemberHistory,
  type SundayMeetingTaskSummary,
} from "./types.ts";

const itemInclude = {
  member: { select: { first_name: true, last_name: true } },
  task: {
    select: {
      id: true,
      title: true,
      description: true,
      member: { select: { first_name: true, last_name: true } },
    },
  },
} satisfies Prisma.sunday_meeting_itemInclude;

const meetingInclude = {
  sunday_meeting_item: { include: itemInclude },
} satisfies Prisma.sunday_meetingInclude;

type ItemRecord = Prisma.sunday_meeting_itemGetPayload<{
  include: typeof itemInclude;
}>;

type MeetingRecord = Prisma.sunday_meetingGetPayload<{
  include: typeof meetingInclude;
}>;

type MeetingRow = Pick<
  MeetingRecord,
  "id" | "ward_id" | "date" | "type" | "information"
>;

function memberDisplayName(
  member: { first_name: string; last_name: string } | null,
): string | null {
  return member ? `${member.first_name} ${member.last_name}`.trim() : null;
}

function mapTask(task: ItemRecord["task"]): SundayMeetingTaskSummary | null {
  if (!task) {
    return null;
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    memberName: memberDisplayName(task.member),
  };
}

function mapItem(item: ItemRecord): SundayMeetingItem {
  if (
    !isSundayMeetingItemType(item.type) ||
    !isSundayMeetingSection(item.section)
  ) {
    throw new Error("Sunday meeting contains an invalid agenda item.");
  }
  return {
    id: item.id,
    sundayMeetingId: item.sunday_meeting_id,
    type: item.type,
    section: item.section,
    orderIndex: item.order_index,
    content: item.content,
    metadata: parseItemMetadata(item.metadata),
    personMemberId: item.person_member_id,
    personName: item.person_name,
    personNameResolved:
      memberDisplayName(item.member) ?? item.person_name ?? null,
    taskId: item.task_id,
    task: mapTask(item.task),
    createdAt: item.created_at.toISOString(),
  };
}

export function mapSundayMeeting(
  record: MeetingRow & { sunday_meeting_item: readonly ItemRecord[] },
): SundayMeeting {
  if (!isSundayMeetingType(record.type)) {
    throw new Error("Sunday meeting contains an invalid meeting type.");
  }
  const items = sortSundayItems(record.sunday_meeting_item.map(mapItem));
  const meeting: SundayMeeting = {
    id: record.id,
    wardId: record.ward_id,
    date: record.date,
    type: record.type,
    information: record.information,
    items,
    presider: null,
  };
  meeting.presider = resolvePresider(meeting);
  return meeting;
}

export async function getSundayMeetingSettings(wardId: string) {
  const ward = await prisma.ward.findUnique({
    where: { id: wardId },
    select: { content_locale: true, time_zone: true },
  });
  if (!ward) {
    throw new Error("Ward not found.");
  }
  return ward;
}

export async function loadSundayMeeting(
  wardId: string,
  meetingId: string,
): Promise<SundayMeeting | null> {
  const record = await prisma.sunday_meeting.findFirst({
    where: { id: meetingId, ward_id: wardId },
    include: meetingInclude,
  });
  return record ? mapSundayMeeting(record) : null;
}

export async function loadSundaySchedule(
  wardId: string,
  options: { anchor?: string; before?: string; after?: string } = {},
) {
  const settings = await getSundayMeetingSettings(wardId);
  const currentSunday = upcomingSunday(localToday(settings.time_zone));
  const before = safeSundayCursor(options.before);
  const after = safeSundayCursor(options.after);
  const anchor = safeSundayCursor(options.anchor);
  const boundaries = await prisma.sunday_meeting.aggregate({
    where: { ward_id: wardId },
    _min: { date: true },
    _max: { date: true },
  });
  const earliestDate = boundaries._min.date;
  const latestDate = boundaries._max.date;

  async function loadPage(
    where: Prisma.sunday_meetingWhereInput,
    order: "asc" | "desc",
    take: number,
  ): Promise<MeetingRow[]> {
    const rows = await prisma.sunday_meeting.findMany({
      where,
      orderBy: { date: order },
      take,
      select: {
        id: true,
        ward_id: true,
        date: true,
        type: true,
        information: true,
      },
    });
    return order === "desc" ? rows.reverse() : rows;
  }

  async function loadDefaultPage(): Promise<MeetingRow[]> {
    const [earlier, upcoming] = await Promise.all([
      loadPage(
        { ward_id: wardId, date: { lt: currentSunday } },
        "desc",
        SUNDAY_SCHEDULE_POLICY.priorLimit,
      ),
      loadPage(
        { ward_id: wardId, date: { gte: currentSunday } },
        "asc",
        SUNDAY_SCHEDULE_POLICY.currentLimit,
      ),
    ]);
    return [...earlier, ...upcoming];
  }

  async function loadSelectedPage(): Promise<MeetingRow[]> {
    if (before) {
      return loadPage(
        { ward_id: wardId, date: { lt: before } },
        "desc",
        SUNDAY_SCHEDULE_POLICY.cursorPageLimit,
      );
    }
    if (after) {
      return loadPage(
        { ward_id: wardId, date: { gt: after } },
        "asc",
        SUNDAY_SCHEDULE_POLICY.cursorPageLimit,
      );
    }
    if (anchor) {
      const [earlier, upcoming] = await Promise.all([
        loadPage(
          { ward_id: wardId, date: { lt: anchor } },
          "desc",
          SUNDAY_SCHEDULE_POLICY.priorLimit,
        ),
        loadPage(
          { ward_id: wardId, date: { gte: anchor } },
          "asc",
          SUNDAY_SCHEDULE_POLICY.currentLimit,
        ),
      ]);
      return [...earlier, ...upcoming];
    }
    return loadDefaultPage();
  }

  // A cursor may be valid but point beyond the persisted history. Fall back
  // to the normal persisted page rather than presenting a creation bootstrap.
  let selected = await loadSelectedPage();
  if (
    shouldFallbackToDefaultSchedule(
      selected.length,
      earliestDate !== null,
      Boolean(before || after || anchor),
    )
  ) {
    selected = await loadDefaultPage();
  }
  const firstDate = selected[0]?.date ?? currentSunday;
  const lastDate = selected.at(-1)?.date ?? currentSunday;
  const boundaryVisibility = getScheduleBoundaryVisibility(
    selected.map((record) => record.date),
    earliestDate,
    latestDate,
  );

  // One batched query for every item on the selected Sundays.
  const meetingIds = selected.map((record) => record.id);
  const itemRecords = await prisma.sunday_meeting_item.findMany({
    where: { sunday_meeting_id: { in: meetingIds } },
    include: itemInclude,
  });
  const itemsByMeeting = new Map<string, ItemRecord[]>();
  for (const item of itemRecords) {
    const group = itemsByMeeting.get(item.sunday_meeting_id) ?? [];
    group.push(item);
    itemsByMeeting.set(item.sunday_meeting_id, group);
  }

  return {
    currentSunday,
    range: { start: firstDate, end: lastDate },
    contentLocale: settings.content_locale,
    timeZone: settings.time_zone,
    rows: selected.map((record) =>
      mapSundayMeeting({
        ...record,
        sunday_meeting_item: itemsByMeeting.get(record.id) ?? [],
      }),
    ),
    ...boundaryVisibility,
    earlierCursor: firstDate,
    laterCursor: lastDate,
  };
}

async function loadOrCreateByDate(wardId: string, date: string) {
  const record = await createOrLoadSundayMeeting(wardId, date);
  const loaded = await loadSundayMeeting(wardId, record.id);
  if (!loaded) {
    throw new Error("Could not load Sunday meeting.");
  }
  return loaded;
}

async function defaultLeadingMeeting(
  wardId: string,
  timeZone: string,
): Promise<SundayMeeting> {
  const today = localToday(timeZone);
  let date = new Date(`${today}T00:00:00Z`).getUTCDay() === 0
    ? today
    : nextSundayFromDate(today);

  for (let attempts = 0; attempts < 104; attempts += 1) {
    const meeting = await loadOrCreateByDate(wardId, date);
    if (isLocalMeetingType(meeting.type)) {
      return meeting;
    }
    date = nextSunday(date);
  }
  throw new Error("Could not find an upcoming local Sunday meeting.");
}

function nextSundayFromDate(date: string): string {
  const current = new Date(`${date}T00:00:00Z`);
  const daysToSunday = (7 - current.getUTCDay()) % 7;
  current.setUTCDate(current.getUTCDate() + (daysToSunday || 7));
  return current.toISOString().slice(0, 10);
}

export async function loadSundayMeetingMemberHistory(
  wardId: string,
  timeZone?: string,
): Promise<SundayMeetingMemberHistory[]> {
  const resolvedTimeZone = timeZone ?? (await getSundayMeetingSettings(wardId)).time_zone;
  const today = localToday(resolvedTimeZone);
  const [members, itemRecords] = await Promise.all([
    prisma.member.findMany({
      where: { ward_id: wardId },
      select: { id: true, first_name: true, last_name: true, status: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
    prisma.sunday_meeting_item.findMany({
      where: {
        person_member_id: { not: null },
        type: { in: ["talk", "prayer"] },
        sunday_meeting: { ward_id: wardId },
      },
      select: {
        person_member_id: true,
        type: true,
        sunday_meeting: { select: { date: true, type: true } },
      },
    }),
  ]);

  return buildSundayMeetingMemberHistory(
    members,
    itemRecords.flatMap((item) =>
      item.person_member_id
        ? {
            memberId: item.person_member_id,
            type: item.type,
            sunday_meeting: item.sunday_meeting,
          }
        : [],
    ),
    today,
    isSundayMeetingType,
  );
}

export async function loadLeadingSundayMeeting(
  wardId: string,
  selectedDate?: string,
) {
  const settings = await getSundayMeetingSettings(wardId);
  if (selectedDate) {
    assertSunday(selectedDate);
  }
  const meeting = selectedDate
    ? await loadOrCreateByDate(wardId, selectedDate)
    : await defaultLeadingMeeting(wardId, settings.time_zone);
  const [taskCandidates, memberHistory] = await Promise.all([
    isLocalMeetingType(meeting.type)
      ? loadSundayMeetingTaskCandidates(wardId)
      : Promise.resolve([]),
    loadSundayMeetingMemberHistory(wardId, settings.time_zone),
  ]);
  const leader = meeting.items.find((item) => item.type === "leader");

  return {
    meeting,
    contentLocale: settings.content_locale,
    timeZone: settings.time_zone,
    isLocal: isLocalMeetingType(meeting.type),
    isReadyToLead: isLocalMeetingType(meeting.type) && Boolean(leader),
    supportText: generateSupportText(meeting, settings.content_locale),
    taskCandidates,
    memberHistory,
  };
}
