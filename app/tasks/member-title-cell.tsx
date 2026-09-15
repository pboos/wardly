"use client";
export function MemberTitleCell({
  title,
  showTitle,
  memberName,
}: {
  title: string | null;
  showTitle: boolean;
  memberName: string | null;
}) {
  const hasTitle = showTitle && title;
  const hasMember = !!memberName;

  if (hasTitle && hasMember) {
    return (
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-sm font-medium">{memberName}</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
    );
  }
  if (hasTitle) {
    return <span className="text-sm font-medium">{title}</span>;
  }
  if (hasMember) {
    return <span className="text-sm font-medium">{memberName}</span>;
  }
  return <span className="text-sm text-muted-foreground">Untitled</span>;
}
