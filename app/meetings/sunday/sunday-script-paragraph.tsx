import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { ScriptParagraph, ScriptSpan } from "@/lib/sunday-meetings/leading-script";

function renderSpans(spans: readonly ScriptSpan[]) {
  return spans.map((span, index) => {
    switch (span.kind) {
      case "name":
        return <strong key={index} className="rounded bg-accent px-1 font-semibold text-accent-foreground">{span.text}</strong>;
      case "missing":
        return <span key={index} className="font-semibold text-destructive">{span.text}</span>;
      case "text":
        return <span key={index}>{span.text}</span>;
    }
  });
}

export function SundayScriptParagraph({ paragraph }: { paragraph: ScriptParagraph }) {
  const textClass = "whitespace-pre-wrap break-words text-lg leading-relaxed sm:text-xl";
  switch (paragraph.kind) {
    case "rule":
      return <Separator />;
    case "heading":
      return <h3 className="text-lg font-semibold sm:text-xl">{renderSpans(paragraph.spans)}</h3>;
    case "list":
      return (
        <ul className={cn(textClass, "flex flex-col gap-2")}>
          {paragraph.rows.map((row, index) => <li key={index}>{renderSpans(row)}</li>)}
        </ul>
      );
    case "spoken":
      return <p className={textClass}>{renderSpans(paragraph.spans)}</p>;
    default: {
      const exhaustive: never = paragraph;
      return exhaustive;
    }
  }
}
