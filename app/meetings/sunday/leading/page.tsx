import { notFound, redirect } from "next/navigation";
import { safeSundayCursor } from "@/lib/sunday-meetings/schedule";

/** Preserve bookmarks from the former leading-view route. */
export default async function LegacySundayLeadingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  if (typeof date !== "string") redirect("/meetings/sunday/upcoming");
  if (!safeSundayCursor(date)) notFound();
  redirect(`/meetings/sunday/${date}`);
}
