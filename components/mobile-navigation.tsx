"use client";

import { Fragment } from "react";
import Link from "next/link";
import { IconMenu2 } from "@tabler/icons-react";
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
import { getNavigationCurrent, NAVIGATION_ITEMS } from "@/components/site-navigation";
import { cn } from "@/lib/utils";

export function MobileNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main navigation" className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="min-h-11">
            <IconMenu2 data-icon="inline-start" />
            Menu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" collisionPadding={8} className="w-64 max-w-[calc(100vw-1rem)]">
          <DropdownMenuGroup>
            {NAVIGATION_ITEMS.filter((item) => item.kind === "link").map((link) => {
              const current = getNavigationCurrent({ pathname, path: link.href });
              return (
                <DropdownMenuItem key={link.href} asChild className={cn("min-h-11", current && "bg-accent font-medium")}>
                  <Link href={link.href} aria-current={current}>{link.label}</Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          {NAVIGATION_ITEMS.filter((item) => item.kind === "group").map((group) => (
            <Fragment key={group.label}>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.items.map((link) => {
                  const current = getNavigationCurrent({ pathname, path: link.href });
                  return (
                    <DropdownMenuItem key={link.href} asChild className={cn("min-h-11", current && "bg-accent font-medium")}>
                      <Link href={link.href} aria-current={current}>{link.label}</Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
