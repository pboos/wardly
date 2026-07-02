import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { type Member } from "./members-list";
import { MembersView } from "./members-view";

export default async function MembersPage() {
  const user = await getCurrentUser();

  const rows = await prisma.member.findMany({
    where: { ward_id: user.ward_id },
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
    status: m.status,
  }));

  const totalMembers = members.filter((m) => m.status !== "moved").length;

  return (
    <div className="flex flex-col gap-6">
      <MembersView members={members} totalMembers={totalMembers} />
    </div>
  );
}
