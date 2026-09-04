"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  SundayMeeting,
  SundayMeetingItem,
  SundayMeetingMemberHistory,
  SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import {
  leaderOfMeeting,
  participantsByType,
  presiderOfMeeting,
} from "@/lib/sunday-meetings/slots";
import {
  addSundayAgendaItem,
  deleteSundayAgendaItem,
  updateSundayAgendaItem,
  upsertSundaySlotItem,
} from "./actions";
import { SundayPersonDialog } from "./sunday-person-dialog";
import { hasSundayPerson } from "./sunday-leading-labels";

/**
 * The meeting context card: leader, organists, music conductors, visitors
 * (with role text), and the presiding authority — all participants rows
 * edited in place through the item-based actions.
 */
export function SundayLeadingParticipants({
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
  const leader = leaderOfMeeting(meeting.items) ?? null;
  const presider = presiderOfMeeting(meeting.items) ?? null;
  const organists = participantsByType(meeting.items, "organist");
  const conductors = participantsByType(meeting.items, "music_conductor");
  const visitors = participantsByType(meeting.items, "visitor");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting context</CardTitle>
        {meeting.information && <CardDescription>{meeting.information}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ContextRow label="Leader">
          <SundayPersonDialog
            item={leader}
            members={members}
            title="Meeting leader"
            triggerLabel="Assign leader"
            onSave={(person) =>
              upsertSundaySlotItem(meeting.id, {
                type: "leader",
                section: "participants",
                person,
              })
            }
            onDelete={
              leader
                ? () => updateSundayAgendaItem(leader.id, { person: null })
                : undefined
            }
          />
        </ContextRow>
        <ContextPeople
          meeting={meeting}
          members={members}
          type="organist"
          label="Organists"
          items={organists}
        />
        <ContextPeople
          meeting={meeting}
          members={members}
          type="music_conductor"
          label="Music conductors"
          items={conductors}
        />
        <ContextRow label="Visitors">
          <div className="flex flex-wrap gap-2">
            {visitors.map((visitor) => (
              <SundayPersonDialog
                key={visitor.id}
                item={visitor}
                members={members}
                title="Visitor"
                detailLabel="Role (optional)"
                triggerVariant="secondary"
                onSave={(person, roleText) =>
                  updateSundayAgendaItem(visitor.id, {
                    person,
                    content: roleText,
                  })
                }
                // Delete the row directly: the auto-delete-on-null-person
                // path would leave a role-text-only visitor row behind.
                onDelete={() => deleteSundayAgendaItem(visitor.id)}
              />
            ))}
            <SundayPersonDialog
              item={null}
              members={members}
              title="Visitor"
              triggerLabel="Add visitor"
              detailLabel="Role (optional)"
              triggerVariant="outline"
              onSave={(person, roleText) =>
                hasSundayPerson(person) || roleText
                  ? addSundayAgendaItem(meeting.id, {
                      type: "visitor",
                      section: "participants",
                      person,
                      content: roleText,
                    }).then(() => undefined)
                  : Promise.resolve()
              }
            />
          </div>
        </ContextRow>
        <ContextRow label="Presiding">
          <SundayPersonDialog
            item={presider}
            members={members}
            title="Presiding"
            triggerLabel="Assign presiding"
            detailLabel="Role (optional)"
            onSave={(person, roleText) =>
              upsertSundaySlotItem(meeting.id, {
                type: "presiding",
                section: "participants",
                person,
                content: roleText,
              })
            }
            onDelete={
              presider
                ? () =>
                    updateSundayAgendaItem(presider.id, {
                      person: null,
                      content: null,
                    })
                : undefined
            }
          />
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

/** Organists and music conductors: one participants row per person. */
function ContextPeople({
  meeting,
  members,
  type,
  label,
  items,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  type: "organist" | "music_conductor";
  label: string;
  items: SundayMeetingItem[];
}) {
  return (
    <ContextRow label={label}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <SundayPersonDialog
            key={item.id}
            item={item}
            members={members}
            title={label}
            triggerVariant="secondary"
            onSave={(person) => updateSundayAgendaItem(item.id, { person })}
            // Delete the row directly: participant items are one-person-per-row,
            // and the auto-delete-on-null-person path could leave a
            // role-text-only row behind.
            onDelete={() => deleteSundayAgendaItem(item.id)}
          />
        ))}
        <SundayPersonDialog
          item={null}
          members={members}
          title={label}
          triggerLabel={`Add ${label.slice(0, -1).toLowerCase()}`}
          triggerVariant="outline"
          onSave={(person) =>
            hasSundayPerson(person)
              ? addSundayAgendaItem(meeting.id, {
                  type,
                  section: "participants",
                  person,
                }).then(() => undefined)
              : Promise.resolve()
          }
        />
      </div>
    </ContextRow>
  );
}
