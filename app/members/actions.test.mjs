import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth/dal")
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export async function getCurrentUser() { return { ward_id: "ward-a" }; }',
      };
    if (specifier === "next/cache")
      return {
        shortCircuit: true,
        url: "data:text/javascript,export function revalidatePath() {}",
      };
    return nextResolve(specifier, context);
  },
});

test("tag actions isolate wards, share edits, avoid duplicates and cascade deletion", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-tags-"));
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
  const { prisma } = await import("../../lib/prisma.ts");
  const { saveTag, deleteTag, setMemberTag } = await import("./actions.ts");
  try {
    for (const id of ["ward-a", "ward-b"])
      await prisma.ward.create({ data: { id, name: id } });
    const createMember = (ward_id) =>
      prisma.member.create({
        data: {
          ward_id,
          first_name: "Test",
          last_name: "Member",
          gender: "m",
          is_baptized: true,
        },
      });
    const a = await createMember("ward-a");
    const b = await createMember("ward-b");
    await saveTag(null, " Focus ", "blue");
    for (const id of [undefined, null, "", 42]) {
      await assert.rejects(deleteTag(id), /Invalid/);
      if (id !== null)
        await assert.rejects(saveTag(id, "Unsafe", "blue"), /Invalid/);
    }
    const tag = await prisma.member_tag.findFirstOrThrow({
      where: { ward_id: "ward-a" },
    });
    await assert.rejects(saveTag(null, "FOCUS", "green"), /already exists/);
    const foreign = await prisma.member_tag.create({
      data: {
        ward_id: "ward-b",
        name: "Focus",
        normalized_name: "focus",
        color: "green",
      },
    });
    await assert.rejects(saveTag(foreign.id, "Rename", "gray"), /unavailable/);
    await assert.rejects(deleteTag(foreign.id), /unavailable/);
    await assert.rejects(setMemberTag(a.id, foreign.id, true), /unavailable/);
    await assert.rejects(setMemberTag(b.id, tag.id, true), /unavailable/);
    await assert.rejects(setMemberTag(a.id, tag.id, "true"), /Invalid/);
    await setMemberTag(a.id, tag.id, true);
    await setMemberTag(a.id, tag.id, true);
    assert.equal(await prisma.member_tag_assignment.count(), 1);
    await saveTag(tag.id, "Attention", "rose");
    const assignment = await prisma.member_tag_assignment.findFirstOrThrow({
      include: { tag: true },
    });
    assert.equal(assignment.tag.name, "Attention");
    assert.equal(assignment.tag.color, "rose");
    await setMemberTag(a.id, tag.id, false);
    assert.equal(await prisma.member_tag_assignment.count(), 0);
    await setMemberTag(a.id, tag.id, true);
    await deleteTag(tag.id);
    assert.equal(await prisma.member_tag_assignment.count(), 0);
    assert.equal(await prisma.member.count(), 2);
    assert.equal(await prisma.member_tag.count(), 1);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
