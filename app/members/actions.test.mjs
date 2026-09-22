import { bindActionsForTest } from "@/lib/actions/test-support.mjs";
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
        url: 'data:text/javascript,export async function getSessionUser() { return { id: "test-user", ward_id: "ward-a" }; }',
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
  const { saveTag, deleteTag, setMemberTag } = bindActionsForTest(
    await import("./actions.ts"),
    { userId: "test-user", wardId: "ward-a" },
  );
  const { bulkUpdateMemberTags } = bindActionsForTest(
    await import("./bulk-tag-actions.ts"),
    { userId: "test-user", wardId: "ward-a" },
  );
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
    await saveTag(null, " Focus ", "blue", false);
    for (const id of [undefined, null, "", 42]) {
      await assert.rejects(deleteTag(id), /Invalid/);
      if (id !== null)
        await assert.rejects(saveTag(id, "Unsafe", "blue", false), /Invalid/);
    }
    const tag = await prisma.member_tag.findFirstOrThrow({
      where: { ward_id: "ward-a" },
    });
    await assert.rejects(
      saveTag(null, "FOCUS", "green", false),
      /already exists/,
    );
    const foreign = await prisma.member_tag.create({
      data: {
        ward_id: "ward-b",
        name: "Focus",
        normalized_name: "focus",
        color: "green",
      },
    });
    await assert.rejects(
      saveTag(foreign.id, "Rename", "gray", true),
      /unavailable/,
    );
    await assert.rejects(deleteTag(foreign.id), /unavailable/);
    await assert.rejects(setMemberTag(a.id, foreign.id, true), /unavailable/);
    await assert.rejects(setMemberTag(b.id, tag.id, true), /unavailable/);
    await assert.rejects(setMemberTag(a.id, tag.id, "true"), /Invalid/);
    await setMemberTag(a.id, tag.id, true);
    await setMemberTag(a.id, tag.id, true);
    assert.equal(await prisma.member_tag_assignment.count(), 1);
    await saveTag(tag.id, "Attention", "rose", true);
    const assignment = await prisma.member_tag_assignment.findFirstOrThrow({
      include: { tag: true },
    });
    assert.equal(assignment.tag.name, "Attention");
    assert.equal(assignment.tag.color, "rose");
    assert.equal(assignment.tag.is_default_excluded, true);
    await assert.rejects(
      saveTag(tag.id, "Attention", "rose", "true"),
      /Invalid/,
    );
    assert.equal(foreign.is_default_excluded, false);
    await setMemberTag(a.id, tag.id, false);
    assert.equal(await prisma.member_tag_assignment.count(), 0);
    await setMemberTag(a.id, tag.id, true);
    await deleteTag(tag.id);
    assert.equal(await prisma.member_tag_assignment.count(), 0);
    assert.equal(await prisma.member.count(), 2);
    assert.equal(await prisma.member_tag.count(), 1);
    await saveTag(null, "Bulk one", "blue", false);
    await saveTag(null, "Bulk two", "green", false);
    const localTags = await prisma.member_tag.findMany({
      where: { ward_id: "ward-a" },
    });
    const tagIds = localTags.map((tag) => tag.id);
    const memberIds = Array.from(
      { length: 105 },
      (_, index) => `bulk-member-${index}`,
    );
    await prisma.member.createMany({
      data: memberIds.map((id) => ({
        id,
        ward_id: "ward-a",
        first_name: "Bulk",
        last_name: id,
        gender: "m",
        is_baptized: false,
      })),
    });
    // Unselected members and unrelated assignments survive bulk operations.
    await setMemberTag(a.id, tagIds[0], true);
    await setMemberTag(memberIds[0], tagIds[1], true);
    const snapshot = async () =>
      (
        await prisma.member_tag_assignment.findMany({
          orderBy: [{ member_id: "asc" }, { tag_id: "asc" }],
        })
      ).map(({ member_id, tag_id }) => [member_id, tag_id]);
    const before = await snapshot();
    for (const operation of ["add", "remove"]) {
      for (const [ids, tags] of [
        [[memberIds[0], b.id], tagIds],
        [memberIds, [tagIds[0], foreign.id]],
        [[memberIds[0], "missing-member"], tagIds],
        [memberIds, [tagIds[0], "deleted-tag"]],
      ]) {
        await assert.rejects(
          bulkUpdateMemberTags(ids, tags, operation),
          /unavailable/,
        );
        assert.deepEqual(await snapshot(), before);
      }
    }
    for (const [ids, tags, operation] of [
      [[], tagIds, "add"],
      [memberIds, [], "remove"],
      [null, tagIds, "add"],
      [[undefined], tagIds, "add"],
      [memberIds, [null], "add"],
      [memberIds, tagIds, "replace"],
      [Array(2001).fill(a.id), tagIds, "add"],
      [memberIds, Array(51).fill(tagIds[0]), "add"],
    ]) {
      await assert.rejects(
        bulkUpdateMemberTags(ids, tags, operation),
        /Invalid/,
      );
      assert.deepEqual(await snapshot(), before);
    }
    // Failure in the second member batch must undo the first batch too.
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_bulk_insert BEFORE INSERT ON member_tag_assignment
      WHEN NEW.member_id = 'bulk-member-104' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await assert.rejects(bulkUpdateMemberTags(memberIds, tagIds, "add"));
    assert.deepEqual(await snapshot(), before);
    await prisma.$executeRawUnsafe("DROP TRIGGER fail_bulk_insert");
    await bulkUpdateMemberTags(
      [...memberIds, memberIds[0]],
      [...tagIds, tagIds[0]],
      "add",
    );
    assert.equal(await prisma.member_tag_assignment.count(), 211);
    await bulkUpdateMemberTags(memberIds, tagIds, "add");
    assert.equal(
      await prisma.member_tag_assignment.count(),
      211,
      "repeated additions do not duplicate",
    );
    await bulkUpdateMemberTags(memberIds, [tagIds[0]], "remove");
    assert.equal(
      await prisma.member_tag_assignment.count(),
      106,
      "other tags and unselected members survive",
    );
    await bulkUpdateMemberTags(memberIds, [tagIds[0]], "remove");
    assert.equal(
      await prisma.member_tag_assignment.count(),
      106,
      "absent removal is harmless",
    );
    await bulkUpdateMemberTags(memberIds, [tagIds[1]], "remove");
    assert.deepEqual(await snapshot(), [[a.id, tagIds[0]]]);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
