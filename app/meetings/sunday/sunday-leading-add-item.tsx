"use client";

import { useId, useState, useTransition } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SundayHymnPicker } from "./sunday-hymn-picker";
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
import { addableAgendaItemTypes } from "@/lib/sunday-meetings/add-item-rules";
import { addSundayAgendaItem } from "./actions";
import { ITEM_LABELS, SECTION_LABELS } from "./sunday-leading-labels";

/** Adds an extra item to the section that opened the dialog. */
export function AddAgendaItemDialog({
  meeting,
  section,
  disabled = false,
}: {
  meeting: SundayMeeting;
  section: Exclude<SundayMeetingSection, "participants">;
  disabled?: boolean;
}) {
  const id = useId();
  const itemTypes = addableAgendaItemTypes(section);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SundayMeetingItemType>(itemTypes[0]);
  const [content, setContent] = useState("");
  const [hymnNumber, setHymnNumber] = useState("");

  function save() {
    const trimmedHymn = hymnNumber.trim();
    startTransition(async () => {
      try {
        await addSundayAgendaItem(meeting.id, {
          type,
          section,
          content: supportsContent
            ? content.trim() ||
              (type === "musical_number" ? "Musical number" : null)
            : null,
          // Only hymns carry a hymn number — never leak one entered while
          // an earlier type selection had the hymn field open.
          metadata:
            type === "hymn" && trimmedHymn
              ? { hymnNumber: Number(trimmedHymn) }
              : undefined,
        });
        setOpen(false);
        setContent("");
        setHymnNumber("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add agenda item.",
        );
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={disabled || pending}
          aria-label={`Add item to ${SECTION_LABELS[section]}`}
        >
          <IconPlus />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add item to {SECTION_LABELS[section]}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-type`}>Item type</FieldLabel>
            <Select
              value={type}
              onValueChange={(value) => setType(value as SundayMeetingItemType)}
            >
              <SelectTrigger id={`${id}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {itemTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ITEM_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {type === "hymn" && (
            <Field>
              <FieldLabel>Hymn number</FieldLabel>
              <SundayHymnPicker
                item={
                  hymnNumber
                    ? {
                        type: "hymn",
                        metadata: { hymnNumber: Number(hymnNumber) },
                        content: null,
                        personNameResolved: null,
                      }
                    : null
                }
                allowMusicalNumber={false}
                onSave={async (input) => {
                  setHymnNumber(input.metadata?.hymnNumber?.toString() ?? "");
                }}
              />
            </Field>
          )}
          {supportsContent && (
            <Field>
              <FieldLabel htmlFor={`${id}-content`}>Details</FieldLabel>
              <Textarea
                id={`${id}-content`}
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={
                  type === "musical_number"
                    ? "Musical number details and performer names"
                    : "Optional details"
                }
              />
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
