import { MAX_SYNC_BYTES, MAX_SYNC_ROWS } from "./limits";

export type IncomingMember = {
  externalUuid: string;
  externalHouseholdUuid?: string | null;
  externalHouseholdRole?: string | null;
  firstName: string;
  lastName: string;
  gender: "m" | "f";
  birthDate: string | null;
  email?: string | null;
  isBaptized?: boolean;
};
export type ExistingMember = {
  id: string;
  external_uuid: string | null;
  external_household_uuid: string | null;
  external_household_role: string | null;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  email: string | null;
  is_baptized: boolean;
  status: string;
};
export type FieldChanges = Record<
  string,
  {
    from: string | boolean | null;
    to: string | boolean | null;
  }
>;
export type SyncDiff = {
  new: IncomingMember[];
  moved: ExistingMember[];
  updated: {
    existing: ExistingMember;
    incoming: IncomingMember;
    changes: FieldChanges;
    reactivate: boolean;
  }[];
  unchanged: { id: string; first_name: string; last_name: string }[];
};
export type ResolvedPlan = {
  inserts: IncomingMember[];
  moves: string[];
  updates: (IncomingMember & { id: string; reactivate: boolean })[];
};

export function parseIncoming(rawText: string): IncomingMember[] {
  if (Buffer.byteLength(rawText, "utf8") > MAX_SYNC_BYTES)
    throw new Error("Input exceeds 5 MB limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Invalid JSON. Copy the array from the console.");
  }
  if (!Array.isArray(parsed))
    throw new Error("Expected a JSON array of member objects.");
  if (!parsed.length) throw new Error("The member list must not be empty.");
  if (parsed.length > MAX_SYNC_ROWS)
    throw new Error(`Input exceeds ${MAX_SYNC_ROWS} row limit.`);
  const ids = new Set<string>();
  return parsed.map((row, index) => {
    const fail = (message: string): never => {
      throw new Error(`Row ${index + 1}: ${message}`);
    };
    if (!row || typeof row !== "object" || Array.isArray(row))
      fail("expected an object.");
    if (typeof row.externalUuid !== "string" || !row.externalUuid.trim())
      fail("externalUuid is required. Re-export the member list from LCR.");
    const externalUuid = row.externalUuid.trim();
    if (ids.has(externalUuid)) fail("duplicate externalUuid.");
    ids.add(externalUuid);
    if (typeof row.firstName !== "string" || typeof row.lastName !== "string")
      fail("firstName and lastName are required strings.");
    const optionalString = (key: string) => {
      if (row[key] === undefined) return undefined;
      if (row[key] !== null && typeof row[key] !== "string")
        fail(`${key} must be a string or null, or omitted to preserve it.`);
      return row[key]?.trim() || null;
    };
    if (row.isBaptized != null && typeof row.isBaptized !== "boolean")
      fail("isBaptized must be a boolean, null, or omitted.");
    const rawGender =
      typeof row.gender === "string" ? row.gender.trim().toLowerCase() : "";
    const gender =
      rawGender === "male" ? "m" : rawGender === "female" ? "f" : rawGender;
    if (gender !== "m" && gender !== "f") {
      return fail("gender must be m or f (male/female are also accepted).");
    }
    // Explicit allowlist: nested source data and arbitrary keys never reach writes.
    return {
      externalUuid,
      externalHouseholdUuid: optionalString("externalHouseholdUuid"),
      externalHouseholdRole: optionalString("externalHouseholdRole"),
      firstName: row.firstName.trim().replace(/\s+/g, " "),
      lastName: row.lastName.trim().replace(/\s+/g, " "),
      gender,
      birthDate:
        typeof row.birthDate === "string" ? row.birthDate.trim() || null : null,
      email: optionalString("email"),
      isBaptized:
        typeof row.isBaptized === "boolean" ? row.isBaptized : undefined,
    };
  });
}

export function memberData(incoming: IncomingMember) {
  return {
    external_uuid: incoming.externalUuid,
    first_name: incoming.firstName,
    last_name: incoming.lastName,
    gender: incoming.gender,
    birth_date: incoming.birthDate,
    ...(incoming.email !== undefined ? { email: incoming.email } : {}),
    ...(incoming.isBaptized !== undefined
      ? { is_baptized: incoming.isBaptized }
      : {}),
    ...(incoming.externalHouseholdUuid !== undefined
      ? { external_household_uuid: incoming.externalHouseholdUuid }
      : {}),
    ...(incoming.externalHouseholdRole !== undefined
      ? { external_household_role: incoming.externalHouseholdRole }
      : {}),
  };
}

export function matchMembers(
  incoming: IncomingMember[],
  members: ExistingMember[],
): SyncDiff {
  const byUuid = new Map(
    members.filter((m) => m.external_uuid).map((m) => [m.external_uuid, m]),
  );
  const seen = new Set(incoming.map((m) => m.externalUuid));
  const diff: SyncDiff = { new: [], moved: [], updated: [], unchanged: [] };
  for (const row of incoming) {
    const existing = byUuid.get(row.externalUuid);
    if (!existing) {
      diff.new.push(row);
      continue;
    }
    const changes: FieldChanges = {};
    for (const [key, value] of Object.entries(memberData(row))) {
      const before = existing[key as keyof ExistingMember];
      if (before !== value) changes[key] = { from: before, to: value };
    }
    const reactivate = existing.status === "moved";
    if (Object.keys(changes).length || reactivate)
      diff.updated.push({ existing, incoming: row, changes, reactivate });
    else
      diff.unchanged.push({
        id: existing.id,
        first_name: existing.first_name,
        last_name: existing.last_name,
      });
  }
  diff.moved = members.filter(
    (m) =>
      m.external_uuid && !seen.has(m.external_uuid) && m.status !== "moved",
  );
  return diff;
}
