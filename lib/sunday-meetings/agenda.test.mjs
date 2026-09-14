import assert from "node:assert/strict";
import test from "node:test";
import { agendaMoveTarget, buildAgendaRows } from "./agenda.ts";
import { moveAgendaItems, renumberItems } from "./order.ts";
import { standardAgendaForMeeting } from "./templates.ts";

const standard = () =>
  renumberItems(
    standardAgendaForMeeting("sacrament").map((entry) => ({
      ...entry,
      id: entry.slot,
      orderIndex: 0,
    })),
  );
const meeting = (items) => ({ type: "sacrament", items });

test("empty standard entries are real rows; add-person controls are not agenda items", () => {
  const items = standard();
  const rows = buildAgendaRows(meeting(items));
  assert.equal(rows.length, items.length);
  assert.ok(rows.every((row) => row.item.id));
  assert.ok(rows.every((row) => row.kind === "slot"));
  assert.deepEqual(
    buildAgendaRows({ type: "general_conference", items: [] }),
    [],
  );
});

test("move and rebuild swaps exactly one empty standard entry", () => {
  const items = [
    ...standard(),
    {
      id: "announcement",
      type: "announcement",
      section: "opening",
      orderIndex: 2,
      slot: null,
    },
  ];
  const move = agendaMoveTarget(items, "announcement", "up", false);
  const after = moveAgendaItems(items, "announcement", move);
  assert.deepEqual(
    buildAgendaRows(meeting(after))
      .filter((row) => row.item.section === "opening")
      .map((row) => row.item.id),
    ["opening_hymn", "announcement", "opening_prayer"],
  );
  assert.equal(
    after.find((item) => item.id === "announcement").section,
    "opening",
  );
});

test("moves into sacrament append after blessing and passing, even while empty", () => {
  const items = [
    ...standard(),
    { id: "talk", type: "talk", section: "program", orderIndex: 1, slot: null },
  ];
  const after = moveAgendaItems(items, "talk", {
    section: "sacrament",
    showSupportText: false,
  });
  assert.deepEqual(
    buildAgendaRows(meeting(after))
      .filter((row) => row.item.section === "sacrament")
      .map((row) => row.item.id),
    ["sacrament_hymn", "sacrament_blessing", "sacrament_passing", "talk"],
  );
});

test("hidden conductor text never consumes an invisible move", () => {
  const items = [
    { id: "a", type: "talk", section: "program", orderIndex: 0 },
    { id: "text", type: "conductor_text", section: "program", orderIndex: 1 },
    { id: "b", type: "talk", section: "program", orderIndex: 2 },
  ];
  const move = agendaMoveTarget(items, "b", "up", false);
  assert.deepEqual(
    buildAgendaRows(meeting(moveAgendaItems(items, "b", move)), false).map(
      (row) => row.item.id,
    ),
    ["b", "a"],
  );
});
