import { Badge } from "@/components/ui/badge";

export function PreviewSection({
  title,
  badgeText,
  badgeVariant,
  emptyText,
  children,
}: {
  title: string;
  badgeText: number;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={badgeVariant}>{badgeText}</Badge>
      </div>
      {badgeText === 0 && emptyText ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        children
      )}
    </div>
  );
}
