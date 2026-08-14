"use client";

import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

export function SundayScheduleBoundaryAction({
  action,
  run,
  accessibleName,
  desktop = false,
  colSpan,
}: {
  action: () => Promise<unknown>;
  run: (action: () => Promise<unknown>, errorMessage: string) => void;
  accessibleName: string;
  desktop?: boolean;
  colSpan?: number;
}) {
  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={accessibleName}
      onClick={() => run(action, "Could not extend the Sunday schedule.")}
    >
      <IconPlus data-icon="inline-start" />
      Add Sunday
    </Button>
  );

  if (desktop) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="text-left">
          {button}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="flex justify-start">
      {button}
    </div>
  );
}
