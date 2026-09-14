import type { SundayMeeting } from "@/lib/sunday-meetings/types";
import { speakersOfMeeting } from "@/lib/sunday-meetings/slots";

export function speakerCount(meeting: SundayMeeting): number {
  return speakersOfMeeting(meeting.items).length;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
