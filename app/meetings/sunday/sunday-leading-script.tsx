import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LeadingScript } from "@/lib/sunday-meetings/leading-script";
import { SundayScriptParagraph } from "./sunday-script-paragraph";

export function SundayLeadingScript({ date, script }: { date: string; script: LeadingScript }) {
  const formattedDate = new Intl.DateTimeFormat(script.locale, {
    dateStyle: "full", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <article lang={script.locale} className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-16">
      <header className="flex flex-col items-start gap-3">
        <Button variant="outline" asChild>
          <Link href={`/meetings/sunday/${date}`}>{script.editLabel}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{script.title}</h1>
      </header>
      {script.notice && (
        <Alert><AlertDescription>{script.notice}</AlertDescription></Alert>
      )}
      {script.kind === "nonlocal" ? (
        <Alert><AlertDescription>{script.message}</AlertDescription></Alert>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {script.introduction.map((paragraph, index) => (
              <SundayScriptParagraph key={index} paragraph={paragraph} />
            ))}
          </div>
          {script.sections.map(section => (
            <section
              key={section.section}
              aria-labelledby={`section-${section.section}`}
              className="flex flex-col gap-6"
            >
              <Separator />
              <h2 id={`section-${section.section}`} className="text-xl font-semibold">
                {section.title}
              </h2>
              {section.blocks.map(block => (
                <div key={block.id} data-item-id={block.id} className="flex flex-col gap-5">
                  {block.paragraphs.map((paragraph, index) => (
                    <SundayScriptParagraph key={index} paragraph={paragraph} />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </article>
  );
}
