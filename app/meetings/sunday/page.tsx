import { getCurrentUser } from "@/lib/auth/dal";
import {
  loadSundayMeetingMemberHistory,
  loadSundaySchedule,
} from "@/lib/sunday-meetings/loaders";
import { SundayScheduleView } from "./sunday-schedule-view";

export default async function SundaySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ anchor?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const { anchor } = await searchParams;
  const anchorDate = typeof anchor === "string" ? anchor : undefined;
  const schedule = await loadSundaySchedule(user.ward_id, anchorDate);
  const members = await loadSundayMeetingMemberHistory(
    user.ward_id,
    schedule.timeZone,
  );

  return <SundayScheduleView schedule={schedule} members={members} />;
}
