"use client";
import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import type { PreviousMeetingNotes as NotesPage } from "@/lib/leadership-meetings/history";
import type { HistoryCursor } from "@/lib/leadership-meetings/types";
import { previousLeadershipMeetingNotes } from "./actions";

export function PreviousMeetingNotes({ itemId }: { itemId: string }) {
  const mutation = useAppMutation(previousLeadershipMeetingNotes);
  const [page, setPage] = useState<NotesPage | null>(null);
  const [opened, setOpened] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  async function load(cursor: HistoryCursor | null) {
    if (loading) return;
    const sequence = ++request.current;
    setOpened(true);
    setRequested(true);
    setLoading(true);
    setError("");
    try {
      const result = await mutation.execute({ itemId, cursor });
      if (!active.current || sequence !== request.current) return;
      setPage((current) => ({
        items: cursor && current ? [...current.items, ...result.items] : result.items,
        nextCursor: result.nextCursor,
      }));
    } catch (cause) {
      if (active.current && sequence === request.current)
        setError(cause instanceof Error ? cause.message : "Unable to load previous notes.");
    } finally {
      if (active.current && sequence === request.current) setLoading(false);
    }
  }
  return (
    <section aria-label="Previous meeting notes" className="flex min-w-0 flex-col gap-3">
      <Button variant="ghost" size="sm" className="self-start" aria-expanded={opened}
        onClick={() => {
          if (!requested) void load(null);
          else setOpened(!opened);
        }}>
        <History data-icon="inline-start" />Previous meeting notes
      </Button>
      {opened && (
        <>
          {page?.items.map((item) => (
            <article key={item.id} className="flex min-w-0 flex-col gap-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <time dateTime={item.date}>{item.date}</time><span>{item.outcome}</span>
              </div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="whitespace-pre-wrap break-words">{item.notes}</p>
            </article>
          ))}
          {page?.items.length === 0 && <p className="text-sm text-muted-foreground">No previous meeting notes for this topic.</p>}
          {loading && <p role="status" className="text-sm text-muted-foreground">Loading previous notes…</p>}
          {error && (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void load(page?.nextCursor ?? null)}>Retry previous notes</Button>
            </div>
          )}
          {page?.nextCursor && !error && (
            <Button variant="outline" size="sm" className="self-start" disabled={loading} onClick={() => void load(page.nextCursor)}>Load more notes</Button>
          )}
        </>
      )}
    </section>
  );
}
