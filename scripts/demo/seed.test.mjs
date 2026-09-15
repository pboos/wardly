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
    assert.equal(await prisma.user.count(), 3);
    assert.equal(await prisma.member.count(), 12);
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
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
