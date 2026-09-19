import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { seedDemo } from "./seed.ts";
import { standardAgendaForMeeting } from "../../lib/sunday-meetings/templates.ts";

test("demo fixture is atomic, relationally valid, and preserves edits on restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-demo-test-"));
  const path = join(directory, "demo.db");
  const db = new Database(path);
  db.exec(
    readFileSync(
      new URL(
        "../../prisma/migrations/20260627162827_init/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  db.close();
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${path}` }),
  });
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(seedDemo(prisma), /only allowed in development/);
    assert.equal(await prisma.ward.count(), 0);
    process.env.NODE_ENV = "development";
    // Zurich is already Sunday while UTC is still Saturday.
    assert.equal(
      await seedDemo(prisma, new Date("2026-09-19T22:30:00Z")),
      true,
    );
    const ward = await prisma.ward.findFirstOrThrow();
    assert.equal(ward.content_locale, "de");
    assert.equal(ward.time_zone, "Europe/Zurich");
    assert.equal(ward.sacrament_start_time, "09:00");
    assert.equal(await prisma.user.count(), 3);
    assert.equal(await prisma.member.count(), 12);
    assert.deepEqual(
      (
        await prisma.member_tag.findMany({
          where: { is_default_excluded: true },
          orderBy: { name: "asc" },
        })
      ).map((tag) => tag.name),
      ["No contact", "Unknown"],
    );
    const members = await prisma.member.findMany();
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.equal(
      new Set(members.map((member) => member.external_uuid)).size,
      12,
    );
    const households = new Map();
    for (const member of members) {
      assert.match(member.external_uuid, uuid);
      assert.match(member.external_household_uuid, uuid);
      assert.notEqual(member.id, member.external_uuid);
      assert.ok(["m", "f"].includes(member.gender));
      const household = households.get(member.external_household_uuid) ?? [];
      household.push(member);
      households.set(member.external_household_uuid, household);
    }
    assert.deepEqual(
      [...households.values()].map((rows) => rows.length).sort(),
      [1, 1, 1, 2, 2, 2, 3],
    );
    for (const household of households.values()) {
      assert.equal(
        household.filter((member) => member.external_household_role === "HEAD")
          .length,
        1,
      );
    }
    const family = [...households.values()].find((rows) => rows.length === 3);
    assert.deepEqual(
      family.map((member) => member.external_household_role).sort(),
      ["CHILD", "HEAD", "SPOUSE"],
    );
    // Bypassing the importer cannot persist aliases, blanks, or unsupported values.
    for (const gender of ["male", "female", "M", "", "unknown", null]) {
      await assert.rejects(
        prisma.member.update({
          where: { id: members[0].id },
          data: { gender },
        }),
      );
    }
    assert.equal(await prisma.task.count(), 10);
    const meetings = await prisma.sunday_meeting.findMany({
      include: { sunday_meeting_item: true },
      orderBy: { date: "asc" },
    });
    assert.equal(meetings.length, 8);
    assert.equal(meetings[3].date, "2026-09-20");
    for (const meeting of meetings) {
      assert.equal(new Date(meeting.date).getUTCDay(), 0);
      assert.deepEqual(
        meeting.sunday_meeting_item
          .filter((item) => item.slot)
          .map((item) => item.slot)
          .sort(),
        standardAgendaForMeeting(meeting.type)
          .map((item) => item.slot)
          .sort(),
      );
    }
    const linked = await prisma.sunday_meeting_item.findFirstOrThrow({
      where: { task_id: { not: null } },
      include: { task: true },
    });
    assert.equal(linked.task.state, "in_front_of_ward");
    assert.equal(linked.person_member_id, linked.task.member_id);
    await prisma.ward.update({
      where: { id: ward.id },
      data: { name: "My edits" },
    });
    await prisma.task.deleteMany({ where: { type: "todo" } });
    assert.equal(await seedDemo(prisma, new Date("2027-01-01")), false);
    assert.equal((await prisma.ward.findFirstOrThrow()).name, "My edits");
    assert.equal(await prisma.task.count(), 7);
    const check = new Database(path);
    assert.deepEqual(check.pragma("foreign_key_check"), []);
    check.close();
    const externalIds = (rows) =>
      rows
        .map((member) => [
          member.first_name,
          member.external_uuid,
          member.external_household_uuid,
          member.external_household_role,
        ])
        .sort();
    await prisma.ward.deleteMany();
    assert.equal(await seedDemo(prisma), true);
    assert.deepEqual(
      externalIds(await prisma.member.findMany()),
      externalIds(members),
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
