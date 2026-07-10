import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type UserAvatarSize = "default" | "sm" | "lg";

/**
 * User avatar that renders the user's initials as a fallback. Later this can be
 * extended to render an avatar image once user images are supported.
 */
export function UserAvatar({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: UserAvatarSize;
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn(className)}>
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

export { getInitials };
