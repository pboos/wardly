"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUNDAY_MEETING_TYPE_LABELS,
  SUNDAY_MEETING_TYPES,
  type SundayMeeting,
  type SundayMeetingType,
} from "@/lib/sunday-meetings/types";

export function MeetingTypePicker({
  meeting,
  onChange,
}: {
  meeting: SundayMeeting;
  onChange: (type: SundayMeetingType) => void;
}) {
  return (
    <Select
      value={meeting.type}
      onValueChange={(value) => onChange(value as SundayMeetingType)}
    >
      <SelectTrigger
        aria-label={`Meeting type for ${meeting.date}`}
        size="sm"
        className="min-w-40"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SUNDAY_MEETING_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {SUNDAY_MEETING_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
