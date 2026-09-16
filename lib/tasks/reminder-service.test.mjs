import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

test("Sunday digest delivery persistence and concurrency", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-reminder-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  const db = new Database(join(directory, "test.db"));
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
  const { prisma } = await import("../prisma.ts");
  const { sendDueTaskDigests } = await import("./reminder-service.ts");
  const { claimDelivery, finishDelivery } =
    await import("./reminder-delivery.ts");
  let now = new Date("2026-09-20T06:00:00Z");
  const options = (send) => ({
    send,
    baseUrl: "https://ward.test",
    now: () => now,
  });
  async function seed() {
    await prisma.ward.deleteMany();
    now = new Date("2026-09-20T06:00:00Z");
    const ward = await prisma.ward.create({
      data: {
        name: "Zurich",
        time_zone: "Europe/Zurich",
        sacrament_start_time: "09:00",
      },
    });
    const user = await prisma.user.create({
      data: { ward_id: ward.id, name: "First", email: "first@example.com" },
    });
    await prisma.task.create({
      data: {
        ward_id: ward.id,
        assigned_user_id: user.id,
        type: "todo",
        title: "Future task",
        due_date: "2027-01-01",
      },
    });
    return { ward, user };
  }
  try {
    await t.test(
      "all unfinished assignments, no empty emails, weekly deduplication and ward isolation",
      async () => {
        const { ward, user } = await seed();
        const other = await prisma.ward.create({
          data: {
            name: "Denver",
            time_zone: "America/Denver",
            sacrament_start_time: "09:00",
          },
        });
        const otherUser = await prisma.user.create({
          data: {
            ward_id: other.id,
            name: "Other",
            email: "other@example.com",
          },
        });
        await prisma.user.create({
          data: { ward_id: ward.id, name: "Empty", email: "empty@example.com" },
        });
        await prisma.task.createMany({
          data: [
            {
              ward_id: ward.id,
              assigned_user_id: user.id,
              type: "todo",
              title: "Completed",
              completed_at: "2026-09-19",
            },
            { ward_id: ward.id, type: "todo", title: "Unassigned" },
            {
              ward_id: other.id,
              assigned_user_id: otherUser.id,
              type: "todo",
              title: "Other ward",
            },
          ],
        });
        // Conference Sundays still send.
        await prisma.sunday_meeting.create({
          data: {
            ward_id: ward.id,
            date: "2026-09-20",
            type: "general_conference",
          },
        });
        const mails = [];
        assert.deepEqual(
          await sendDueTaskDigests(
            options(async (m) => {
              mails.push(m);
            }),
          ),
          { sent: 1, failed: 0 },
        );
        assert.equal(mails[0].tasks.length, 1);
        assert.equal(mails[0].tasks[0].title, "Future task");
        assert.equal(mails[0].to, user.email);
        assert.equal(mails[0].tasksUrl, "https://ward.test/tasks?filter=mine");
        await sendDueTaskDigests(
          options(async (m) => {
            mails.push(m);
          }),
        );
        assert.equal(mails.length, 1);
        now = new Date("2026-09-27T06:00:00Z");
        await sendDueTaskDigests(
          options(async (m) => {
            mails.push(m);
          }),
        );
        assert.equal(mails.length, 2);
      },
    );

    await t.test("overlapping workers claim only once", async () => {
      await seed();
      let release;
      let entered;
      const sending = new Promise((resolve) => {
        entered = resolve;
      });
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      let count = 0;
      const first = sendDueTaskDigests(
        options(async () => {
          count++;
          entered();
          await gate;
        }),
      );
      await sending;
      try {
        await sendDueTaskDigests(
          options(async () => {
            count++;
          }),
        );
        assert.equal(count, 1);
      } finally {
        release();
        await first;
      }
    });

    await t.test(
      "simultaneous first claims have exactly one owner",
      async () => {
        const { ward, user } = await seed();
        const claims = await Promise.all(
          Array.from({ length: 4 }, () =>
            claimDelivery(ward.id, user.id, "2026-09-20", now),
          ),
        );
        assert.equal(claims.filter(Boolean).length, 1);
        assert.equal(await prisma.task_digest_delivery.count(), 1);
      },
    );

    await t.test(
      "failed emails back off and retry with current assignments, never after start",
      async () => {
        await seed();
        const failed = await sendDueTaskDigests(
          options(async () => {
            throw new Error("SMTP failure");
          }),
        );
        assert.equal(failed.failed, 1);
        let count = 0;
        await sendDueTaskDigests(
          options(async () => {
            count++;
          }),
        );
        assert.equal(count, 0);
        await prisma.task.updateMany({
          data: { title: "Updated before retry" },
        });
        now = new Date("2026-09-20T06:01:00Z");
        await sendDueTaskDigests(
          options(async (digest) => {
            assert.equal(digest.tasks[0].title, "Updated before retry");
            count++;
          }),
        );
        assert.equal(count, 1);
        await seed();
        await sendDueTaskDigests(
          options(async () => {
            throw new Error("SMTP failure");
          }),
        );
        now = new Date("2026-09-20T07:00:00Z");
        await sendDueTaskDigests(
          options(async () => {
            count++;
          }),
        );
        assert.equal(count, 1);
      },
    );

    await t.test(
      "expired leases recover and old owners cannot finalize",
      async () => {
        const { ward, user } = await seed();
        const first = await claimDelivery(ward.id, user.id, "2026-09-20", now);
        assert.ok(first);
        assert.equal(
          await claimDelivery(ward.id, user.id, "2026-09-20", now),
          null,
        );
        now = new Date(now.getTime() + 5 * 60000);
        const second = await claimDelivery(ward.id, user.id, "2026-09-20", now);
        assert.ok(second);
        await finishDelivery(first.id, first.claim_token, now);
        assert.equal(
          (
            await prisma.task_digest_delivery.findUniqueOrThrow({
              where: { id: first.id },
            })
          ).status,
          "sending",
        );
        await finishDelivery(second.id, second.claim_token, now);
        assert.equal(
          await claimDelivery(ward.id, user.id, "2026-09-20", now),
          null,
        );
      },
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
