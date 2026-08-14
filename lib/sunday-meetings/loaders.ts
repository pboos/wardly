import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertSunday,
  localToday,
  nextSunday,
  upcomingSunday,
} from "./calendar";
import { createOrLoadSundayMeeting } from "./service";
import { generateSupportText, resolvePresider } from "./support";
import { buildSundayMeetingMemberHistory } from "./history";
import { loadSundayMeetingTaskCandidates } from "./tasks";
import {
  SUNDAY_SCHEDULE_POLICY,
  getScheduleBoundaryVisibility,
  safeSundayCursor,
  shouldFallbackToDefaultSchedule,
} from "./schedule";
import {
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingStandardSlot,
  isSundayMeetingType,
  isSundayMeetingVisitorRole,
  type SundayMeeting,
  type SundayMeetingAssignment,
  type SundayMeetingItem,
  type SundayMeetingMemberHistory,
  type SundayMeetingStandardSlot,
} from "./types";

const meetingInclude = {
  sunday_meeting_item: {
    orderBy: { order_index: "asc" },
    include: {
      sunday_meeting_person_assignment: {
        orderBy: { order_index: "asc" },
        include: {
          member: { select: { first_name: true, last_name: true } },
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          member: { select: { first_name: true, last_name: true } },
        },
      },
    },
  },
  sunday_meeting_person_assignment: {
    where: { sunday_meeting_item_id: null },
    orderBy: { order_index: "asc" },
    include: {
      member: { select: { first_name: true, last_name: true } },
    },
  },
} satisfies Prisma.sunday_meetingInclude;

type MeetingRecord = Prisma.sunday_meetingGetPayload<{
  include: typeof meetingInclude;
}>;

function fullName(
  member: { first_name: string; last_name: string } | null,
  freeTextName: string | null,
): string {
  if (member) {
    return `${member.first_name} ${member.last_name}`.trim();
  }
  return freeTextName ?? "Unknown person";
}

function mapAssignment(
  assignment: MeetingRecord["sunday_meeting_person_assignment"][number] | MeetingRecord["sunday_meeting_item"][number]["sunday_meeting_person_assignment"][number],
): SundayMeetingAssignment {
  return {
    id: assignment.id,
    sundayMeetingId: assignment.sunday_meeting_id,
    sundayMeetingItemId: assignment.sunday_meeting_item_id,
    role: assignment.role as SundayMeetingAssignment["role"],
    memberId: assignment.member_id,
    freeTextName: assignment.free_text_name,
    name: fullName(assignment.member, assignment.free_text_name),
    orderIndex: assignment.order_index,
    visitorRole: isSundayMeetingVisitorRole(assignment.visitor_role)
      ? assignment.visitor_role
      : null,
    visitorRoleCustom: assignment.visitor_role_custom,
    isPresidingOverride: assignment.is_presiding_override,
  };
}

function mapItem(
  item: MeetingRecord["sunday_meeting_item"][number],
): SundayMeetingItem {
  if (!isSundayMeetingItemType(item.type) || !isSundayMeetingSection(item.section)) {
    throw new Error("Sunday meeting contains an invalid agenda item.");
  }
  let standardSlot: SundayMeetingStandardSlot | null = null;
  if (item.standard_slot) {
    if (!isSundayMeetingStandardSlot(item.standard_slot)) {
      throw new Error("Sunday meeting contains an invalid standard slot.");
    }
    standardSlot = item.standard_slot;
  }
  return {
    id: item.id,
    sundayMeetingId: item.sunday_meeting_id,
    type: item.type,
    section: item.section,
    standardSlot,
    orderIndex: item.order_index,
    content: item.content,
    hymnNumber: item.hymn_number,
    taskId: item.task_id,
    task: item.task
      ? {
          id: item.task.id,
          title: item.task.title,
          description: item.task.description,
          memberName: item.task.member
            ? `${item.task.member.first_name} ${item.task.member.last_name}`.trim()
            : null,
        }
      : null,
    assignments: item.sunday_meeting_person_assignment.map(mapAssignment),
  };
}

export function mapSundayMeeting(record: MeetingRecord): SundayMeeting {
  if (!isSundayMeetingType(record.type)) {
    throw new Error("Sunday meeting contains an invalid meeting type.");
  }
  const assignments = record.sunday_meeting_person_assignment.map(mapAssignment);
  const meeting: SundayMeeting = {
    id: record.id,
    wardId: record.ward_id,
    date: record.date,
    type: record.type,
    information: record.information,
    items: record.sunday_meeting_item.map(mapItem),
    assignments,
    presider: null,
  };
  meeting.presider = resolvePresider(assignments);
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
  const [earliest, latest] = await Promise.all([
    prisma.sunday_meeting.findFirst({
      where: { ward_id: wardId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.sunday_meeting.findFirst({
      where: { ward_id: wardId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  async function loadPage(
    where: Prisma.sunday_meetingWhereInput,
    order: "asc" | "desc",
    take: number,
  ): Promise<MeetingRecord[]> {
    const rows = await prisma.sunday_meeting.findMany({
      where,
      orderBy: { date: order },
      take,
      include: meetingInclude,
    });
    return order === "desc" ? rows.reverse() : rows;
  }

  async function loadDefaultPage(): Promise<MeetingRecord[]> {
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

  async function loadSelectedPage(): Promise<MeetingRecord[]> {
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
      Boolean(earliest),
      Boolean(before || after || anchor),
    )
  ) {
    selected = await loadDefaultPage();
  }
  const firstDate = selected[0]?.date ?? currentSunday;
  const lastDate = selected.at(-1)?.date ?? currentSunday;
  const earliestDate = earliest?.date;
  const latestDate = latest?.date;
  const boundaryVisibility = getScheduleBoundaryVisibility(
    selected.map((record) => record.date),
    earliestDate ?? null,
    latestDate ?? null,
  );

  return {
    range: { start: firstDate, end: lastDate },
    contentLocale: settings.content_locale,
    timeZone: settings.time_zone,
    rows: selected.map(mapSundayMeeting),
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
  const [members, assignments] = await Promise.all([
    prisma.member.findMany({
      where: { ward_id: wardId },
      select: { id: true, first_name: true, last_name: true, status: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
    prisma.sunday_meeting_person_assignment.findMany({
      where: {
        member_id: { not: null },
        role: { in: ["speaker", "prayer"] },
        sunday_meeting: { ward_id: wardId },
      },
      select: {
        member_id: true,
        role: true,
        sunday_meeting: { select: { date: true, type: true } },
      },
    }),
  ]);

  return buildSundayMeetingMemberHistory(members, assignments, today, isSundayMeetingType);
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
  const leader = meeting.assignments.find(
    (assignment) => assignment.role === "leader",
  );

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
