import { getCurrentUser } from "@/lib/auth/dal";
import { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";
import { SundayLeadingView } from "../sunday-leading-view";

export default async function SundayLeadingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const { date } = await searchParams;
  const selectedDate = typeof date === "string" ? date : undefined;
  const data = await loadLeadingSundayMeeting(user.ward_id, selectedDate);

  return <SundayLeadingView data={data} />;
}
