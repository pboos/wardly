"use server";
import { loadPreviousMeetingNotes } from "@/lib/leadership-meetings/history";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/auth/action";
import type { SessionIdentity } from "@/lib/auth/action-result";
import { executeMeetingCommand } from "@/lib/leadership-meetings/service";
import type { MeetingCommand } from "@/lib/leadership-meetings/types";
export async function changeLeadershipMeeting(
  identity: SessionIdentity | null,
  command: MeetingCommand,
) {
  return authenticatedAction(identity, async (user) => {
    await executeMeetingCommand(user.ward_id, command);
    revalidatePath("/meetings/bishopric");
    revalidatePath("/meetings/ward-council");
    revalidatePath("/tasks");
  });
}

export async function previousLeadershipMeetingNotes(
  identity: SessionIdentity | null,
  input: { itemId: string; cursor: import("@/lib/leadership-meetings/types").HistoryCursor | null },
) {
  return authenticatedAction(identity, async (user) => {
    return loadPreviousMeetingNotes(user.ward_id, input);
  });
}
