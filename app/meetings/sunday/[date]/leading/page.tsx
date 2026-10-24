import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadHymnCatalog } from "@/lib/hymns";
import { buildLeadingScript } from "@/lib/sunday-meetings/leading-script";
import { loadLeadingSundayMeeting } from "@/lib/sunday-meetings/loaders";
import { safeSundayCursor } from "@/lib/sunday-meetings/schedule";
import { SundayLeadingScript } from "../../sunday-leading-script";

export default async function SundayLeadingPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await getCurrentUser();
  const { date } = await params;
  if (!safeSundayCursor(date)) notFound();
  const data = await loadLeadingSundayMeeting(user.ward_id, date);
  const catalog = await loadHymnCatalog(data.contentLocale);
  const script = buildLeadingScript({ meeting: data.meeting, contentLocale: data.contentLocale, hymns: catalog?.hymns ?? [] });
  return <SundayLeadingScript date={date} script={script} />;
}
