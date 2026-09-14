"use client";

import type { SundayMeeting } from "@/lib/sunday-meetings/types";
import { TextDialog } from "./sunday-text-dialog";
import { updateSundayMeetingInformation } from "./actions";

export function InformationCell({ meeting }: { meeting: SundayMeeting }) {
  return (
    <TextDialog
      title="Meeting information"
      triggerLabel={meeting.information ?? "Add information"}
      initialValue={meeting.information ?? ""}
      multiline
      onSave={(value) =>
        updateSundayMeetingInformation(meeting.id, value || null)
      }
    />
  );
}
