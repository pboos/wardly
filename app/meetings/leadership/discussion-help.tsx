"use client";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MarkdownInstructions } from "./markdown-instructions";

export function DiscussionHelp({ instructions }: { instructions: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Discussion instructions">
          <CircleHelp />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60dvh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto">
        <h2 className="font-medium">Instructions</h2>
        {instructions ? <MarkdownInstructions>{instructions}</MarkdownInstructions> : (
          <p className="text-muted-foreground">No instructions yet. Add them in setup.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
