import { loadSundayHymns } from "@/lib/sunday-meetings/hymn-loader";
import { SundayHymnProvider } from "../sunday-hymn-provider";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";
import { safeSundayCursor } from "@/lib/sunday-meetings/schedule";
import { SundayLeadingView } from "../sunday-leading-view";

export default async function SundayMeetingPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await getCurrentUser();
  const { date } = await params;
  if (!safeSundayCursor(date)) notFound();
  const data = await loadLeadingSundayMeeting(user.ward_id, date);
  const hymns = await loadSundayHymns(
    user.ward_id,
    data.contentLocale,
    data.timeZone,
  );
  return (
    <SundayHymnProvider data={hymns}>
      <SundayLeadingView data={data} />
    </SundayHymnProvider>
  );
}
