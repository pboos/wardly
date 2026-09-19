export const TAG_COLORS = [
  "gray",
  "blue",
  "green",
  "amber",
  "purple",
  "rose",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export type MemberTag = {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  isDefaultExcluded: boolean;
};

export function validateTag(name: string, color: string) {
  if (typeof name !== "string" || typeof color !== "string")
    throw new Error("Invalid tag.");
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40)
    throw new Error("Tag names must contain 1–40 characters.");
  if (!TAG_COLORS.includes(color as TagColor))
    throw new Error("Choose a valid color.");
  return { name: trimmed, normalized_name: trimmed.toLowerCase(), color };
}

export function matchesTags(
  ids: string[],
  included: string[],
  excluded: string[],
) {
  return (
    included.every((id) => ids.includes(id)) &&
    excluded.every((id) => !ids.includes(id))
  );
}

/** Overrides are page-local; untouched tags continue to follow refreshed defaults. */
export function excludedTagIds(
  tags: Pick<MemberTag, "id" | "isDefaultExcluded">[],
  overrides: Record<string, boolean>,
) {
  return tags
    .filter((tag) => overrides[tag.id] ?? tag.isDefaultExcluded)
    .map((tag) => tag.id);
}
