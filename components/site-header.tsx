"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { DesktopNavigation } from "@/components/desktop-navigation";
import { MobileNavigation } from "@/components/mobile-navigation";
import { IconLogout } from "@tabler/icons-react";

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

        <div className="flex min-w-0 flex-1 items-center">
          <DesktopNavigation pathname={pathname} />
          <MobileNavigation pathname={pathname} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex min-h-11 items-center gap-2 px-2"
              aria-label={`Account menu for ${userName}`}
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
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="min-h-11">
                <a href="/logout">
                  <IconLogout />
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
