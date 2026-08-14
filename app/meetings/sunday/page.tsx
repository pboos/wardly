import { getCurrentUser } from "@/lib/auth/dal";
import {
  loadSundayMeetingMemberHistory,
  loadSundaySchedule,
} from "@/lib/sunday-meetings/loaders";
import { SundayScheduleView } from "./sunday-schedule-view";

export default async function SundaySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    anchor?: string | string[];
    before?: string | string[];
    after?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  const { anchor, before, after } = await searchParams;
  const schedule = await loadSundaySchedule(user.ward_id, {
    anchor: typeof anchor === "string" ? anchor : undefined,
    before: typeof before === "string" ? before : undefined,
    after: typeof after === "string" ? after : undefined,
  });
  const members = await loadSundayMeetingMemberHistory(
    user.ward_id,
    schedule.timeZone,
  );

  return <SundayScheduleView schedule={schedule} members={members} />;
}
