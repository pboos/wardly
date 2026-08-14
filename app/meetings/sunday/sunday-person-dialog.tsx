"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
  SundayMeetingAssignment,
  SundayMeetingAssignmentInput,
  SundayMeetingMemberHistory,
  SundayMeetingVisitorRole,
} from "@/lib/sunday-meetings/types";
import { VISITOR_ROLE_LABELS } from "@/lib/sunday-meetings/types";

type PersonRoleWithHistory = "speaker" | "prayer" | null;

export function SundayPersonDialog({
  assignment,
  members,
  title,
  triggerLabel,
  roleWithHistory = null,
  visitor = false,
  triggerVariant = "ghost",
  triggerClassName,
  onSave,
  onRemove,
}: {
  assignment: SundayMeetingAssignment | null;
  members: SundayMeetingMemberHistory[];
  title: string;
  triggerLabel?: string;
  roleWithHistory?: PersonRoleWithHistory;
  visitor?: boolean;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerClassName?: string;
  onSave: (input: SundayMeetingAssignmentInput) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [freeText, setFreeText] = useState(Boolean(assignment?.freeTextName));
  const [memberId, setMemberId] = useState<string | null>(
    assignment?.memberId ?? null,
  );
  const [freeTextName, setFreeTextName] = useState(
    assignment?.freeTextName ?? "",
  );
  const [visitorRole, setVisitorRole] = useState<SundayMeetingVisitorRole | null>(
    assignment?.visitorRole ?? null,
  );
  const [visitorRoleCustom, setVisitorRoleCustom] = useState(
    assignment?.visitorRoleCustom ?? "",
  );
  const [isPresidingOverride, setIsPresidingOverride] = useState(
    assignment?.isPresidingOverride ?? false,
  );

  const memberItems = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));
  const selectedMember = members.find((member) => member.id === memberId) ?? null;

  function resetDraft() {
    setFreeText(Boolean(assignment?.freeTextName));
    setMemberId(assignment?.memberId ?? null);
    setFreeTextName(assignment?.freeTextName ?? "");
    setVisitorRole(assignment?.visitorRole ?? null);
    setVisitorRoleCustom(assignment?.visitorRoleCustom ?? "");
    setIsPresidingOverride(assignment?.isPresidingOverride ?? false);
  }

  function handleSave() {
    const input: SundayMeetingAssignmentInput = {
      memberId: freeText ? null : memberId,
      freeTextName: freeText ? freeTextName : null,
      ...(visitor
        ? {
            visitorRole,
            visitorRoleCustom,
            isPresidingOverride,
          }
        : {}),
    };
    startTransition(async () => {
      try {
        await onSave(input);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save person.");
      }
    });
  }

  function handleRemove() {
    if (!onRemove) return;
    startTransition(async () => {
      try {
        await onRemove();
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
        {assignment?.name ?? (
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

            {history && (
              <p className="text-sm text-muted-foreground">
                Latest past: {history.last ? history.last.date : "Never"}. Upcoming: {history.next ? history.next.date : "None"}.
              </p>
            )}

            {visitor && (
              <>
                <Field>
                  <FieldLabel htmlFor={`${id}-visitor-role`}>Visitor role</FieldLabel>
                  <Select
                    value={visitorRole ?? "none"}
                    onValueChange={(value) =>
                      setVisitorRole(
                        value === "none" ? null : (value as SundayMeetingVisitorRole),
                      )
                    }
                  >
                    <SelectTrigger id={`${id}-visitor-role`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">No role specified</SelectItem>
                        {Object.entries(VISITOR_ROLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {visitorRole === "custom" && (
                  <Field>
                    <FieldLabel htmlFor={`${id}-visitor-custom-role`}>
                      Custom role
                    </FieldLabel>
                    <Input
                      id={`${id}-visitor-custom-role`}
                      value={visitorRoleCustom}
                      onChange={(event) => setVisitorRoleCustom(event.target.value)}
                      placeholder="Role or title"
                    />
                  </Field>
                )}

                <Field orientation="horizontal">
                  <Checkbox
                    id={`${id}-presiding`}
                    checked={isPresidingOverride}
                    onCheckedChange={(checked) => setIsPresidingOverride(checked === true)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={`${id}-presiding`}>
                      This visitor presides
                    </FieldLabel>
                  </FieldContent>
                </Field>
              </>
            )}
          </FieldGroup>
          <DialogFooter>
            {onRemove && (
              <Button type="button" variant="destructive" onClick={handleRemove}>
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
