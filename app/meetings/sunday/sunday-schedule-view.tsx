"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  SundayMeeting,
  SundayMeetingItem,
  SundayMeetingMemberHistory,
  SundayMeetingStandardSlot,
  SundayMeetingType,
} from "@/lib/sunday-meetings/types";
import {
  SUNDAY_MEETING_TYPE_LABELS,
  SUNDAY_MEETING_TYPES,
  isLocalMeetingType,
} from "@/lib/sunday-meetings/types";
import {
  addSundayAgendaItem,
  addSundayMeetingPerson,
  removeSundayPerson,
  replaceSundayItemPerson,
  setSundayMeetingLeader,
  updateSundayPerson,
  updateSundayAgendaItem,
  updateSundayMeetingInformation,
  updateSundayMeetingType,
  updateSundayMeetingWardSettings,
  addSundayMeetingAfterLatest,
  addSundayMeetingBeforeEarliest,
  bootstrapSundaySchedule,
} from "./actions";
import { SundayPersonDialog } from "./sunday-person-dialog";
import { SundayScheduleBoundaryAction } from "./sunday-schedule-boundary-action";

type ScheduleData = {
  range: { start: string; end: string };
  contentLocale: string;
  timeZone: string;
  rows: SundayMeeting[];
  hasEarlier: boolean;
  hasLater: boolean;
  showBefore: boolean;
  showAfter: boolean;
  earlierCursor: string;
  laterCursor: string;
};

export function SundayScheduleView({
  schedule,
  members,
}: {
  schedule: ScheduleData;
  members: SundayMeetingMemberHistory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const speakerColumns = Math.max(
    3,
    ...schedule.rows.map(speakerCount),
  );

  function run(action: () => Promise<unknown>, errorMessage: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : errorMessage, {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Sunday sacrament meeting
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(schedule.range.start)} to {formatDate(schedule.range.end)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schedule.hasEarlier && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/meetings/sunday?before=${schedule.earlierCursor}`}>
                <IconArrowLeft data-icon="inline-start" />
                Earlier
              </Link>
            </Button>
          )}
          {schedule.hasLater && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/meetings/sunday?after=${schedule.laterCursor}`}>
                Later
                <IconArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
          <SundaySettingsDialog
            contentLocale={schedule.contentLocale}
            timeZone={schedule.timeZone}
          />
          <Button size="sm" asChild>
            <Link href="/meetings/sunday/leading">
              Open leading view
              <IconChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </header>

      {schedule.rows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Sunday meetings yet</CardTitle>
            <CardDescription>
              Start the persisted schedule with the ward-local current or upcoming Sunday.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => run(bootstrapSundaySchedule, "Could not start the Sunday schedule.")}>
              <IconPlus data-icon="inline-start" />
              Add current Sunday
            </Button>
          </CardContent>
        </Card>
      )}

      {schedule.rows.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Leading</TableHead>
                  <TableHead>Organist(s)</TableHead>
                  <TableHead>Conductor(s)</TableHead>
                  <TableHead>Opening hymn</TableHead>
                  <TableHead>Sacrament hymn</TableHead>
                  <TableHead>Interlude hymn</TableHead>
                  <TableHead>Closing hymn</TableHead>
                  <TableHead>Information</TableHead>
                  <TableHead>Opening prayer</TableHead>
                  <TableHead>Closing prayer</TableHead>
                  {Array.from({ length: speakerColumns }, (_, index) => (
                    <TableHead key={index}>Speaker {index + 1}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.showBefore && (
                  <SundayScheduleBoundaryAction
                    desktop
                    colSpan={12 + speakerColumns}
                    accessibleName="Add Sunday before the earliest meeting"
                    action={() => addSundayMeetingBeforeEarliest()}
                    run={run}
                  />
                )}
                {schedule.rows.map((row) => (
                  <ScheduleTableRow
                    key={row.id}
                    meeting={row}
                    speakerColumns={speakerColumns}
                    members={members}
                    run={run}
                  />
                ))}
                {schedule.showAfter && (
                  <SundayScheduleBoundaryAction
                    desktop
                    colSpan={12 + speakerColumns}
                    accessibleName="Add Sunday after the latest meeting"
                    action={() => addSundayMeetingAfterLatest()}
                    run={run}
                  />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {schedule.showBefore && (
              <SundayScheduleBoundaryAction
                accessibleName="Add Sunday before the earliest meeting"
                action={() => addSundayMeetingBeforeEarliest()}
                run={run}
              />
            )}
            {schedule.rows.map((row) => (
              <ScheduleMobileCard
                key={row.id}
                meeting={row}
                members={members}
                run={run}
              />
            ))}
            {schedule.showAfter && (
              <SundayScheduleBoundaryAction
                accessibleName="Add Sunday after the latest meeting"
                action={() => addSundayMeetingAfterLatest()}
                run={run}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function speakerCount(meeting: SundayMeeting): number {
  return meeting.items.filter((item) => item.type === "talk").length;
}

function ScheduleTableRow({
  meeting,
  speakerColumns,
  members,
  run,
}: {
  meeting: SundayMeeting;
  speakerColumns: number;
  members: SundayMeetingMemberHistory[];
  run: (action: () => Promise<unknown>, errorMessage: string) => void;
}) {
  const local = isLocalMeetingType(meeting.type);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          className="underline-offset-4 hover:underline"
          href={`/meetings/sunday/leading?date=${meeting.date}`}
        >
          {formatDate(meeting.date)}
        </Link>
      </TableCell>
      <TableCell>
        <MeetingTypePicker
          meeting={meeting}
          onChange={(type) => run(() => updateSundayMeetingType(meeting.id, type), "Could not update meeting type.")}
        />
      </TableCell>
      <TableCell>
        {local ? (
          <LeaderPicker meeting={meeting} members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        {local ? (
          <MeetingPeopleCell meeting={meeting} role="organist" members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        {local ? (
          <MeetingPeopleCell meeting={meeting} role="music_conductor" members={members} />
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="opening_hymn" local={local} />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="sacrament_hymn" local={local} />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="interlude" local={local} />
      </TableCell>
      <TableCell>
        <HymnCell meeting={meeting} slot="closing_hymn" local={local} />
      </TableCell>
      <TableCell>
        {local ? <InformationCell meeting={meeting} /> : <EmptyCell />}
      </TableCell>
      <TableCell>
        <PrayerCell meeting={meeting} slot="opening_prayer" local={local} members={members} />
      </TableCell>
      <TableCell>
        <PrayerCell meeting={meeting} slot="closing_prayer" local={local} members={members} />
      </TableCell>
      {Array.from({ length: speakerColumns }, (_, index) => (
        <TableCell key={index}>
          <SpeakerCell
            meeting={meeting}
            index={index}
            local={local}
            members={members}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

function ScheduleMobileCard({
  meeting,
  members,
  run,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  run: (action: () => Promise<unknown>, errorMessage: string) => void;
}) {
  const local = isLocalMeetingType(meeting.type);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{formatDate(meeting.date)}</CardTitle>
            <CardDescription>{SUNDAY_MEETING_TYPE_LABELS[meeting.type]}</CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/meetings/sunday/leading?date=${meeting.date}`}>Lead</Link>
          </Button>
        </div>
        <MeetingTypePicker
          meeting={meeting}
          onChange={(type) => run(() => updateSundayMeetingType(meeting.id, type), "Could not update meeting type.")}
        />
      </CardHeader>
      {local && (
        <CardContent className="flex flex-col gap-4">
          <MobileEditorRow label="Leading">
            <LeaderPicker meeting={meeting} members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Organists">
            <MeetingPeopleCell meeting={meeting} role="organist" members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Music conductors">
            <MeetingPeopleCell meeting={meeting} role="music_conductor" members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Opening hymn">
            <HymnCell meeting={meeting} slot="opening_hymn" local />
          </MobileEditorRow>
          <MobileEditorRow label="Sacrament hymn">
            <HymnCell meeting={meeting} slot="sacrament_hymn" local />
          </MobileEditorRow>
          <MobileEditorRow label="Interlude">
            <HymnCell meeting={meeting} slot="interlude" local />
          </MobileEditorRow>
          <MobileEditorRow label="Closing hymn">
            <HymnCell meeting={meeting} slot="closing_hymn" local />
          </MobileEditorRow>
          <MobileEditorRow label="Information">
            <InformationCell meeting={meeting} />
          </MobileEditorRow>
          <MobileEditorRow label="Opening prayer">
            <PrayerCell meeting={meeting} slot="opening_prayer" local members={members} />
          </MobileEditorRow>
          <MobileEditorRow label="Closing prayer">
            <PrayerCell meeting={meeting} slot="closing_prayer" local members={members} />
          </MobileEditorRow>
          {Array.from({ length: Math.max(3, speakerCount(meeting)) }, (_, index) => (
            <MobileEditorRow key={index} label={`Speaker ${index + 1}`}>
              <SpeakerCell meeting={meeting} index={index} local members={members} />
            </MobileEditorRow>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function MobileEditorRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function MeetingTypePicker({
  meeting,
  onChange,
}: {
  meeting: SundayMeeting;
  onChange: (type: SundayMeetingType) => void;
}) {
  return (
    <Select value={meeting.type} onValueChange={(value) => onChange(value as SundayMeetingType)}>
      <SelectTrigger aria-label={`Meeting type for ${meeting.date}`} size="sm" className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SUNDAY_MEETING_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {SUNDAY_MEETING_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function LeaderPicker({
  meeting,
  members,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
}) {
  const leader = meeting.assignments.find((assignment) => assignment.role === "leader") ?? null;
  return (
    <SundayPersonDialog
      assignment={leader}
      members={members}
      title="Meeting leader"
      triggerLabel="Assign leader"
      onSave={(input) => setSundayMeetingLeader(meeting.id, input)}
      onRemove={leader ? () => setSundayMeetingLeader(meeting.id, null) : undefined}
    />
  );
}

function MeetingPeopleCell({
  meeting,
  role,
  members,
}: {
  meeting: SundayMeeting;
  role: "organist" | "music_conductor";
  members: SundayMeetingMemberHistory[];
}) {
  const assignments = meeting.assignments.filter((assignment) => assignment.role === role);
  const label = role === "organist" ? "Organist" : "Music conductor";

  return (
    <div className="flex min-w-32 flex-wrap gap-1">
      {assignments.map((assignment) => (
        <SundayPersonDialog
          key={assignment.id}
          assignment={assignment}
          members={members}
          title={label}
          triggerVariant="secondary"
          triggerClassName="max-w-36 truncate"
          onSave={(input) => updateSundayPerson(assignment.id, input)}
          onRemove={() => removeSundayPerson(assignment.id)}
        />
      ))}
      <SundayPersonDialog
        assignment={null}
        members={members}
        title={label}
        triggerLabel={`Add ${label.toLowerCase()}`}
        triggerVariant="outline"
        onSave={(input) => addSundayMeetingPerson(meeting.id, role, input).then(() => undefined)}
      />
    </div>
  );
}

function HymnCell({
  meeting,
  slot,
  local,
}: {
  meeting: SundayMeeting;
  slot: "opening_hymn" | "sacrament_hymn" | "interlude" | "closing_hymn";
  local: boolean;
}) {
  const item = findSlot(meeting, slot);
  if (!local || !item) return <EmptyCell />;

  return <HymnDialog item={item} allowMusicalNumber={slot === "interlude"} />;
}

function HymnDialog({
  item,
  allowMusicalNumber,
}: {
  item: SundayMeetingItem;
  allowMusicalNumber: boolean;
}) {
  const router = useRouter();
  const id = useState(() => `hymn-${item.id}`)[0];
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"hymn" | "musical_number">(
    item.type === "musical_number" ? "musical_number" : "hymn",
  );
  const [number, setNumber] = useState(item.hymnNumber?.toString() ?? "");
  const [description, setDescription] = useState(item.content ?? "");

  function save() {
    const hymnNumber = number.trim() ? Number(number) : null;
    startTransition(async () => {
      try {
        await updateSundayAgendaItem(item.id, {
          type: kind,
          hymnNumber: kind === "hymn" ? hymnNumber : null,
          content: kind === "musical_number" ? description : null,
        });
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update hymn.");
      }
    });
  }

  const label = item.type === "musical_number"
    ? item.content || "Musical number"
    : item.hymnNumber
      ? `Hymn ${item.hymnNumber}`
      : "Assign hymn";

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Music item</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            {allowMusicalNumber && (
              <Field>
                <FieldLabel htmlFor={`${id}-kind`}>Item type</FieldLabel>
                <Select value={kind} onValueChange={(value) => setKind(value as "hymn" | "musical_number")}>
                  <SelectTrigger id={`${id}-kind`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="hymn">Hymn</SelectItem>
                      <SelectItem value="musical_number">Musical number</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {kind === "hymn" ? (
              <Field>
                <FieldLabel htmlFor={`${id}-number`}>Hymn number</FieldLabel>
                <Input
                  id={`${id}-number`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="For example, 100"
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
                <Input
                  id={`${id}-description`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Musical number details"
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InformationCell({ meeting }: { meeting: SundayMeeting }) {
  return (
    <TextDialog
      title="Meeting information"
      triggerLabel={meeting.information ?? "Add information"}
      initialValue={meeting.information ?? ""}
      multiline
      onSave={(value) => updateSundayMeetingInformation(meeting.id, value || null)}
    />
  );
}

function PrayerCell({
  meeting,
  slot,
  local,
  members,
}: {
  meeting: SundayMeeting;
  slot: "opening_prayer" | "closing_prayer";
  local: boolean;
  members: SundayMeetingMemberHistory[];
}) {
  const item = findSlot(meeting, slot);
  if (!local || !item) return <EmptyCell />;
  const assignment = item.assignments.find((candidate) => candidate.role === "prayer") ?? null;
  const title = slot === "opening_prayer" ? "Opening prayer" : "Closing prayer";
  return (
    <SundayPersonDialog
      assignment={assignment}
      members={members}
      title={title}
      triggerLabel="Assign prayer"
      roleWithHistory="prayer"
      onSave={(input) => replaceSundayItemPerson(item.id, "prayer", input)}
      onRemove={assignment ? () => replaceSundayItemPerson(item.id, "prayer", null) : undefined}
    />
  );
}

function SpeakerCell({
  meeting,
  index,
  local,
  members,
}: {
  meeting: SundayMeeting;
  index: number;
  local: boolean;
  members: SundayMeetingMemberHistory[];
}) {
  if (!local || meeting.type === "childrens_sacrament_presentation") {
    return <EmptyCell />;
  }
  const talks = meeting.items.filter((item) => item.type === "talk");
  const item = talks[index] ?? null;
  const assignment = item?.assignments.find((candidate) => candidate.role === "speaker") ?? null;

  return (
    <SundayPersonDialog
      assignment={assignment}
      members={members}
      title={`Speaker ${index + 1}`}
      triggerLabel="Assign speaker"
      roleWithHistory="speaker"
      onSave={async (input) => {
        const talkId = item?.id ?? await addSundayAgendaItem(meeting.id, {
          type: "talk",
          section: "program",
        });
        await replaceSundayItemPerson(talkId, "speaker", input);
      }}
      onRemove={
        item && assignment
          ? () => replaceSundayItemPerson(item.id, "speaker", null)
          : undefined
      }
    />
  );
}

function TextDialog({
  title,
  triggerLabel,
  initialValue,
  multiline = false,
  onSave,
}: {
  title: string;
  triggerLabel: string;
  initialValue: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const router = useRouter();
  const id = useState(() => `text-${title.toLowerCase().replaceAll(" ", "-")}`)[0];
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);

  function save() {
    startTransition(async () => {
      try {
        await onSave(value.trim());
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save text.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="max-w-48 truncate" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={id}>{title}</FieldLabel>
              {multiline ? (
                <Textarea id={id} value={value} onChange={(event) => setValue(event.target.value)} rows={5} />
              ) : (
                <Input id={id} value={value} onChange={(event) => setValue(event.target.value)} />
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SundaySettingsDialog({
  contentLocale,
  timeZone,
}: {
  contentLocale: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState(contentLocale);
  const [zone, setZone] = useState(timeZone);

  function save() {
    startTransition(async () => {
      try {
        await updateSundayMeetingWardSettings({ contentLocale: locale, timeZone: zone });
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update ward settings.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconSettings data-icon="inline-start" />
        Settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sunday meeting settings</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sunday-content-locale">Ward content locale</FieldLabel>
              <Input
                id="sunday-content-locale"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                placeholder="en"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sunday-time-zone">Ward time zone</FieldLabel>
              <Input
                id="sunday-time-zone"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                placeholder="Europe/Zurich"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function findSlot(
  meeting: SundayMeeting,
  slot: SundayMeetingStandardSlot,
): SundayMeetingItem | null {
  return meeting.items.find((item) => item.standardSlot === slot) ?? null;
}

function EmptyCell() {
  return <span className="text-muted-foreground">-</span>;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
