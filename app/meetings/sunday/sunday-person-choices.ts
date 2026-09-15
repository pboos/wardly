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
  // Keep an exact name first, even when many partial matches fill the list.
  matching.sort(
    (a, b) =>
      Number(b.name.toLocaleLowerCase() === normalized) -
      Number(a.name.toLocaleLowerCase() === normalized),
  );
  const choices: SundayPersonChoice[] = matching.slice(0, 8).map((member) => ({
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
