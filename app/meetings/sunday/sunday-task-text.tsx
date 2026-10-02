import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function SundayTaskText({
  task,
  text,
}: {
  task: {
    typeLabel?: string;
    stateLabel?: string;
    memberName: string | null;
    title: string | null;
  };
  text?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-x-2 gap-y-1 text-sm [overflow-wrap:anywhere]">
      <span className="font-medium">{task.typeLabel}</span>
      <Badge variant="secondary" className="h-auto min-h-5 max-w-full whitespace-normal">
        {task.stateLabel}
      </Badge>
      {task.memberName && <span>{task.memberName}</span>}
      {text ??
        (task.title && (
          <span className="whitespace-pre-wrap text-muted-foreground">
            {task.title}
          </span>
        ))}
    </div>
  );
}
