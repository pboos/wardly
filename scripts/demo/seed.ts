import type { PrismaClient } from "../../generated/prisma/client.ts";
import {
  addDays,
  defaultMeetingTypeForSunday,
  localToday,
  upcomingSunday,
} from "../../lib/sunday-meetings/calendar.ts";
import { standardAgendaForMeeting } from "../../lib/sunday-meetings/templates.ts";

// Explicit numeric keys keep fictional UUIDs stable when fixture rows are reordered.
// Columns: member key, household key, role, first name, last name, gender, birth date.
const people = [
  [1, 1, "HEAD", "Martin", "Keller", "m", "1981-04-12"],
  [2, 2, "HEAD", "Anna", "Meier", "f", "1986-08-21"],
  [3, 3, "HEAD", "Lukas", "Weber", "m", "1990-02-03"],
  [4, 4, "HEAD", "Sarah", "Fischer", "f", "1994-06-18"],
  [5, 5, "HEAD", "Daniel", "Huber", "m", "1975-11-09"],
  [6, 1, "SPOUSE", "Elena", "Baumann", "f", "2000-03-25"],
  [7, 1, "CHILD", "Noah", "Keller", "m", "2010-07-14"],
  [8, 2, "CHILD", "Mia", "Meier", "f", "2012-09-02"],
  [9, 4, "CHILD", "Jonas", "Fischer", "m", "2014-01-30"],
  [10, 5, "CHILD", "Clara", "Huber", "f", "2019-12-06"],
  [11, 6, "HEAD", "Peter", "Schmid", "m", "1952-05-17"],
  [12, 7, "HEAD", "Ruth", "Schmid", "f", "1954-10-11"],
] as const;

function fixtureUuid(kind: "member" | "household", key: number): string {
  return `00000000-0000-4000-${kind === "member" ? "8000" : "9000"}-${String(key).padStart(12, "0")}`;
}

/** One atomic fixture, seeded only into an empty database. Restarts preserve edits. */
export async function seedDemo(
  prisma: PrismaClient,
  now = new Date(),
): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Demo seeding is only allowed in development.");
  }
  return prisma.$transaction(async (tx) => {
    if (await tx.ward.count()) return false;
    const ward = await tx.ward.create({
      data: {
        name: "Gemeinde Sonnenberg (Demo)",
        content_locale: "de",
        time_zone: "Europe/Zurich",
        sacrament_start_time: "09:00",
      },
    });
    const users = [];
    for (const [name, email] of [
      ["Martin Keller", "demo@example.test"],
      ["Anna Meier", "anna@example.test"],
      ["Lukas Weber", "lukas@example.test"],
    ]) {
      users.push(
        await tx.user.create({ data: { ward_id: ward.id, name, email } }),
      );
    }
    const members: { id: string }[] = [];
    for (const [
      index,
      [
        memberKey,
        householdKey,
        external_household_role,
        first_name,
        last_name,
        gender,
        birth_date,
      ],
    ] of people.entries()) {
      members.push(
        await tx.member.create({
          data: {
            ward_id: ward.id,
            external_uuid: fixtureUuid("member", memberKey),
            external_household_uuid: fixtureUuid("household", householdKey),
            external_household_role,
            first_name,
            last_name,
            gender,
            birth_date,
            email: `${first_name.toLowerCase()}@example.test`,
            is_baptized: index !== 9,
            is_moved_out: index === 10,
          },
        }),
      );
    }
    for (const [name, color, indices] of [
      ["Focus", "blue", [0, 3]],
      ["Unknown", "amber", [3]],
      ["No contact", "gray", [11]],
    ] as const) {
      await tx.member_tag.create({
        data: {
          ward_id: ward.id,
          name,
          normalized_name: name.toLowerCase(),
          color,
          assignments: {
            create: indices.map((index) => ({ member_id: members[index].id })),
          },
        },
      });
    }
    const today = localToday(ward.time_zone, now);
    const sunday = upcomingSunday(today);
    const tasks = [];
    const taskSpecs = [
      ["todo", "todo", "Gemeindeabend vorbereiten", 0, -2, "urgent"],
      ["todo", "todo", "Besuch bei Familie Fischer planen", 3, 3, "normal"],
      [
        "calling",
        "in_front_of_ward",
        "Lehrerin in der Primarvereinigung",
        5,
        0,
        "normal",
      ],
      [
        "calling",
        "talk_to_person",
        "Lehrer in der Sonntagsschule",
        4,
        7,
        "normal",
      ],
      ["temple_recommend", "organize_stake", null, 2, 4, "normal"],
      ["youth_interview", "todo", null, 6, 5, "normal"],
      ["temple_recommend_limited", "todo", null, 7, 9, "normal"],
      ["check_in", "todo", "Willkommensgespräch", 5, 14, "whenever"],
      ["todo", "done", "Raum für die Sitzung reservieren", 1, -7, "normal"],
      ["calling_release", "record", "Chorleitung", 3, -1, "normal"],
    ] as const;
    for (const [
      index,
      [type, state, title, memberIndex, days, priority],
    ] of taskSpecs.entries()) {
      tasks.push(
        await tx.task.create({
          data: {
            ward_id: ward.id,
            type,
            state,
            title,
            priority,
            description: "Fiktive Aufgabe zum Ausprobieren und Bearbeiten.",
            member_id: members[memberIndex].id,
            assigned_user_id:
              index === 7 ? null : users[index % users.length].id,
            due_date: addDays(today, days),
            duration_minutes: 15,
            completed_at: state === "done" ? addDays(today, -3) : null,
          },
        }),
      );
    }
    for (let week = -3; week <= 4; week++) {
      const date = addDays(sunday, week * 7);
      const type = defaultMeetingTypeForSunday(date, null);
      const meeting = await tx.sunday_meeting.create({
        data: {
          ward_id: ward.id,
          date,
          type,
          information: "Fiktive Versammlung zum Testen der Planung.",
        },
      });
      let order = 0;
      for (const entry of standardAgendaForMeeting(type)) {
        const hymnNumber =
          entry.slot === "sacrament_hymn"
            ? 112
            : entry.slot === "opening_hymn"
              ? 2
              : entry.slot === "closing_hymn"
                ? 3
                : 4;
        const filled = week <= 1;
        await tx.sunday_meeting_item.create({
          data: {
            sunday_meeting_id: meeting.id,
            ...entry,
            order_index: order++,
            metadata:
              filled && entry.type === "hymn"
                ? JSON.stringify({ hymnNumber })
                : null,
            person_member_id:
              filled && entry.type === "prayer"
                ? members[entry.slot === "opening_prayer" ? 1 : 3].id
                : null,
          },
        });
      }
      for (const [type, person] of [
        ["leader", 2],
        ["presiding", 0],
      ] as const) {
        await tx.sunday_meeting_item.create({
          data: {
            sunday_meeting_id: meeting.id,
            type,
            section: "participants",
            order_index: order++,
            person_member_id: members[person].id,
          },
        });
      }
      if (type === "sacrament" && week <= 1) {
        await tx.sunday_meeting_item.create({
          data: {
            sunday_meeting_id: meeting.id,
            type: "talk",
            section: "program",
            order_index: order++,
            person_member_id: members[5].id,
            content: "Glaube im Alltag",
          },
        });
      }
      if (week === 0) {
        await tx.sunday_meeting_item.create({
          data: {
            sunday_meeting_id: meeting.id,
            type: "announcement",
            section: "opening",
            order_index: order++,
            content: "Gemeindeabend am Freitag um 18:30 Uhr.",
          },
        });
        await tx.sunday_meeting_item.create({
          data: {
            sunday_meeting_id: meeting.id,
            type: "calling_sustain",
            section: "business",
            order_index: order++,
            task_id: tasks[2].id,
            person_member_id: members[5].id,
            content: tasks[2].title,
          },
        });
      }
    }
    return true;
  });
}
