"use client";

import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavigationCurrent, NAVIGATION_ITEMS } from "@/components/site-navigation";
import { cn } from "@/lib/utils";

export function DesktopNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
      {NAVIGATION_ITEMS.map((item) => {
        if (item.kind === "link") {
          const current = getNavigationCurrent({ pathname, path: item.href });
          return (
            <Button key={item.href} variant={current ? "secondary" : "ghost"} size="sm" asChild>
              <Link href={item.href} aria-current={current}>{item.label}</Link>
            </Button>
          );
        }

        const active = getNavigationCurrent({ pathname, path: item.match });
        return (
          <DropdownMenu key={item.label}>
            <DropdownMenuTrigger asChild>
              <Button variant={active ? "secondary" : "ghost"} size="sm">
                {item.label}
                <IconChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" collisionPadding={8} className="w-48 max-w-[calc(100vw-1rem)]">
              <DropdownMenuGroup>
                {item.items.map((link) => {
                  const current = getNavigationCurrent({ pathname, path: link.href });
                  return (
                    <DropdownMenuItem key={link.href} asChild className={cn("min-h-11", current && "bg-accent font-medium")}>
                      <Link href={link.href} aria-current={current}>{link.label}</Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
