import { getCurrentUser } from "@/lib/auth/dal";
import { loadLeadershipMeeting } from "@/lib/leadership-meetings/loaders";
import { prepareLeadershipMeetings } from "@/lib/leadership-meetings/prepare";
import { LeadershipView } from "../leadership/leadership-view";
export default async function MeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const user = await getCurrentUser();
  await prepareLeadershipMeetings(user.ward_id, "bishopric");
  const params = await searchParams;
  const data = await loadLeadershipMeeting(
    user.ward_id,
    "bishopric",
    typeof params.meeting === "string" ? params.meeting : undefined,
  );
  return <LeadershipView key={data.meeting?.id ?? "setup"} data={data} />;
}
