"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import type {
  SundayMeetingItem,
  SundayMeetingMemberHistory,
  SundayPersonInput,
} from "@/lib/sunday-meetings/types";

type HistoryRole = "speaker" | "prayer" | null;

/**
 * Dialog for the person (and optional detail text) of one agenda item.
 * `item` is null when the backing row does not exist yet — the parent's
 * onSave/onDelete wire the add/update/delete item actions.
 */
export function SundayPersonDialog({
  item,
  members,
  title,
  triggerLabel,
  detailLabel,
  roleWithHistory = null,
  triggerVariant = "ghost",
  triggerClassName,
  onSave,
  onDelete,
}: {
  item: SundayMeetingItem | null;
  members: SundayMeetingMemberHistory[];
  title: string;
  triggerLabel?: string;
  /** Label of the optional single-line detail field saved as item content. */
  detailLabel?: string;
  roleWithHistory?: HistoryRole;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerClassName?: string;
  onSave: (person: SundayPersonInput, roleText: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [freeText, setFreeText] = useState(Boolean(item?.personName));
  const [memberId, setMemberId] = useState<string | null>(
    item?.personMemberId ?? null,
  );
  const [freeTextName, setFreeTextName] = useState(item?.personName ?? "");
  const [detail, setDetail] = useState(item?.content ?? "");

  const memberItems = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));
  const selectedMember = members.find((member) => member.id === memberId) ?? null;

  function resetDraft() {
    setFreeText(Boolean(item?.personName));
    setMemberId(item?.personMemberId ?? null);
    setFreeTextName(item?.personName ?? "");
    setDetail(item?.content ?? "");
  }

  function handleSave() {
    const person: SundayPersonInput = freeText
      ? { memberId: null, personName: freeTextName }
      : { memberId, personName: null };
    const roleText = detail.trim() || null;
    startTransition(async () => {
      try {
        await onSave(person, roleText);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save person.");
      }
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    startTransition(async () => {
      try {
        await onDelete();
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove person.");
      }
    });
  }

  const history = selectedMember && roleWithHistory
    ? roleWithHistory === "speaker"
      ? { last: selectedMember.lastTalk, next: selectedMember.nextTalk }
      : { last: selectedMember.lastPrayer, next: selectedMember.nextPrayer }
    : null;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        className={triggerClassName}
        onClick={() => {
          resetDraft();
          setOpen(true);
        }}
      >
        {item?.personNameResolved ?? (
          <>
            <IconPlus data-icon="inline-start" />
            {triggerLabel ?? "Assign"}
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-person-source`}>Person source</FieldLabel>
              <Select
                value={freeText ? "free-text" : "member"}
                onValueChange={(value) => setFreeText(value === "free-text")}
              >
                <SelectTrigger id={`${id}-person-source`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="member">Ward member</SelectItem>
                    <SelectItem value="free-text">Free-text name</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {freeText ? (
              <Field>
                <FieldLabel htmlFor={`${id}-free-text-name`}>Name</FieldLabel>
                <Input
                  id={`${id}-free-text-name`}
                  value={freeTextName}
                  onChange={(event) => setFreeTextName(event.target.value)}
                  placeholder="Visitor, missionary, or other name"
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor={`${id}-member`}>Ward member</FieldLabel>
                <Combobox
                  id={`${id}-member`}
                  items={memberItems}
                  value={memberId}
                  onChange={setMemberId}
                  placeholder="Search members"
                  searchPlaceholder="Search partial names..."
                  emptyText="No members found."
                  clearable
                  clearLabel="No member"
                />
              </Field>
            )}

            {detailLabel && (
              <Field>
                <FieldLabel htmlFor={`${id}-detail`}>{detailLabel}</FieldLabel>
                <Input
                  id={`${id}-detail`}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder={detailLabel}
                />
              </Field>
            )}

            {history && (
              <p className="text-sm text-muted-foreground">
                Latest past: {history.last ? history.last.date : "Never"}. Upcoming: {history.next ? history.next.date : "None"}.
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            {onDelete && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                <IconTrash data-icon="inline-start" />
                Remove
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
