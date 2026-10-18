"use client";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DiscussionNotes({
  notes, sharedNotes, hasSharedNotes, pending, dirty, onNotes, onSharedNotes,
}: {
  notes: string;
  sharedNotes: string;
  hasSharedNotes: boolean;
  pending: boolean;
  dirty: boolean;
  onNotes: (value: string) => void;
  onSharedNotes: (value: string) => void;
}) {
  const meetingField = (
    <Field>
      <FieldLabel htmlFor="discussion-notes" className="sr-only">This meeting notes</FieldLabel>
      <Textarea id="discussion-notes" disabled={pending} rows={5} maxLength={4000}
        placeholder="Decisions and notes from this meeting…"
        value={notes} onChange={(event) => onNotes(event.target.value)} />
      <FieldDescription>Notes for this meeting only.</FieldDescription>
    </Field>
  );
  return (
    <section aria-label="Discussion notes" className="flex min-w-0 flex-col gap-2">
      {hasSharedNotes ? (
        <Tabs defaultValue="meeting" className="min-w-0 gap-3">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="meeting">This meeting</TabsTrigger>
            <TabsTrigger value="shared">Shared notes</TabsTrigger>
          </TabsList>
          <TabsContent value="meeting">{meetingField}</TabsContent>
          <TabsContent value="shared">
            <Field>
              <FieldLabel htmlFor="shared-discussion-notes" className="sr-only">Shared notes</FieldLabel>
              <Textarea id="shared-discussion-notes" disabled={pending} rows={5} maxLength={4000}
                placeholder="Keep useful context for future meetings…"
                value={sharedNotes} onChange={(event) => onSharedNotes(event.target.value)} />
              <FieldDescription>Current notes shared across every meeting of this topic. These are not historical snapshots.</FieldDescription>
            </Field>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">This meeting</h2>
          {meetingField}
        </div>
      )}
      <span role="status" className="text-xs text-muted-foreground">
        {pending ? "Saving…" : dirty ? "Unsaved notes" : "Notes saved"}
      </span>
    </section>
  );
}
