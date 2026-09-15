"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className={cn(!active && "text-muted-foreground")}
    >
      {children}
    </Button>
  );
}
