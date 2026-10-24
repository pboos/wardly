import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { addDays, localToday } from "./calendar.ts";
import {
  SUGGESTIONS,
  canonicalSuggestionKey,
  suggestionAnchor,
  suggestionsForKind,
} from "./suggestions.ts";
import { canMergeInstructions, mergedInstructions } from "./instructions.ts";
const directory = mkdtempSync(join(tmpdir(), "wardly-instructions-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
const sqlite = new Database(join(directory, "test.db"));
for (const name of readdirSync(
  new URL("../../prisma/migrations/", import.meta.url),
)
  .filter((n) => /^\d/.test(n))
  .sort())
  sqlite.exec(
    readFileSync(
      new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url),
      "utf8",
    ),
  );
sqlite.close();
const { prisma } = await import("../prisma.ts");
const { executeMeetingCommand: execute } = await import("./service.ts");
const { loadLeadershipMeeting: load } = await import("./loaders.ts");
const today = localToday("UTC");
const schedule = {
  version: 1,
  kind: "weeks",
  interval: 1,
  weekday: new Date(`${today}T12:00:00Z`).getUTCDay(),
};
async function fixture(kind = "bishopric") {
  const ward = await prisma.ward.create({ data: { name: "Instructions" } });
  await execute(ward.id, {
    kind: "initialize",
    meetingKind: kind,
    anchorDate: today,
    schedule,
    startTime: "09:00",
    targetMinutes: 60,
  });
  const initial = await load(ward.id, kind);
  const at = (index = 0) => load(ward.id, kind, initial.meetings[index].id);
  const command = (input) => execute(ward.id, input);
  const add = (key, requestId = randomUUID()) =>
    command({
      kind: "add-suggestion",
      meetingId: initial.meeting.id,
      suggestionKey: key,
      requestId,
    });
  const all = (requestId = randomUUID()) =>
    command({
      kind: "add-all-suggestions",
      meetingId: initial.meeting.id,
      requestId,
    });
  const input = {
    title: "Topic",
    instructions: "## Prepare\n\n- Read **carefully**",
    durationMinutes: 4,
    anchorDate: today,
    recurrence: { version: 1, kind: "every_meeting" },
  };
  const custom = (changes = {}) =>
    command({
      kind: "add",
      meetingId: initial.meeting.id,
      requestId: randomUUID(),
      input: { ...input, ...changes },
    });
  const edit = (item, changes = {}, scope = "this") =>
    command({
      kind: "edit",
      itemId: item.id,
      scope,
      input: {
        ...input,
        title: item.title,
        durationMinutes: item.durationMinutes,
        recurrence: item.recurrence,
        anchorDate: item.anchorDate,
        ...changes,
      },
    });
  const remove = (item) =>
    command({ kind: "remove", itemId: item.id, scope: "this" });
  return {
    ward,
    initial,
    at,
    command,
    add,
    all,
    custom,
    input,
    edit,
    remove,
    kind,
  };
}
async function recurring(f) {
  return prisma.meeting_agenda_template.findMany({
    where: { series: { ward_id: f.ward.id }, archived: false },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
  });
}
async function itemKeys(data) {
  const rows = await prisma.meeting_agenda_item.findMany({
    where: { id: { in: data.items.map((i) => i.id) } },
    include: {
      occurrences: { include: { occurrence: { include: { template: true } } } },
    },
  });
  return data.items.map((i) =>
    canonicalSuggestionKey(
      rows
        .find((r) => r.id === i.id)
        .occurrences.find((o) => !o.occurrence.template.archived)?.occurrence
        .template.suggestion_key,
    ),
  );
}
test("instruction snapshots and suggestion commands", async (t) => {
  try {
    await t.test(
      "instructions support this/future edits, explicit clear, omitted callers, and historical snapshots",
      async () => {
        const f = await fixture();
        await f.custom();
        const original = (await f.at()).items[0];
        assert.equal(original.instructions, f.input.instructions);
        await f.edit(original, { instructions: "Current only" });
        assert.equal((await f.at()).items[0].instructions, "Current only");
        assert.equal(
          (await f.at(1)).items[0].instructions,
          f.input.instructions,
        );
        const current = (await f.at()).items[0];
        const omitted = { ...f.input };
        delete omitted.instructions;
        await f.command({
          kind: "edit",
          itemId: current.id,
          scope: "this",
          input: omitted,
        });
        assert.equal((await f.at()).items[0].instructions, "Current only");
        await f.edit(
          current,
          { instructions: "Future **preparation**" },
          "future",
        );
        assert.equal(
          (await f.at(1)).items[0].instructions,
          "Future **preparation**",
        );
        await f.command({
          kind: "outcome",
          itemId: current.id,
          outcome: "done",
          decision: "Discussion remains separate",
        });
        await f.edit((await f.at(1)).items[0], { instructions: "" }, "future");
        assert.equal((await f.at(1)).items[0].instructions, "");
        assert.equal((await f.at(2)).items[0].instructions, "");
        assert.equal(
          (await f.at()).items[0].instructions,
          "Future **preparation**",
        );
        assert.equal(
          (await f.at()).items[0].decision,
          "Discussion remains separate",
        );
        await assert.rejects(
          f.custom({ instructions: "x".repeat(8001) }),
          /Instructions/,
        );
        await assert.rejects(f.custom({ instructions: null }), /Instructions/);
      },
    );
    await t.test(
      "instruction changes bypass default-only fast path; unchanged instructions retain template identity",
      async () => {
        const f = await fixture();
        await f.custom();
        const user = await prisma.user.create({
          data: {
            ward_id: f.ward.id,
            name: "Alice",
            email: `${randomUUID()}@example.test`,
          },
        });
        const before = (await recurring(f))[0].id;
        await f.edit(
          (await f.at()).items[0],
          { defaultAssignedUserId: user.id },
          "future",
        );
        assert.equal((await recurring(f))[0].id, before);
        await f.edit(
          (await f.at()).items[0],
          {
            instructions: "Changed instructions",
            defaultAssignedUserId: user.id,
          },
          "future",
        );
        assert.notEqual((await recurring(f))[0].id, before);
        assert.equal(
          (await f.at(1)).items[0].instructions,
          "Changed instructions",
        );
      },
    );
    await t.test(
      "continuations keep customized instructions and conflicting customized destinations",
      async () => {
        const f = await fixture();
        await f.custom();
        const first = (await f.at()).items[0];
        await f.edit(first, { instructions: "Carry this guidance" });
        await f.edit((await f.at(1)).items[0], {
          instructions: "Different destination guidance",
        });
        await f.command({
          kind: "outcome",
          itemId: first.id,
          outcome: "continued",
          decision: "Carry discussion",
        });
        assert.deepEqual(
          new Set((await f.at(1)).items.map((i) => i.instructions)),
          new Set(["Carry this guidance", "Different destination guidance"]),
        );
        const g = await fixture();
        await g.custom();
        const source = (await g.at()).items[0];
        await g.edit(source, { instructions: "Keep custom keeper" });
        await g.command({
          kind: "outcome",
          itemId: source.id,
          outcome: "deferred",
          decision: "",
        });
        assert.equal((await g.at(1)).items.length, 1);
        assert.equal(
          (await g.at(1)).items[0].instructions,
          "Keep custom keeper",
        );
        assert.equal(
          mergedInstructions({ instructions: "Old" }, { instructions: "New" }, [
            "Old",
            "New",
          ]),
          "Old",
        );
        assert.equal(
          canMergeInstructions({ instructions: "A" }, { instructions: "B" }, [
            "Default",
          ]),
          false,
        );
      },
    );
    await t.test(
      "carried old-default instructions survive merging a new-default generated appearance",
      async () => {
        const f = await fixture();
        await f.custom();
        const old = (await f.at()).items[0];
        await f.edit(
          (await f.at(1)).items[0],
          { instructions: "New series guidance" },
          "future",
        );
        await f.command({
          kind: "outcome",
          itemId: old.id,
          outcome: "continued",
          decision: "Historical discussion",
        });
        assert.equal((await f.at(1)).items.length, 1);
        assert.equal((await f.at(1)).items[0].instructions, old.instructions);
        assert.equal((await f.at()).items[0].instructions, old.instructions);
        assert.equal(
          (await f.at(2)).items[0].instructions,
          "New series guidance",
        );
      },
    );
    await t.test(
      "schedule replacement and reschedule preserve custom instruction snapshots",
      async () => {
        const f = await fixture();
        await f.custom();
        const first = (await f.at()).items[0];
        await f.edit(first, { instructions: "Customized schedule guidance" });
        await f.command({
          kind: "reschedule",
          meetingId: f.initial.meeting.id,
          date: addDays(today, 1),
          startTime: "10:00",
        });
        assert.equal(
          (await f.at()).items[0].instructions,
          "Customized schedule guidance",
        );
        const second = (await f.at(1)).items[0];
        await f.edit(second, { instructions: "Preserve on replacement" });
        await f.command({
          kind: "schedule",
          seriesId: f.initial.series.id,
          anchorDate: today,
          schedule: { ...schedule, weekday: (schedule.weekday + 2) % 7 },
          startTime: "09:00",
          targetMinutes: 60,
        });
        const preserved = await prisma.meeting_agenda_item.findUniqueOrThrow({
          where: { id: second.id },
          include: { meeting: true },
        });
        assert.equal(preserved.instructions, "Preserve on replacement");
        assert.equal(preserved.meeting.status, "planned");
      },
    );
    await t.test(
      "direct Prayer additions repeat independently, and retries do not add again",
      async () => {
        const f = await fixture();
        const id = randomUUID();
        await f.add("prayer", id);
        await f.add("prayer", id);
        await f.add("prayer");
        const items = (await f.at()).items;
        assert.equal(items.length, 2);
        assert.match(items[0].instructions, /Suggested rhythm/);
        assert.match(
          items[0].instructions,
          /https:\/\/www.churchofjesuschrist.org/,
        );
        assert.ok(
          items.every(
            (i) =>
              i.title === "Prayer" && i.durationMinutes === 1 && i.repeating,
          ),
        );
        const users = await Promise.all(
          ["One", "Two"].map((name) =>
            prisma.user.create({
              data: {
                ward_id: f.ward.id,
                name,
                email: `${randomUUID()}@example.test`,
              },
            }),
          ),
        );
        for (const [index, item] of items.entries())
          await f.command({
            kind: "assign",
            itemId: item.id,
            assignment: { kind: "override", userId: users[index].id },
          });
        assert.deepEqual(
          (await f.at()).items.map((i) => i.assignedUserId),
          users.map((u) => u.id),
        );
        assert.ok(
          (await f.at(1)).items.every((i) => i.assignedUserId === null),
        );
        await assert.rejects(f.add("assignments", id), /identifier/);
      },
    );
    await t.test(
      "single restore is selected-date only, preserves edits, and can restore multiple prayers",
      async () => {
        const f = await fixture();
        await f.add("prayer");
        await f.add("prayer");
        const [a, b] = (await f.at()).items;
        await f.edit(a, {
          instructions: "Saved prayer guidance",
          title: "Local prayer",
        });
        await f.remove(a);
        await f.remove(b);
        const id = randomUUID();
        await f.add("prayer", id);
        assert.equal((await f.at()).items.length, 1);
        assert.equal(
          (await f.at()).items[0].instructions,
          "Saved prayer guidance",
        );
        await f.remove((await f.at()).items[0]);
        await f.add("prayer", id);
        assert.equal((await f.at()).items.length, 0);
        await f.add("prayer");
        await f.add("prayer");
        assert.equal((await f.at()).items.length, 2);
        await f.add("prayer");
        assert.equal((await f.at()).items.length, 3);
        const otherDate = (await f.at(1)).items[0];
        await f.remove(otherDate);
        await f.add("prayer");
        assert.equal(
          (await f.at(1)).items.filter((i) => i.id === otherDate.id).length,
          0,
        );
      },
    );
    await t.test(
      "nonrepeatable scheduled/restored commands converge and receipts retain restoration-only/noop intent",
      async () => {
        const f = await fixture();
        await f.add("assignments");
        const noop = randomUUID();
        await f.add("assignments", noop);
        const item = (await f.at()).items[0];
        await f.remove(item);
        await f.add("assignments", noop);
        assert.equal((await f.at()).items.length, 0);
        const restore = randomUUID();
        await f.add("assignments", restore);
        assert.equal((await f.at()).items[0].id, item.id);
        await f.remove(item);
        await f.add("assignments", restore);
        assert.equal((await f.at()).items.length, 0);
        await f.add("assignments");
        assert.equal((await f.at()).items.length, 1);
        await f.command({
          kind: "outcome",
          itemId: item.id,
          outcome: "done",
          decision: "history",
        });
        await f.add("assignments");
        assert.equal((await f.at()).items.length, 1);
      },
    );
    await t.test(
      "add all creates canonical distinct prayers, keeps rhythms and converges on repeated requests",
      async () => {
        for (const kind of ["bishopric", "ward_council"]) {
          const f = await fixture(kind);
          const id = randomUUID();
          await f.all(id);
          const templates = await recurring(f);
          const expected = [
            ...suggestionsForKind(kind).map((s) => s.key),
            "prayer",
          ];
          assert.deepEqual(
            templates.map((t) => canonicalSuggestionKey(t.suggestion_key)),
            expected,
          );
          assert.equal(
            new Set(
              templates
                .filter((t) => t.suggestion_key === "prayer")
                .map((t) => t.id),
            ).size,
            2,
          );
          for (const template of templates)
            assert.deepEqual(
              JSON.parse(template.recurrence),
              SUGGESTIONS.find((s) => s.key === template.suggestion_key)
                .recurrence,
            );
          assert.equal((await itemKeys(await f.at())).at(0), "prayer");
          assert.equal((await itemKeys(await f.at())).at(-1), "prayer");
          await f.all(id);
          await f.all();
          assert.equal((await recurring(f)).length, templates.length);
          const first = (await f.at()).items[0];
          await f.remove(first);
          await f.all(id);
          assert.ok(!(await f.at()).items.some((i) => i.id === first.id));
          await f.all();
          assert.ok((await f.at()).items.some((i) => i.id === first.id));
        }
      },
    );
    await t.test(
      "legacy keys count only their original topic; prayer aliases and archived replacements do not inflate counts",
      async () => {
        const f = await fixture();
        await f.custom({
          title: "Old opening",
          suggestionKey: "opening",
          instructions: "Keep old wording",
        });
        await f.custom({ title: "Old closing", suggestionKey: "closing" });
        await f.custom({
          title: "Combined callings",
          suggestionKey: "callings",
        });
        await f.custom({ title: "Combined budget", suggestionKey: "budget" });
        await f.all();
        const templates = await recurring(f);
        assert.equal(
          templates.filter(
            (t) => canonicalSuggestionKey(t.suggestion_key) === "prayer",
          ).length,
          2,
        );
        assert.ok(
          templates.some(
            (t) =>
              t.title === "Old opening" &&
              t.instructions === "Keep old wording",
          ),
        );
        assert.ok(templates.some((t) => t.suggestion_key === "ordinances"));
        assert.ok(
          templates.some((t) => t.suggestion_key === "upcoming-sundays"),
        );
        assert.ok(
          templates.some((t) => t.suggestion_key === "annual-calendar"),
        );
        const prayer = (await f.at()).items[0];
        await f.edit(prayer, { instructions: "Replaced prayer" }, "future");
        await f.all();
        assert.equal(
          (await recurring(f)).filter(
            (t) => canonicalSuggestionKey(t.suggestion_key) === "prayer",
          ).length,
          2,
        );
        await f.add("prayer");
        await f.all();
        assert.equal(
          (await recurring(f)).filter(
            (t) => canonicalSuggestionKey(t.suggestion_key) === "prayer",
          ).length,
          3,
        );
      },
    );
    await t.test(
      "canonical order preserves custom, resolved, carried slots and future prayer template identity",
      async () => {
        const f = await fixture();
        await f.add("callings");
        await f.custom({ title: "Custom" });
        await f.add("assignments");
        await f.add("prayer");
        await f.add("prayer");
        const before = await f.at();
        await f.command({
          kind: "outcome",
          itemId: before.items[2].id,
          outcome: "done",
          decision: "Keep resolved slot",
        });
        const fixed = new Map(
          (await f.at()).items
            .filter((i) => i.title === "Custom" || i.outcome === "done")
            .map((i) => [i.id, before.items.findIndex((r) => r.id === i.id)]),
        );
        const future = await f.at(1);
        const prayers = future.items.filter((i) => i.title === "Prayer");
        const ids = future.items.map((i) => i.id);
        const a = ids.indexOf(prayers[0].id),
          b = ids.indexOf(prayers[1].id);
        [ids[a], ids[b]] = [ids[b], ids[a]];
        await f.command({
          kind: "reorder",
          meetingId: future.meeting.id,
          itemIds: ids,
        });
        await f.all();
        const after = await f.at();
        for (const [id, slot] of fixed)
          assert.equal(
            after.items.findIndex((i) => i.id === id),
            slot,
          );
        const orderedFuturePrayers = (await f.at(1)).items.filter(
          (i) => i.title === "Prayer",
        );
        assert.deepEqual(
          orderedFuturePrayers.map((i) => i.id),
          prayers.map((i) => i.id),
        );
        const g = await fixture();
        await g.add("callings");
        const source = (await g.at()).items[0];
        await g.command({
          kind: "outcome",
          itemId: source.id,
          outcome: "continued",
          decision: "Carry",
        });
        const carried = (await g.at(1)).items.find(
          (i) => i.predecessorId === source.id,
        );
        await g.command({
          kind: "add-all-suggestions",
          meetingId: g.initial.meetings[1].id,
          requestId: randomUUID(),
        });
        assert.equal((await g.at(1)).items[0].id, carried.id);
      },
    );
    await t.test(
      "quarterly Report anchors stay January/April/July/October",
      () => {
        for (const [date, expected] of [
          ["2026-01-01", "2026-01-10"],
          ["2026-01-11", "2026-04-10"],
          ["2026-03-31", "2026-04-10"],
          ["2026-07-10", "2026-07-10"],
          ["2026-10-11", "2027-01-10"],
        ])
          assert.equal(suggestionAnchor("report", date), expected);
      },
    );
    await t.test(
      "ward authorization, unsupported suggestions, conflicting receipts, and failed bulk rollback",
      async () => {
        const f = await fixture();
        const foreign = await fixture("ward_council");
        await assert.rejects(
          execute(foreign.ward.id, {
            kind: "add-all-suggestions",
            meetingId: f.initial.meeting.id,
            requestId: randomUUID(),
          }),
          /not found/,
        );
        await assert.rejects(foreign.add("callings"), /not available/);
        const id = randomUUID();
        await f.add("prayer", id);
        await assert.rejects(
          f.command({
            kind: "add-suggestion",
            meetingId: f.initial.meetings[1].id,
            suggestionKey: "prayer",
            requestId: id,
          }),
          /identifier/,
        );
        const failed = randomUUID();
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER reject_finance BEFORE INSERT ON meeting_agenda_template WHEN NEW.suggestion_key = 'finance' BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
        );
        await assert.rejects(f.all(failed));
        assert.equal((await recurring(f)).length, 1);
        assert.equal(
          await prisma.meeting_suggestion_receipt.count({
            where: { id: failed },
          }),
          0,
        );
        await prisma.$executeRawUnsafe("DROP TRIGGER reject_finance");
        await f.all(failed);
        assert.ok((await recurring(f)).length > 1);
      },
    );
    await t.test(
      "task capability follows suggestion identity across renames and legacy keys",
      async () => {
        const f = await fixture();
        await f.add("prayer");
        await f.add("spiritual-thought");
        await f.add("assignments");
        await f.custom({ title: "Prayer" });
        await f.custom({
          title: "Spiritual thought",
          recurrence: { version: 1, kind: "once" },
        });
        let data = await f.at();
        const prayer = data.items.find(
          (item) => item.title === "Prayer" && !item.canAddTasks,
        );
        const thought = data.items.find(
          (item) => item.title === "Spiritual thought" && !item.canAddTasks,
        );
        assert.ok(prayer);
        assert.ok(thought);
        await prisma.meeting_agenda_item.update({
          where: { id: prayer.id },
          data: { title: "Renamed prayer" },
        });
        await prisma.meeting_agenda_item.update({
          where: { id: thought.id },
          data: { title: "Renamed thought" },
        });
        for (const key of ["opening", "closing"]) {
          const occurrence = await prisma.meeting_agenda_item_occurrence.findFirst({
            where: { item_id: prayer.id },
            include: { occurrence: true },
          });
          await prisma.meeting_agenda_template.update({
            where: { id: occurrence.occurrence.template_id },
            data: { suggestion_key: key },
          });
          data = await f.at();
          assert.equal(
            data.items.find((item) => item.id === prayer.id).canAddTasks,
            false,
          );
        }
        assert.equal(
          data.items.find((item) => item.id === thought.id).canAddTasks,
          false,
        );
        assert.equal(
          data.items.find(
            (item) => item.title === "Previous decisions and assignments",
          ).canAddTasks,
          true,
        );
        assert.equal(
          data.items.find((item) => item.title === "Prayer").canAddTasks,
          true,
        );
        assert.equal(
          data.items.find((item) => item.title === "Spiritual thought")
            .canAddTasks,
          true,
        );
      },
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
