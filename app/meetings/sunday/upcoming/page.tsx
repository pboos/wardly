import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";

export default async function UpcomingSundayMeetingPage() {
  const user = await getCurrentUser();
  const { meeting } = await loadLeadingSundayMeeting(user.ward_id);
  redirect(`/meetings/sunday/${meeting.date}`);
}
