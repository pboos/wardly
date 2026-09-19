export type ExclusionTag = { id: string; name: string; color: string };
export type MemberChoice = {
  value: string;
  label: string;
  exclusionTags?: ExclusionTag[];
};

/** Filter before grouping; exact matches only take priority within their group. */
export function groupedMemberChoices<T extends MemberChoice>(
  items: T[],
  query: string,
  limit = Infinity,
) {
  const name = query.trim().toLocaleLowerCase();
  const matches = items.filter((item) =>
    item.label.toLocaleLowerCase().includes(name),
  );
  matches.sort(
    (a, b) =>
      Number(b.label.toLocaleLowerCase() === name) -
      Number(a.label.toLocaleLowerCase() === name),
  );
  return {
    regular: matches
      .filter((item) => !item.exclusionTags?.length)
      .slice(0, limit),
    excluded: matches
      .filter((item) => !!item.exclusionTags?.length)
      .slice(0, limit),
  };
}
