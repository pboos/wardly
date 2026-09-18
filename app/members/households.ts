type HouseholdMember = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  external_household_uuid: string | null;
  external_household_role: string | null;
};

function isHouseholdHead(member: HouseholdMember) {
  return member.external_household_role?.trim().toUpperCase() === "HEAD";
}

function compareNames(a: HouseholdMember, b: HouseholdMember) {
  return (
    a.last_name.localeCompare(b.last_name, "en") ||
    a.first_name.localeCompare(b.first_name, "en") ||
    a.id.localeCompare(b.id, "en")
  );
}

export function groupMembersByHousehold<T extends HouseholdMember>(
  members: T[],
) {
  const groups = new Map<string, T[]>();
  for (const member of members) {
    const householdId = member.external_household_uuid?.trim();
    const key = householdId
      ? `household:${householdId}`
      : `member:${member.id}`;
    const group = groups.get(key) ?? [];
    group.push(member);
    groups.set(key, group);
  }

  return Array.from(groups, ([key, members]) => {
    // ISO birth dates sort chronologically; prefer known dates over missing ones.
    const head =
      members.filter(isHouseholdHead).sort(compareNames)[0] ??
      [...members].sort(
        (a, b) =>
          (a.birth_date ?? "9999-12-31").localeCompare(
            b.birth_date ?? "9999-12-31",
          ) || compareNames(a, b),
      )[0];
    members.sort(
      (a, b) =>
        Number(b.id === head.id) - Number(a.id === head.id) ||
        compareNames(a, b),
    );
    const first = members[0];
    const isHousehold = key.startsWith("household:");
    return {
      key,
      members,
      isHousehold,
      displayHeadId: head.id,
      label: `${first.first_name} ${first.last_name}${isHousehold ? " household" : ""}`,
    };
  }).sort((a, b) => compareNames(a.members[0], b.members[0]));
}
