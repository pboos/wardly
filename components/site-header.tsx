"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";

type NavChild = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href: string;
  /** Prefix used to detect the active section. */
  match: string;
  children?: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Members", href: "/members", match: "/members" },
  { label: "Tasks", href: "/tasks", match: "/tasks" },
  {
    label: "Meetings",
    href: "/meetings",
    match: "/meetings",
    children: [
      { label: "Bishopric", href: "/meetings/bishopric" },
      { label: "Ward council", href: "/meetings/ward-council" },
    ],
  },
  {
    label: "Admin",
    href: "/admin",
    match: "/admin",
    children: [
      { label: "Users", href: "/admin/users" },
      { label: "Sync", href: "/admin/sync" },
    ],
  },
];

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

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            if (item.children) {
              return (
                <DropdownMenu key={item.label}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-1 text-muted-foreground hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {item.label}
                      <IconChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href ||
                        pathname.startsWith(child.href + "/");
                      return (
                        <DropdownMenuItem key={child.href} asChild>
                          <Link
                            href={child.href}
                            className={cn(childActive && "font-medium")}
                          >
                            {child.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
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
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-2"
            >
              <UserAvatar name={userName} size="sm" />
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
