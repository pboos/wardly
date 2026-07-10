import Link from "next/link";
import { IconSettings } from "@tabler/icons-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PAST_LIMIT } from "@/lib/tasks/types";
import { loadTaskTypes } from "@/lib/tasks/loader";
import type { Task, TaskTypeDef, WardMember, WardUser } from "@/lib/tasks/types";
import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  const [activeTasks, pastTasks, users, members, taskTypes] = await Promise.all([
    prisma.task.findMany({
      where: { ward_id: wardId, completed_at: null },
      orderBy: [{ created_at: "desc" }, { type: "asc" }],
      include: {
        assigned_user: { select: { name: true } },
        member: { select: { first_name: true, last_name: true } },
      },
    }),
    prisma.task.findMany({
      where: { ward_id: wardId, NOT: { completed_at: null } },
      orderBy: [{ completed_at: "desc" }],
      take: PAST_LIMIT,
      include: {
        assigned_user: { select: { name: true } },
        member: { select: { first_name: true, last_name: true } },
      },
    }),
    prisma.user.findMany({
      where: { ward_id: wardId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.member.findMany({
      where: { ward_id: wardId },
      select: { id: true, first_name: true, last_name: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
    loadTaskTypes(wardId),
  ]);

  const mappedActive: Task[] = activeTasks.map(mapTask);
  const mappedPast: Task[] = pastTasks.map(mapTask);
  const mappedUsers: WardUser[] = users;
  const mappedMembers: WardMember[] = members;
  const taskTypeDefs: TaskTypeDef[] = taskTypes;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks/settings" aria-label="Task settings">
            <IconSettings className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </Button>
      </header>
      <TasksView
        activeTasks={mappedActive}
        pastTasks={mappedPast}
        users={mappedUsers}
        members={mappedMembers}
        taskTypes={taskTypeDefs}
        currentUserId={user.id}
      />
    </div>
  );
}

function mapTask(
  t: {
    id: string;
    ward_id: string;
    type: string;
    state: string;
    title: string | null;
    description: string | null;
    assigned_user_id: string | null;
    member_id: string | null;
    deadline: string | null;
    priority: string;
    duration_minutes: number | null;
    completed_at: string | null;
    created_at: Date;
    assigned_user?: { name: string } | null;
    member?: { first_name: string; last_name: string } | null;
  },
): Task {
  return {
    id: t.id,
    ward_id: t.ward_id,
    type: t.type,
    state: t.state,
    title: t.title,
    description: t.description,
    assigned_user_id: t.assigned_user_id,
    assigned_user_name: t.assigned_user?.name ?? null,
    member_id: t.member_id,
    member_first_name: t.member?.first_name ?? null,
    member_last_name: t.member?.last_name ?? null,
    deadline: t.deadline,
    priority: t.priority,
    duration_minutes: t.duration_minutes,
    completed_at: t.completed_at,
    created_at: t.created_at.toISOString(),
  };
}
