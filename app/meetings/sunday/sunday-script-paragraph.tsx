import type { ScriptParagraph } from "@/lib/sunday-meetings/leading-script";
import { cn } from "@/lib/utils";

export function SundayScriptParagraph({ paragraph }: { paragraph: ScriptParagraph }) {
  const isCue = paragraph.kind === "cue";
  return (
    <p className={cn(
      "whitespace-pre-wrap break-words",
      isCue ? "text-base italic text-muted-foreground" : "text-lg leading-relaxed sm:text-xl",
    )}>
      {isCue && "("}
      {paragraph.spans.map((span, index) => {
        switch (span.kind) {
          case "name":
            return <strong key={index} className="rounded bg-accent px-1 font-semibold text-accent-foreground">{span.text}</strong>;
          case "missing":
            return <span key={index} className="font-semibold text-destructive">{span.text}</span>;
          case "text":
            return <span key={index}>{span.text}</span>;
        }
      })}
      {isCue && ")"}
    </p>
  );
}
