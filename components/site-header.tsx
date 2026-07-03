"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";

type NavItem = {
  label: string;
  href: string;
  /** Prefix used to detect the active section. */
  match: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Members", href: "/members", match: "/members" },
  { label: "Tasks", href: "/", match: "/" },
  { label: "Sync", href: "/members/sync", match: "/members/sync" },
];

type MeetingLink = {
  label: string;
  href: string;
};

const MEETING_LINKS: MeetingLink[] = [
  { label: "Bishopric", href: "/meetings/bishopric" },
  { label: "Ward council", href: "/meetings/ward-council" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "/") return pathname === "/";
  return pathname === item.match || pathname.startsWith(item.match + "/");
}

export function SiteHeader({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-foreground"
        >
          <Image
            src="/logo.svg"
            alt="Wardly"
            width={28}
            height={28}
            className="size-7"
          />
          <span className="hidden sm:inline">Wardly</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Button
                key={item.label}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex items-center gap-1 text-muted-foreground hover:text-foreground",
                  (pathname === "/meetings" ||
                    pathname.startsWith("/meetings/")) &&
                    "text-foreground",
                )}
              >
                Meetings
                <IconChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {MEETING_LINKS.map((meeting) => {
                const active =
                  pathname === meeting.href ||
                  pathname.startsWith(meeting.href + "/");
                return (
                  <DropdownMenuItem key={meeting.href} asChild>
                    <Link
                      href={meeting.href}
                      className={cn(active && "font-medium")}
                    >
                      {meeting.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-2"
            >
              <Avatar size="sm">
                <AvatarFallback>{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate sm:inline">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal">
              {userName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/logout" >
                <IconLogout />
                Log out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
