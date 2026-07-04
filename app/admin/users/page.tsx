import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { UsersView } from "./users-view";
import type { WardUser } from "./actions";

export default async function UsersPage() {
  const user = await getCurrentUser();

  const rows = await prisma.user.findMany({
    where: { ward_id: user.ward_id },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, email: true, name: true },
  });

  const users: WardUser[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    is_self: u.id === user.id,
  }));

  return <UsersView users={users} currentUserId={user.id} />;
}
