"use client";

import type { SundayMeeting } from "@/lib/sunday-meetings/types";
import { TextDialog } from "./sunday-text-dialog";
import { updateSundayMeetingInformation as updateSundayMeetingInformationAction } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

export function InformationCell({ meeting }: { meeting: SundayMeeting }) {
  const { execute: updateSundayMeetingInformation } = useAppMutation(
    updateSundayMeetingInformationAction,
  );

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
