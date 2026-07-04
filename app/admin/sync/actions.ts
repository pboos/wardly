"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

// --- Types (shared with the client component) ---

export type IncomingMember = {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  email: string | null;
  isBaptized: boolean;
};

export type ExistingMember = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  email: string | null;
  is_baptized: boolean;
  status: string;
};

export type FieldChanges = {
  email?: { from: string | null; to: string | null };
  birth_date?: { from: string | null; to: string | null };
  is_baptized?: { from: boolean; to: boolean };
};

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
  ambiguous: { incoming: IncomingMember; candidates: ExistingMember[] }[];
  possibleNameChanges: { incoming: IncomingMember; movedMember: ExistingMember }[];
};

export type ResolvedPlan = {
  inserts: IncomingMember[];
  moves: string[];
  updates: {
    id: string;
    email: string | null;
    birthDate: string | null;
    isBaptized: boolean;
    reactivate: boolean;
  }[];
  merges: {
    existingId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    birthDate: string | null;
    isBaptized: boolean;
  }[];
};

// --- Constants ---

const MAX_RAW_BYTES = 1_000_000;
const MAX_ROWS = 2000;

// --- Helpers ---

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeGender(gender: string): string {
  const g = gender.trim().toLowerCase();
  if (g === "male" || g === "m") return "m";
  if (g === "female" || g === "f") return "f";
  return g;
}

function normalizeIncoming(raw: IncomingMember): IncomingMember {
  return {
    firstName: (raw.firstName ?? "").trim().replace(/\s+/g, " "),
    lastName: (raw.lastName ?? "").trim().replace(/\s+/g, " "),
    gender: normalizeGender(raw.gender ?? ""),
    birthDate: raw.birthDate?.trim() || null,
    email: raw.email?.trim() || null,
    isBaptized: Boolean(raw.isBaptized),
  };
}

function computeChanges(
  existing: ExistingMember,
  incoming: IncomingMember,
): FieldChanges {
  const changes: FieldChanges = {};
  if (existing.email !== incoming.email) {
    changes.email = { from: existing.email, to: incoming.email };
  }
  if (existing.birth_date !== incoming.birthDate) {
    changes.birth_date = { from: existing.birth_date, to: incoming.birthDate };
  }
  if (existing.is_baptized !== incoming.isBaptized) {
    changes.is_baptized = {
      from: existing.is_baptized,
      to: incoming.isBaptized,
    };
  }
  return changes;
}

function matchMembers(
  incoming: IncomingMember[],
  members: ExistingMember[],
): SyncDiff {
  const matchedMemberIds = new Set<string>();

  const result: SyncDiff = {
    new: [],
    moved: [],
    updated: [],
    unchanged: [],
    ambiguous: [],
    possibleNameChanges: [],
  };

  for (const inc of incoming) {
    const normalizedFirst = normalizeName(inc.firstName);
    const normalizedLast = normalizeName(inc.lastName);

    const candidates = members.filter(
      (m) =>
        normalizeName(m.first_name) === normalizedFirst &&
        normalizeName(m.last_name) === normalizedLast,
    );

    if (candidates.length === 0) {
      result.new.push(inc);
    } else if (candidates.length === 1) {
      const candidate = candidates[0];
      matchedMemberIds.add(candidate.id);
      const changes = computeChanges(candidate, inc);
      const reactivate = candidate.status === "moved";
      if (Object.keys(changes).length === 0 && !reactivate) {
        result.unchanged.push({
          id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
        });
      } else {
        result.updated.push({ existing: candidate, incoming: inc, changes, reactivate });
      }
    } else {
      const birthDateMatches = inc.birthDate
        ? candidates.filter((c) => c.birth_date === inc.birthDate)
        : [];
      if (birthDateMatches.length === 1) {
        const candidate = birthDateMatches[0];
        matchedMemberIds.add(candidate.id);
        const changes = computeChanges(candidate, inc);
        const reactivate = candidate.status === "moved";
        if (Object.keys(changes).length === 0 && !reactivate) {
          result.unchanged.push({
            id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
          });
        } else {
          result.updated.push({
            existing: candidate,
            incoming: inc,
            changes,
            reactivate,
          });
        }
      } else {
        result.ambiguous.push({ incoming: inc, candidates });
      }
    }
  }

  for (const m of members) {
    if (!matchedMemberIds.has(m.id) && m.status !== "moved") {
      result.moved.push(m);
    }
  }

  return result;
}

function findPossibleNameChanges(
  newRows: IncomingMember[],
  movedRows: ExistingMember[],
): { incoming: IncomingMember; movedMember: ExistingMember }[] {
  const pairs: { incoming: IncomingMember; movedMember: ExistingMember }[] = [];
  for (const inc of newRows) {
    if (!inc.birthDate) continue;
    for (const moved of movedRows) {
      if (inc.birthDate === moved.birth_date && inc.gender === moved.gender) {
        pairs.push({ incoming: inc, movedMember: moved });
      }
    }
  }
  return pairs;
}

// --- Action 1: parse + classify ---

export async function parseSync(
  rawText: string,
): Promise<SyncDiff | { error: string }> {
  const user = await getCurrentUser();

  if (Buffer.byteLength(rawText, "utf8") > MAX_RAW_BYTES) {
    return { error: "Input exceeds 1 MB limit." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { error: "Invalid JSON. Make sure you copied the array from the console." };
  }

  if (!Array.isArray(parsed)) {
    return { error: "Expected a JSON array of member objects." };
  }

  if (parsed.length > MAX_ROWS) {
    return { error: `Input exceeds ${MAX_ROWS} row limit.` };
  }

  const incoming: IncomingMember[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== "object" || item === null) {
      return { error: `Row ${i + 1}: expected an object.` };
    }
    const row = item as Record<string, unknown>;
    if (typeof row.firstName !== "string" || typeof row.lastName !== "string") {
      return { error: `Row ${i + 1}: firstName and lastName are required strings.` };
    }
    incoming.push(
      normalizeIncoming({
        firstName: row.firstName,
        lastName: row.lastName,
        gender: typeof row.gender === "string" ? row.gender : "",
        birthDate: typeof row.birthDate === "string" ? row.birthDate : null,
        email: typeof row.email === "string" ? row.email : null,
        isBaptized: Boolean(row.isBaptized),
      }),
    );
  }

  const members = await prisma.member.findMany({
    where: { ward_id: user.ward_id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      gender: true,
      birth_date: true,
      email: true,
      is_baptized: true,
      status: true,
    },
  });

  const diff = matchMembers(incoming, members as ExistingMember[]);
  diff.possibleNameChanges = findPossibleNameChanges(diff.new, diff.moved);

  return diff;
}

// --- Action 2: commit ---

export async function commitSync(plan: ResolvedPlan): Promise<{
  added: number;
  moved: number;
  updated: number;
}> {
  const user = await getCurrentUser();

  return prisma.$transaction(async (tx) => {
    let added = 0;
    let moved = 0;
    let updated = 0;

    for (const inc of plan.inserts) {
      await tx.member.create({
        data: {
          ward_id: user.ward_id,
          first_name: inc.firstName,
          last_name: inc.lastName,
          gender: inc.gender,
          birth_date: inc.birthDate,
          email: inc.email,
          is_baptized: inc.isBaptized,
          status: "active",
        },
      });
      added++;
    }

    for (const id of plan.moves) {
      await tx.member.updateMany({
        where: { id, ward_id: user.ward_id },
        data: { status: "moved", updated_at: new Date() },
      });
      moved++;
    }

    for (const upd of plan.updates) {
      const data: Record<string, unknown> = {
        email: upd.email,
        birth_date: upd.birthDate,
        is_baptized: upd.isBaptized,
        updated_at: new Date(),
      };
      if (upd.reactivate) {
        data.status = "active";
      }
      await tx.member.updateMany({
        where: { id: upd.id, ward_id: user.ward_id },
        data,
      });
      updated++;
    }

    for (const merge of plan.merges) {
      await tx.member.updateMany({
        where: { id: merge.existingId, ward_id: user.ward_id },
        data: {
          first_name: merge.firstName,
          last_name: merge.lastName,
          email: merge.email,
          birth_date: merge.birthDate,
          is_baptized: merge.isBaptized,
          status: "active",
          updated_at: new Date(),
        },
      });
      updated++;
    }

    return { added, moved, updated };
  });
}
