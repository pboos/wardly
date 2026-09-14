import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// Always use an isolated SQLite database, never the developer's configured DB.
const directory = mkdtempSync(join(tmpdir(), "wardly-sunday-test-"));
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
const { prisma } = await import("../../prisma.ts");
const service = await import("../service.ts");
const { loadSundayMeeting } = await import("../loaders.ts");
const { buildAgendaRows, agendaMoveTarget } = await import("../agenda.ts");
const { standardAgendaForMeeting } = await import("../templates.ts");
const { findSlotItem } = await import("../slots.ts");
const { moveAgendaItems } = await import("../order.ts");

try {
  const ward = await prisma.ward.create({ data: { name: "Ordering test" } });
  const otherWard = await prisma.ward.create({ data: { name: "Other ward" } });
  const meeting = await service.createOrLoadSundayMeeting(
    ward.id,
    "2026-09-13",
    "sacrament",
  );
  const load = () => loadSundayMeeting(ward.id, meeting.id);
  let current = await load();
  assert.equal(
    current.items.length,
    standardAgendaForMeeting("sacrament").length,
  );
  assert.ok(
    current.items.every(
      (item) => item.slot && Number.isInteger(item.orderIndex),
    ),
  );
  const hymn = findSlotItem(current.items, "opening_hymn");
  const prayer = findSlotItem(current.items, "opening_prayer");
  assert.ok(hymn && prayer);

  const announcement = await service.addSundayItem(ward.id, meeting.id, {
    type: "announcement",
    section: "opening",
    content: "Welcome",
  });
  current = await load();
  const input = agendaMoveTarget(current.items, announcement, "up", false);
  const expected = moveAgendaItems(current.items, announcement, input);
  await service.moveSundayItem(ward.id, announcement, input);
  current = await load();
  assert.deepEqual(
    current.items.map((item) => [item.id, item.section, item.orderIndex]),
    expected.map((item) => [item.id, item.section, item.orderIndex]),
  );
  assert.deepEqual(
    buildAgendaRows(current)
      .filter((row) => row.item.section === "opening")
      .map((row) => row.item.id),
    [hymn.id, announcement, prayer.id],
  );

  // Stable slots move, clear, and refill without losing position or identity.
  await service.moveSundayItem(ward.id, hymn.id, {
    direction: "down",
    showSupportText: false,
  });
  await service.upsertSundayItem(ward.id, meeting.id, {
    slot: "opening_hymn",
    type: "hymn",
    section: "opening",
    metadata: { hymnNumber: 12 },
  });
  await service.updateSundayItem(ward.id, hymn.id, { metadata: null });
  current = await load();
  assert.equal(findSlotItem(current.items, "opening_hymn").id, hymn.id);
  assert.equal(findSlotItem(current.items, "opening_hymn").orderIndex, 1);
  const extraHymn = await service.addSundayItem(ward.id, meeting.id, {
    type: "hymn",
    section: "opening",
    metadata: { hymnNumber: 99 },
  });
  for (let i = 0; i < 3; i++)
    await service.moveSundayItem(ward.id, extraHymn, {
      direction: "up",
      showSupportText: false,
    });
  assert.equal(findSlotItem((await load()).items, "opening_hymn").id, hymn.id);
  await assert.rejects(service.deleteSundayItem(ward.id, hymn.id));
  await assert.rejects(
    service.updateSundayItem(ward.id, hymn.id, { type: "talk" }),
  );
  await assert.rejects(
    service.moveSundayItem(ward.id, hymn.id, {
      section: "closing",
      showSupportText: true,
    }),
  );
  await assert.rejects(
    service.moveSundayItem(otherWard.id, hymn.id, {
      direction: "down",
      showSupportText: false,
    }),
  );
  await assert.rejects(
    prisma.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meeting.id,
        type: "hymn",
        section: "opening",
        slot: "opening_hymn",
        order_index: 9,
      },
    }),
  );

  const talk = await service.addSundayItem(ward.id, meeting.id, {
    type: "talk",
    section: "program",
    content: "Topic",
  });
  await service.moveSundayItem(ward.id, talk, {
    section: "sacrament",
    showSupportText: false,
  });
  current = await load();
  assert.deepEqual(
    current.items
      .filter((item) => item.section === "sacrament")
      .map((item) => item.slot ?? item.id),
    ["sacrament_hymn", "sacrament_blessing", "sacrament_passing", talk],
  );
  await assert.rejects(
    service.moveSundayItem(ward.id, talk, {
      direction: "down",
      showSupportText: false,
    }),
  );

  const a = await service.addSundayItem(ward.id, meeting.id, {
    type: "talk",
    section: "program",
    content: "A",
  });
  const wording = await service.addSundayItem(ward.id, meeting.id, {
    type: "conductor_text",
    section: "program",
    content: "Introduce B",
  });
  const b = await service.addSundayItem(ward.id, meeting.id, {
    type: "talk",
    section: "program",
    content: "B",
  });
  await service.moveSundayItem(ward.id, b, {
    direction: "up",
    showSupportText: false,
  });
  current = await load();
  assert.deepEqual(
    current.items
      .filter((item) => [a, b, wording].includes(item.id))
      .map((item) => item.id),
    [wording, b, a],
  );
  assert.deepEqual(
    buildAgendaRows(current, false)
      .filter((row) => [a, b].includes(row.item.id))
      .map((row) => row.item.id),
    [b, a],
  );

  // Type changes preserve entered data and never duplicate standard slots.
  const interlude = findSlotItem(current.items, "interlude");
  await service.updateSundayItem(ward.id, interlude.id, {
    type: "musical_number",
    content: "Choir",
  });
  await service.changeMeetingType(ward.id, meeting.id, "fast_testimony");
  current = await load();
  assert.equal(findSlotItem(current.items, "interlude"), undefined);
  assert.equal(
    current.items.find((item) => item.id === interlude.id).content,
    "Choir",
  );
  assert.equal(
    current.items.find((item) => item.id === interlude.id).slot,
    null,
  );
  await service.changeMeetingType(ward.id, meeting.id, "sacrament");
  assert.notEqual(
    findSlotItem((await load()).items, "interlude").id,
    interlude.id,
  );
  await assert.rejects(
    service.changeMeetingType(ward.id, meeting.id, "general_conference"),
  );

  const empty = await service.createOrLoadSundayMeeting(
    ward.id,
    "2026-09-20",
    "sacrament",
  );
  await service.changeMeetingType(ward.id, empty.id, "general_conference");
  assert.equal((await loadSundayMeeting(ward.id, empty.id)).items.length, 0);
  await service.changeMeetingType(
    ward.id,
    empty.id,
    "childrens_sacrament_presentation",
  );
  assert.ok(
    findSlotItem(
      (await loadSundayMeeting(ward.id, empty.id)).items,
      "primary_presentation",
    ),
  );

  // New talks append after manually reordered talks; deletions close position gaps.
  await service.deleteSundayItem(ward.id, a);
  const appended = await service.addSundayItem(ward.id, meeting.id, {
    type: "talk",
    section: "program",
    content: "Last",
  });
  const program = (await load()).items.filter(
    (item) => item.section === "program",
  );
  assert.equal(program.at(-1).id, appended);
  assert.deepEqual(
    program.map((item) => item.orderIndex),
    program.map((_, index) => index),
  );
  await service.carryForwardItem(ward.id, announcement);
  const destination = await loadSundayMeeting(ward.id, empty.id);
  assert.equal(
    destination.items.filter((item) => item.section === "opening").at(-1).id,
    announcement,
  );
  assert.ok(!(await load()).items.some((item) => item.id === announcement));
  const task = await prisma.task.create({
    data: { ward_id: ward.id, type: "calling", title: "Test calling" },
  });
  const taskItem = await service.addTaskItem(
    ward.id,
    meeting.id,
    task.id,
    "calling_sustain",
  );
  const business = (await load()).items.filter(
    (item) => item.section === "business",
  );
  assert.equal(business.at(-1).id, taskItem);
  assert.ok(Number.isInteger(business.at(-1).orderIndex));
  await assert.rejects(
    service.addTaskItem(ward.id, meeting.id, task.id, "calling_sustain"),
  );
  const again = await service.createOrLoadSundayMeeting(
    ward.id,
    meeting.date,
    "sacrament",
  );
  assert.equal(again.id, meeting.id);
  assert.equal(
    (await load()).items.filter((item) => item.slot).length,
    standardAgendaForMeeting("sacrament").length,
  );
  // Hymn history is ward-wide and musical-number placeholders survive reload.
  const { loadSundayHymns } = await import("../hymn-loader.ts");
  const historyMeeting = await service.createOrLoadSundayMeeting(ward.id, "2020-01-05", "sacrament");
  const foreignMeeting = await service.createOrLoadSundayMeeting(otherWard.id, "2020-01-12", "sacrament");
  for (const [owner, saved] of [[ward, historyMeeting], [otherWard, foreignMeeting]]) {
    const loaded = await loadSundayMeeting(owner.id, saved.id);
    await service.updateSundayItem(owner.id, findSlotItem(loaded.items, "opening_hymn").id, { metadata: { hymnNumber: 9998 } });
  }
  const hymnData = await loadSundayHymns(ward.id, "de-CH", "Europe/Zurich");
  assert.equal(hymnData.lastSung[9998], "2020-01-05");
  assert.ok(hymnData.hymns.some((hymn) => hymn.number === 1));
  const historical = await loadSundayMeeting(ward.id, historyMeeting.id);
  const historyInterlude = findSlotItem(historical.items, "interlude");
  await service.updateSundayItem(ward.id, historyInterlude.id, { type: "musical_number", content: "Musical number", metadata: null, person: null });
  let savedInterlude = findSlotItem((await loadSundayMeeting(ward.id, historyMeeting.id)).items, "interlude");
  assert.equal(savedInterlude.content, "Musical number");
  assert.equal(savedInterlude.personMemberId, null);
  assert.equal(savedInterlude.orderIndex, historyInterlude.orderIndex);
  await service.updateSundayItem(ward.id, historyInterlude.id, { content: "Violin duet — Anna and Ben" });
  savedInterlude = findSlotItem((await loadSundayMeeting(ward.id, historyMeeting.id)).items, "interlude");
  assert.equal(savedInterlude.content, "Violin duet — Anna and Ben");
  for (const slot of ["opening_hymn", "sacrament_hymn", "closing_hymn"]) {
    await assert.rejects(service.updateSundayItem(ward.id, findSlotItem(historical.items, slot).id, { type: "musical_number", content: "Musical number" }));
  }
  console.log("Sunday persistence checks passed.");
} finally {
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
}
