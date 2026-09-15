import { loadSundayHymns } from "@/lib/sunday-meetings/hymn-loader";
import { SundayHymnProvider } from "./sunday-hymn-provider";
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

  const hymns = await loadSundayHymns(
    user.ward_id,
    schedule.contentLocale,
    schedule.timeZone,
  );
  return (
    <SundayHymnProvider data={hymns}>
      <SundayScheduleView schedule={schedule} members={members} />
    </SundayHymnProvider>
  );
}
