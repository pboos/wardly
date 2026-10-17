import { object, text } from "./calendar";
import type { AgendaAssignment } from "./types";
import { itemForWard, type Db } from "./store";

type AssignmentSnapshot = {
  assigned_user_id: string | null;
  assignment_overridden: boolean;
};
export function canMergeAssignments(
  a: AssignmentSnapshot,
  b: AssignmentSnapshot,
) {
  return (
    !a.assignment_overridden ||
    !b.assignment_overridden ||
    a.assigned_user_id === b.assigned_user_id
  );
}
export function mergedAssignment(a: AssignmentSnapshot, b: AssignmentSnapshot) {
  return b.assignment_overridden && !a.assignment_overridden
    ? {
        assigned_user_id: b.assigned_user_id,
        assignment_overridden: true,
      }
    : {
        assigned_user_id: a.assigned_user_id,
        assignment_overridden: a.assignment_overridden,
      };
}
export async function wardAssignee(db: Db, wardId: string, value: unknown) {
  if (value === null) return null;
  const id = text(value);
  if (
    !(await db.user.findFirst({
      where: { id, ward_id: wardId },
      select: { id: true },
    }))
  )
    throw new Error("Assignee not found in this ward.");
  return id;
}
export async function assignAgenda(
  db: Db,
  wardId: string,
  itemId: string,
  raw: AgendaAssignment,
) {
  object(raw);
  const item = await itemForWard(db, wardId, itemId);
  if (item.outcome !== "pending")
    throw new Error("Only pending items can be assigned.");
  const template =
    item.occurrences.find((o) => !o.occurrence.template.archived)?.occurrence
      .template ?? item.occurrences[0]?.occurrence.template;
  let assignedUserId: string | null;
  if (raw.kind === "default")
    assignedUserId = await wardAssignee(
      db,
      wardId,
      template?.default_assigned_user_id ?? null,
    );
  else if (raw.kind === "override")
    assignedUserId = await wardAssignee(db, wardId, raw.userId);
  else throw new Error("Choose a valid assignment.");
  await db.meeting_agenda_item.update({
    where: { id: item.id },
    data: {
      assigned_user_id: assignedUserId,
      assignment_overridden: raw.kind === "override",
      updated_at: new Date(),
    },
  });
}
export async function updateDefaultAssignment(
  db: Db,
  templateIds: string[],
  userId: string | null,
  fromDate: string,
) {
  await db.meeting_agenda_template.updateMany({
    where: { id: { in: templateIds } },
    data: {
      default_assigned_user_id: userId,
      updated_at: new Date(),
    },
  });
  await db.meeting_agenda_item.updateMany({
    where: {
      outcome: "pending",
      assignment_overridden: false,
      predecessor_id: null,
      meeting: { status: "planned", date: { gte: fromDate } },
      occurrences: {
        some: { occurrence: { template_id: { in: templateIds } } },
      },
    },
    data: { assigned_user_id: userId, updated_at: new Date() },
  });
}
