import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache")
      return {
        shortCircuit: true,
        url: "data:text/javascript,export function revalidatePath() {}",
      };
    if (specifier === "@/lib/auth/dal")
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export async function getCurrentUser() { if (globalThis.wardSettingsUnauthenticated) throw new Error("unauthenticated"); return { ward_id: "settings-ward" }; }',
      };
    return nextResolve(specifier, context);
  },
});

test("ward settings validate input, require authentication, and preserve other wards and meetings", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-settings-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  const db = new Database(join(directory, "test.db"));
  db.exec(
    readFileSync(
      new URL(
        "../../../prisma/migrations/20260627162827_init/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  db.close();
  const { prisma } = await import("../../../lib/prisma.ts");
  const { updateWardSettings } = await import("./actions.ts");
  const form = () => {
    const data = new FormData();
    data.set("wardName", "  Updated ward  ");
    data.set("contentLocale", "de");
    data.set("timeZone", "Pacific/Honolulu");
    data.set("sacramentStartTime", "10:30");
    data.set("ward_id", "other-ward"); // Never accept ward ownership from the client.
    return data;
  };
  try {
    const original = await prisma.ward.create({
      data: {
        id: "settings-ward",
        name: "Original",
        time_zone: "Europe/Zurich",
      },
    });
    const other = await prisma.ward.create({
      data: { id: "other-ward", name: "Other" },
    });
    const meeting = await prisma.sunday_meeting.create({
      data: { ward_id: original.id, date: "2026-09-20", type: "sacrament" },
    });
    const hymn = await prisma.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meeting.id,
        type: "hymn",
        section: "program",
        order_index: 0,
        metadata: JSON.stringify({ hymnNumber: 1 }),
      },
    });
    for (const [field, value] of [
      ["wardName", "   "],
      ["wardName", null],
      ["wardName", new Blob(["file"])],
      ["contentLocale", "fr"],
      ["contentLocale", null],
      ["timeZone", "Mars/Base"],
      ["timeZone", "+02:00"],
      ["timeZone", null],
      ["sacramentStartTime", "24:00"],
      ["sacramentStartTime", "9:30"],
      ["sacramentStartTime", null],
    ]) {
      const data = form();
      if (value === null) data.delete(field);
      else data.set(field, value);
      const result = await updateWardSettings(data);
      assert.equal(result.ok, false, field);
      assert.ok(result.error);
      assert.deepEqual(
        await prisma.ward.findUnique({ where: { id: original.id } }),
        original,
      );
    }
    globalThis.wardSettingsUnauthenticated = true;
    await assert.rejects(updateWardSettings(form()), /unauthenticated/);
    assert.deepEqual(
      await prisma.ward.findUnique({ where: { id: original.id } }),
      original,
    );
    globalThis.wardSettingsUnauthenticated = false;
    assert.deepEqual(await updateWardSettings(form()), { ok: true });
    const saved = await prisma.ward.findUniqueOrThrow({
      where: { id: original.id },
    });
    assert.equal(saved.name, "Updated ward");
    assert.equal(saved.content_locale, "de");
    assert.equal(saved.time_zone, "Pacific/Honolulu");
    assert.equal(saved.sacrament_start_time, "10:30");
    assert.deepEqual(
      await prisma.ward.findUnique({ where: { id: other.id } }),
      other,
    );
    assert.deepEqual(
      await prisma.sunday_meeting.findUnique({ where: { id: meeting.id } }),
      meeting,
    );
    assert.deepEqual(
      await prisma.sunday_meeting_item.findUnique({ where: { id: hymn.id } }),
      hymn,
    );
    const second = form();
    second.set("contentLocale", "en");
    second.set("timeZone", "UTC");
    second.set("sacramentStartTime", "00:00");
    assert.deepEqual(await updateWardSettings(second), { ok: true });
  } finally {
    delete globalThis.wardSettingsUnauthenticated;
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
