import { getCurrentUser } from "@/lib/auth/dal";
import { loadLeadershipMeeting } from "@/lib/leadership-meetings/loaders";
import { LeadershipView } from "../leadership/leadership-view";
export default async function MeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const data = await loadLeadershipMeeting(
    user.ward_id,
    "ward_council",
    typeof params.meeting === "string" ? params.meeting : undefined,
  );
  return <LeadershipView key={data.meeting?.id ?? "setup"} data={data} />;
}
