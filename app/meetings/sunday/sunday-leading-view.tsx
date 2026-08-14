"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ITEM_ROLE_BY_TYPE,
  SUNDAY_MEETING_ITEM_TYPES,
  SUNDAY_MEETING_TASK_ITEM_TYPES,
  SUNDAY_MEETING_SECTIONS,
  SUNDAY_MEETING_TYPE_LABELS,
  isCarryForwardEligible,
  type SundayMeeting,
  type SundayMeetingItem,
  type SundayMeetingItemAssignmentRole,
  type SundayMeetingItemType,
  type SundayMeetingMemberHistory,
  type SundayMeetingSection,
  type SundayMeetingSupportText,
  type SundayMeetingTaskCandidateGroup,
} from "@/lib/sunday-meetings/types";
import {
  addSuggestedSundayTask,
  addSundayAgendaItem,
  addSundayItemPerson,
  addSundayMeetingPerson,
  carrySundayAgendaItemForward,
  deleteSundayAgendaItem,
  removeSundayPerson,
  reorderSundayAgenda,
  setSundayMeetingLeader,
  updateSundayAgendaItem,
  updateSundayPerson,
} from "./actions";
import { SundayPersonDialog } from "./sunday-person-dialog";

type LeadingData = {
  meeting: SundayMeeting;
  contentLocale: string;
  timeZone: string;
  isLocal: boolean;
  isReadyToLead: boolean;
  supportText: SundayMeetingSupportText[];
  taskCandidates: SundayMeetingTaskCandidateGroup[];
  memberHistory: SundayMeetingMemberHistory[];
};

const ITEM_LABELS: Record<SundayMeetingItemType, string> = {
  hymn: "Hymn",
  prayer: "Prayer",
  talk: "Talk",
  sacrament_blessing: "Blessing the sacrament",
  sacrament_passing: "Passing the sacrament",
  musical_number: "Musical number",
  primary_presentation: "Primary presentation",
  calling_sustain: "Calling sustain",
  calling_release: "Calling release",
  priesthood_aaronic_inform: "Aaronic Priesthood information",
  child_naming_blessing: "Naming and blessing a child",
  member_welcome: "Member welcome",
  convert_confirmation: "Convert confirmation",
  announcement: "Announcement",
  ward_business: "Ward business",
  custom_program: "Custom program item",
  transition: "Transition",
  conductor_text: "Conductor text",
};

const ROLE_LABELS: Record<SundayMeetingItemAssignmentRole, string> = {
  prayer: "Prayer",
  speaker: "Speaker",
  sacrament_blesser: "Sacrament blesser",
  sacrament_passer: "Sacrament passer",
  performer: "Performer",
  subject: "Subject",
  officiant: "Officiant",
};

export function SundayLeadingView({ data }: { data: LeadingData }) {
  const { meeting } = data;
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The agreed leading default keeps supporting wording out of the way.
  const [showSupportText, setShowSupportText] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function run(action: () => Promise<unknown>, fallback: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallback, {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  const previousDate = shiftSunday(meeting.date, -7);
  const nextDate = shiftSunday(meeting.date, 7);
  const meetingSupport = data.supportText.filter(
    (block) => block.position === "meeting",
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/leading?date=${previousDate}`}>
              <IconArrowLeft data-icon="inline-start" />
              Previous Sunday
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday/leading?date=${nextDate}`}>
              Next Sunday
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{formatDate(meeting.date)}</p>
          <h1 className="text-2xl font-semibold text-foreground">
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showSupportText}
            onClick={() => setShowSupportText((current) => !current)}
          >
            {showSupportText ? (
              <IconEyeOff data-icon="inline-start" />
            ) : (
              <IconEye data-icon="inline-start" />
            )}
            {showSupportText ? "Hide support text" : "Show support text"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "Hide assignment history" : "Show assignment history"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/sunday?anchor=${meeting.date}`}>Schedule</Link>
          </Button>
        </div>
      </header>

      {!data.isLocal ? (
        <Alert>
          <AlertTitle>No local agenda</AlertTitle>
          <AlertDescription>
            {SUNDAY_MEETING_TYPE_LABELS[meeting.type]} is recorded as a date and type only.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!data.isReadyToLead && (
            <Alert>
              <AlertTitle>Choose a meeting leader</AlertTitle>
              <AlertDescription>
                A local meeting needs one leader before it is ready to lead.
              </AlertDescription>
            </Alert>
          )}

          <MeetingContextCard
            meeting={meeting}
            members={data.memberHistory}
            showSupportText={showSupportText}
            supportText={meetingSupport}
          />

          {showHistory && <AssignmentHistoryCard members={data.memberHistory} />}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Agenda</h2>
              <AddAgendaItemDialog meeting={meeting} />
            </div>
            <ol className="flex flex-col gap-3">
              {meeting.items.map((item, index) => (
                <AgendaEntry
                  key={item.id}
                  item={item}
                  meeting={meeting}
                  itemIndex={index}
                  members={data.memberHistory}
                  showSupportText={showSupportText}
                  supportText={data.supportText.filter(
                    (block) => block.position === "before_item" && block.itemId === item.id,
                  )}
                  run={run}
                />
              ))}
            </ol>
          </section>

          <SuggestedTasksCard groups={data.taskCandidates} meetingId={meeting.id} run={run} />
        </>
      )}
    </div>
  );
}

function MeetingContextCard({
  meeting,
  members,
  showSupportText,
  supportText,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
}) {
  const leader = meeting.assignments.find((assignment) => assignment.role === "leader") ?? null;
  const visitors = meeting.assignments.filter((assignment) => assignment.role === "visitor");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting context</CardTitle>
        {meeting.information && <CardDescription>{meeting.information}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ContextRow label="Leader">
          <SundayPersonDialog
            assignment={leader}
            members={members}
            title="Meeting leader"
            triggerLabel="Assign leader"
            onSave={(input) => setSundayMeetingLeader(meeting.id, input)}
            onRemove={leader ? () => setSundayMeetingLeader(meeting.id, null) : undefined}
          />
        </ContextRow>
        <ContextPeople
          meeting={meeting}
          members={members}
          role="organist"
          label="Organists"
        />
        <ContextPeople
          meeting={meeting}
          members={members}
          role="music_conductor"
          label="Music conductors"
        />
        <ContextRow label="Visitors">
          <div className="flex flex-wrap gap-2">
            {visitors.map((visitor) => (
              <SundayPersonDialog
                key={visitor.id}
                assignment={visitor}
                members={members}
                title="Visitor"
                visitor
                triggerVariant="secondary"
                onSave={(input) => updateSundayPerson(visitor.id, input)}
                onRemove={() => removeSundayPerson(visitor.id)}
              />
            ))}
            <SundayPersonDialog
              assignment={null}
              members={members}
              title="Visitor"
              triggerLabel="Add visitor"
              visitor
              triggerVariant="outline"
              onSave={(input) => addSundayMeetingPerson(meeting.id, "visitor", input).then(() => undefined)}
            />
          </div>
        </ContextRow>
        <ContextRow label="Presiding">
          <span className="text-sm">
            {meeting.presider?.name ?? "No presiding visitor selected"}
          </span>
        </ContextRow>
        {showSupportText && supportText.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {supportText.map((block) => (
              <p key={block.id}>{block.text}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContextRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-sm font-medium sm:w-36">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ContextPeople({
  meeting,
  members,
  role,
  label,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  role: "organist" | "music_conductor";
  label: string;
}) {
  const assignments = meeting.assignments.filter((assignment) => assignment.role === role);
  return (
    <ContextRow label={label}>
      <div className="flex flex-wrap gap-2">
        {assignments.map((assignment) => (
          <SundayPersonDialog
            key={assignment.id}
            assignment={assignment}
            members={members}
            title={label}
            triggerVariant="secondary"
            onSave={(input) => updateSundayPerson(assignment.id, input)}
            onRemove={() => removeSundayPerson(assignment.id)}
          />
        ))}
        <SundayPersonDialog
          assignment={null}
          members={members}
          title={label}
          triggerLabel={`Add ${label.slice(0, -1).toLowerCase()}`}
          triggerVariant="outline"
          onSave={(input) => addSundayMeetingPerson(meeting.id, role, input).then(() => undefined)}
        />
      </div>
    </ContextRow>
  );
}

function AgendaEntry({
  item,
  meeting,
  itemIndex,
  members,
  showSupportText,
  supportText,
  run,
}: {
  item: SundayMeetingItem;
  meeting: SundayMeeting;
  itemIndex: number;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  if (item.type === "transition") {
    const orderIds = meeting.items.map((entry) => entry.id);
    return (
      <li className="flex items-center gap-2 py-3" aria-label="Agenda transition">
        <Separator className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move transition earlier"
          disabled={itemIndex === 0}
          onClick={() => {
            const next = [...orderIds];
            [next[itemIndex - 1], next[itemIndex]] = [next[itemIndex], next[itemIndex - 1]];
            run(() => reorderSundayAgenda(meeting.id, next), "Could not reorder agenda.");
          }}
        >
          <IconChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move transition later"
          disabled={itemIndex === meeting.items.length - 1}
          onClick={() => {
            const next = [...orderIds];
            [next[itemIndex], next[itemIndex + 1]] = [next[itemIndex + 1], next[itemIndex]];
            run(() => reorderSundayAgenda(meeting.id, next), "Could not reorder agenda.");
          }}
        >
          <IconChevronDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete transition"
          onClick={() => run(() => deleteSundayAgendaItem(item.id), "Could not delete transition.")}
        >
          <IconTrash />
        </Button>
      </li>
    );
  }
  if (item.type === "conductor_text" && !showSupportText) {
    return null;
  }

  const roleAssignments = ITEM_ROLE_BY_TYPE[item.type];
  const isCustom = item.standardSlot === null;
  const orderIds = meeting.items.map((entry) => entry.id);

  return (
    <li className="flex flex-col gap-2">
      {showSupportText && supportText.map((block) => (
        <p key={block.id} className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {block.text}
        </p>
      ))}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-base">{agendaTitle(item)}</CardTitle>
              <CardDescription>{agendaDetail(item)}</CardDescription>
            </div>
            <Badge variant={item.standardSlot ? "outline" : "secondary"}>
              {item.section}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.type === "prayer" && (
              <PersonRoleEditor item={item} role="prayer" members={members} />
            )}
            {item.type === "talk" && (
              <>
                <PersonRoleEditor item={item} role="speaker" members={members} />
                <ItemTextDialog item={item} label="Talk topic" />
              </>
            )}
            {item.type !== "prayer" && item.type !== "talk" && item.type !== "hymn" && (
              <ItemTextDialog item={item} label="Item details" />
            )}
            {isCarryForwardEligible(item.type) && (
              <CarryForwardButton item={item} />
            )}
            {isCustom && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move agenda item earlier"
                  disabled={itemIndex === 0}
                  onClick={() => {
                    const next = [...orderIds];
                    [next[itemIndex - 1], next[itemIndex]] = [next[itemIndex], next[itemIndex - 1]];
                    run(() => reorderSundayAgenda(meeting.id, next), "Could not reorder agenda.");
                  }}
                >
                  <IconChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move agenda item later"
                  disabled={itemIndex === meeting.items.length - 1}
                  onClick={() => {
                    const next = [...orderIds];
                    [next[itemIndex], next[itemIndex + 1]] = [next[itemIndex + 1], next[itemIndex]];
                    run(() => reorderSundayAgenda(meeting.id, next), "Could not reorder agenda.");
                  }}
                >
                  <IconChevronDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete agenda item"
                  onClick={() => run(() => deleteSundayAgendaItem(item.id), "Could not delete agenda item.")}
                >
                  <IconTrash />
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        {roleAssignments.length > 0 && (
          <CardContent className="flex flex-col gap-4">
            {roleAssignments.map((role) => (
              <AgendaPeople
                key={role}
                item={item}
                role={role}
                members={members}
              />
            ))}
          </CardContent>
        )}
      </Card>
    </li>
  );
}

function AgendaPeople({
  item,
  role,
  members,
}: {
  item: SundayMeetingItem;
  role: SundayMeetingItemAssignmentRole;
  members: SundayMeetingMemberHistory[];
}) {
  const assignments = item.assignments.filter((assignment) => assignment.role === role);
  const single = role === "prayer" || role === "speaker";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
      <div className="flex flex-wrap gap-2">
        {assignments.map((assignment) => (
          <SundayPersonDialog
            key={assignment.id}
            assignment={assignment}
            members={members}
            title={ROLE_LABELS[role]}
            roleWithHistory={role === "speaker" || role === "prayer" ? role : null}
            triggerVariant="secondary"
            onSave={(input) => updateSundayPerson(assignment.id, input)}
            onRemove={() => removeSundayPerson(assignment.id)}
          />
        ))}
        {(!single || assignments.length === 0) && (
          <SundayPersonDialog
            assignment={null}
            members={members}
            title={ROLE_LABELS[role]}
            triggerLabel={`Add ${ROLE_LABELS[role].toLowerCase()}`}
            roleWithHistory={role === "speaker" || role === "prayer" ? role : null}
            triggerVariant="outline"
            onSave={(input) => addSundayItemPerson(item.id, role, input).then(() => undefined)}
          />
        )}
      </div>
    </div>
  );
}

function PersonRoleEditor({
  item,
  role,
  members,
}: {
  item: SundayMeetingItem;
  role: "prayer" | "speaker";
  members: SundayMeetingMemberHistory[];
}) {
  const assignment = item.assignments.find((candidate) => candidate.role === role) ?? null;
  return (
    <SundayPersonDialog
      assignment={assignment}
      members={members}
      title={ROLE_LABELS[role]}
      triggerLabel={`Assign ${ROLE_LABELS[role].toLowerCase()}`}
      roleWithHistory={role}
      onSave={(input) =>
        assignment
          ? updateSundayPerson(assignment.id, input)
          : addSundayItemPerson(item.id, role, input).then(() => undefined)
      }
      onRemove={assignment ? () => removeSundayPerson(assignment.id) : undefined}
    />
  );
}

function ItemTextDialog({ item, label }: { item: SundayMeetingItem; label: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(item.content ?? "");
  const id = `item-text-${item.id}`;

  function save() {
    startTransition(async () => {
      try {
        await updateSundayAgendaItem(item.id, { content: content.trim() || null });
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update agenda item.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <Textarea id={id} rows={4} value={content} onChange={(event) => setContent(event.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CarryForwardButton({ item }: { item: SundayMeetingItem }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function move() {
    startTransition(async () => {
      try {
        const result = await carrySundayAgendaItemForward(item.id);
        setOpen(false);
        toast.success(`Moved to ${result.destinationDate}.`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not carry item forward.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Carry forward
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carry this item forward?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The item, its linked task, and its people will move to the next eligible local Sunday meeting.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={move}>Move item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddAgendaItemDialog({ meeting }: { meeting: SundayMeeting }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SundayMeetingItemType>("custom_program");
  const [section, setSection] = useState<SundayMeetingSection>("program");
  const [content, setContent] = useState("");
  const [hymnNumber, setHymnNumber] = useState("");

  function save() {
    startTransition(async () => {
      try {
        await addSundayAgendaItem(meeting.id, {
          type,
          section,
          content: content.trim() || null,
          hymnNumber: hymnNumber.trim() ? Number(hymnNumber) : null,
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
                    {SUNDAY_MEETING_ITEM_TYPES.filter(
                      (value) => !SUNDAY_MEETING_TASK_ITEM_TYPES.includes(value as never),
                    ).map((value) => (
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
                    {SUNDAY_MEETING_SECTIONS.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
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

function SuggestedTasksCard({
  groups,
  meetingId,
  run,
}: {
  groups: SundayMeetingTaskCandidateGroup[];
  meetingId: string;
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested task presentations</CardTitle>
        <CardDescription>
          Tasks stay linked after they are placed on this agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.itemType} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{ITEM_LABELS[group.itemType]}</p>
            {group.items.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{task.memberName ?? task.title ?? "Untitled task"}</span>
                  {task.title && task.memberName && <span className="text-sm text-muted-foreground">{task.title}</span>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => run(() => addSuggestedSundayTask(meetingId, task.id), "Could not add task item.")}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AssignmentHistoryCard({ members }: { members: SundayMeetingMemberHistory[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment history</CardTitle>
        <CardDescription>
          Members with the oldest or no past talk/prayer assignment appear first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-sm text-muted-foreground">
                Talk: {member.lastTalk?.date ?? "Never"} | Prayer: {member.lastPrayer?.date ?? "Never"}
              </span>
              <span className="text-sm text-muted-foreground">
                Upcoming: {member.nextTalk?.date ?? member.nextPrayer?.date ?? "None"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function agendaTitle(item: SundayMeetingItem): string {
  if (item.standardSlot) {
    return item.standardSlot.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return ITEM_LABELS[item.type];
}

function agendaDetail(item: SundayMeetingItem): string {
  if (item.type === "hymn") {
    return item.hymnNumber ? `Hymn ${item.hymnNumber}` : "No hymn selected";
  }
  if (item.type === "musical_number") {
    return item.content || "Musical number details not entered";
  }
  if (item.content) return item.content;
  if (item.task?.title) return item.task.title;
  const people = item.assignments.map((assignment) => assignment.name);
  return people.length > 0 ? people.join(", ") : "No details entered";
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function shiftSunday(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
