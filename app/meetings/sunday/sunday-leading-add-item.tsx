"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  SundayMeeting,
  SundayMeetingItemType,
  SundayMeetingSection,
} from "@/lib/sunday-meetings/types";
import { AGENDA_SECTIONS } from "@/lib/sunday-meetings/agenda";
import { addSundayAgendaItem } from "./actions";
import { ADDABLE_ITEM_TYPES, ITEM_LABELS, SECTION_LABELS } from "./sunday-leading-labels";

/** Adds one explicit agenda item with type, section, and optional data. */
export function AddAgendaItemDialog({ meeting }: { meeting: SundayMeeting }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SundayMeetingItemType>("custom_program");
  const [section, setSection] = useState<SundayMeetingSection>("program");
  const [content, setContent] = useState("");
  const [hymnNumber, setHymnNumber] = useState("");

  function save() {
    const trimmedHymn = hymnNumber.trim();
    startTransition(async () => {
      try {
        await addSundayAgendaItem(meeting.id, {
          type,
          section,
          content: content.trim() || null,
          // Only hymns carry a hymn number — never leak one entered while
          // an earlier type selection had the hymn field open.
          metadata: type === "hymn" && trimmedHymn
            ? { hymnNumber: Number(trimmedHymn) }
            : undefined,
        });
        setOpen(false);
        setContent("");
        setHymnNumber("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add agenda item.");
      }
    });
  }

  const supportsContent = ![
    "hymn",
    "prayer",
    "sacrament_blessing",
    "sacrament_passing",
    "transition",
  ].includes(type);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <IconPlus data-icon="inline-start" />
        Add agenda item
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add agenda item</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-agenda-item-type">Item type</FieldLabel>
              <Select value={type} onValueChange={(value) => setType(value as SundayMeetingItemType)}>
                <SelectTrigger id="new-agenda-item-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ADDABLE_ITEM_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>{ITEM_LABELS[value]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-agenda-item-section">Section</FieldLabel>
              <Select value={section} onValueChange={(value) => setSection(value as SundayMeetingSection)}>
                <SelectTrigger id="new-agenda-item-section" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AGENDA_SECTIONS.map((value) => (
                      <SelectItem key={value} value={value}>{SECTION_LABELS[value]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {type === "hymn" && (
              <Field>
                <FieldLabel htmlFor="new-agenda-item-hymn">Hymn number</FieldLabel>
                <Input
                  id="new-agenda-item-hymn"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={hymnNumber}
                  onChange={(event) => setHymnNumber(event.target.value)}
                />
              </Field>
            )}
            {supportsContent && (
              <Field>
                <FieldLabel htmlFor="new-agenda-item-content">Details</FieldLabel>
                <Textarea
                  id="new-agenda-item-content"
                  rows={4}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Optional details"
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save}>Add item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
