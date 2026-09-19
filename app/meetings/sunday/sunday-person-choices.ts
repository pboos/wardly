import { groupedMemberChoices } from "@/lib/members/choices";
import type {
  SundayMeetingMemberHistory,
  SundayPersonInput,
} from "@/lib/sunday-meetings/types";

export type SundayPersonChoice = {
  value: string;
  label: string;
  person: SundayPersonInput;
  member?: SundayMeetingMemberHistory;
};

/** Match partial names; Enter defaults to the first match or the free-text option. */
export function sundayPersonChoices(
  members: SundayMeetingMemberHistory[],
  query: string,
): SundayPersonChoice[] {
  const name = query.trim();
  const normalized = name.toLocaleLowerCase();
  const matching = members.filter((member) =>
    member.name.toLocaleLowerCase().includes(normalized),
  );
  const groups = groupedMemberChoices(
    matching.map((member) => ({
      ...member,
      value: member.id,
      label: member.name,
    })),
    query,
    8,
  );
  const choices: SundayPersonChoice[] = [
    ...groups.regular,
    ...groups.excluded,
  ].map((member) => ({
    value: member.id,
    label: member.name,
    member,
    person: { memberId: member.id, personName: null },
  }));
  if (
    name &&
    !matching.some((member) => member.name.toLocaleLowerCase() === normalized)
  ) {
    choices.push({
      value: "free-text",
      label: name,
      person: { memberId: null, personName: name },
    });
  }
  return choices;
}
