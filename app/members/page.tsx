import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { type Member } from "./members-list";
import { MembersView } from "./members-view";

export default async function MembersPage() {
  const user = await getCurrentUser();

  const rows = await prisma.member.findMany({
    where: { ward_id: user.ward_id },
    include: { tag_assignments: { select: { tag_id: true } } },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const members: Member[] = rows.map((m) => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    gender: m.gender,
    birth_date: m.birth_date,
    email: m.email,
    is_baptized: m.is_baptized,
    is_moved_out: m.is_moved_out,
    tagIds: m.tag_assignments.map((assignment) => assignment.tag_id),
    external_household_uuid: m.external_household_uuid,
    external_household_role: m.external_household_role,
  }));

  const tagRows = await prisma.member_tag.findMany({
    where: { ward_id: user.ward_id },
    orderBy: { normalized_name: "asc" },
    include: { _count: { select: { assignments: true } } },
  });
  const tags = tagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    memberCount: tag._count.assignments,
  }));
  const totalMembers = members.filter((m) => !m.is_moved_out).length;

  return (
    <div className="flex flex-col gap-6">
      <MembersView tags={tags} members={members} totalMembers={totalMembers} />
    </div>
  );
}
