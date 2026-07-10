import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { loadTaskTypes } from "@/lib/tasks/loader";
import type { TaskTypeDef, WardUser } from "@/lib/tasks/types";
import { TasksSettingsView } from "./tasks-settings-view";

export default async function TaskSettingsPage() {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  const [users, taskTypes] = await Promise.all([
    prisma.user.findMany({
      where: { ward_id: wardId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    loadTaskTypes(wardId),
  ]);

  const mappedUsers: WardUser[] = users;
  const taskTypeDefs: TaskTypeDef[] = taskTypes;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/tasks" aria-label="Back to tasks">
            <IconArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">Task settings</h1>
      </header>
      <TasksSettingsView users={mappedUsers} taskTypes={taskTypeDefs} />
    </div>
  );
}
