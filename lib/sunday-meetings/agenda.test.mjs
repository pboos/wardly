import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENDA_SECTIONS,
  agendaMoveTarget,
  agendaRowItem,
  agendaRowSection,
  buildAgendaRows,
} from "./agenda.ts";

const item = (overrides = {}) => ({
  id: overrides.id ?? "item-1",
  sundayMeetingId: "meeting-1",
  type: overrides.type ?? "talk",
  section: overrides.section ?? "program",
  orderIndex: overrides.orderIndex ?? null,
  content: overrides.content ?? null,
  metadata: overrides.metadata ?? null,
  personMemberId: overrides.personMemberId ?? null,
  personName: overrides.personName ?? null,
  personNameResolved: overrides.personNameResolved ?? null,
  taskId: null,
  task: null,
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
});

const meeting = (overrides = {}) => ({
  id: "meeting-1",
  wardId: "ward-1",
  date: "2026-09-06",
  type: overrides.type ?? "sacrament",
  information: null,
  items: overrides.items ?? [],
  presider: null,
});

const describeRow = (row) =>
  row.kind === "slot"
    ? `slot:${row.slot}${row.item ? `(${row.item.id})` : ""}`
    : row.kind === "item"
      ? `item:${row.item.id}`
      : `empty:${row.type}`;

test("the agenda flow covers the sections in handbook order", () => {
  assert.deepEqual([...AGENDA_SECTIONS], [
    "opening",
    "business",
    "sacrament",
    "program",
    "closing",
  ]);
});

test("an empty sacrament meeting renders the virtual slots plus lazy editors", () => {
  const rows = buildAgendaRows(meeting());

  assert.deepEqual(rows.map(describeRow), [
    "slot:opening_hymn",
    "slot:opening_prayer",
    "slot:sacrament_hymn",
    "empty:sacrament_blessing",
    "empty:sacrament_passing",
    "slot:interlude",
    "empty:talk",
    "slot:closing_hymn",
    "slot:closing_prayer",
  ]);
  assert.deepEqual(rows.map(agendaRowSection), [
    "opening",
    "opening",
    "sacrament",
    "sacrament",
    "sacrament",
    "program",
    "program",
    "closing",
    "closing",
  ]);
});

test("a fast and testimony meeting has no interlude slot", () => {
  const rows = buildAgendaRows(meeting({ type: "fast_testimony" }));

  assert.deepEqual(rows.map(describeRow), [
    "slot:opening_hymn",
    "slot:opening_prayer",
    "slot:sacrament_hymn",
    "empty:sacrament_blessing",
    "empty:sacrament_passing",
    "empty:talk",
    "slot:closing_hymn",
    "slot:closing_prayer",
  ]);
});

test("a childrens presentation meeting assumes the primary presentation program", () => {
  const rows = buildAgendaRows(
    meeting({ type: "childrens_sacrament_presentation" }),
  );

  assert.deepEqual(rows.map(describeRow), [
    "slot:opening_hymn",
    "slot:opening_prayer",
    "slot:sacrament_hymn",
    "empty:sacrament_blessing",
    "empty:sacrament_passing",
    "slot:primary_presentation",
    "slot:closing_hymn",
    "slot:closing_prayer",
  ]);
});

test("conference meetings render no agenda rows", () => {
  assert.deepEqual(buildAgendaRows(meeting({ type: "stake_conference" })), []);
  assert.deepEqual(
    buildAgendaRows(meeting({ type: "general_conference" })),
    [],
  );
});

test("persisted slot rows bind and extra rows keep their final order", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [
        item({
          id: "hymn-2",
          type: "hymn",
          section: "opening",
          createdAt: "2025-01-02T00:00:00.000Z",
        }),
        item({
          id: "hymn-1",
          type: "hymn",
          section: "opening",
          metadata: { hymnNumber: 12 },
        }),
        item({
          id: "announce-1",
          type: "announcement",
          section: "opening",
          content: "Welcome",
        }),
        item({
          id: "prayer-1",
          type: "prayer",
          section: "opening",
          personName: "Jane",
        }),
      ],
    }),
  );

  assert.deepEqual(rows.map(describeRow).slice(0, 4), [
    "item:announce-1",
    "slot:opening_hymn(hymn-1)",
    "item:hymn-2",
    "slot:opening_prayer(prayer-1)",
  ]);
});

test("filled sacrament participant rows replace their empty editors", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [
        item({
          id: "blesser",
          type: "sacrament_blessing",
          section: "sacrament",
          personName: "Elder A",
        }),
      ],
    }),
  ).filter((row) => agendaRowSection(row) === "sacrament");

  assert.deepEqual(rows.map(describeRow), [
    "slot:sacrament_hymn",
    "item:blesser",
    "empty:sacrament_passing",
  ]);
});

test("the trailing empty talk editor sits at the end of the program section", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [
        item({ id: "talk-1", createdAt: "2025-01-01T00:00:00.000Z" }),
        item({ id: "talk-2", createdAt: "2025-01-02T00:00:00.000Z" }),
        item({ id: "custom", type: "custom_program", content: "Special" }),
      ],
    }),
  ).filter((row) => agendaRowSection(row) === "program");

  assert.deepEqual(rows.map(describeRow), [
    "slot:interlude",
    "item:talk-1",
    "item:talk-2",
    "item:custom",
    "empty:talk",
  ]);
});

test("manually positioned items keep their place between the virtual slots", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [item({ id: "early", type: "custom_program", orderIndex: 50 })],
    }),
  ).filter((row) => agendaRowSection(row) === "program");

  assert.deepEqual(rows.map(describeRow), [
    "slot:interlude",
    "item:early",
    "empty:talk",
  ]);
});

test("a musical number in the program backs the interlude slot", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [item({ id: "musical", type: "musical_number", content: "Choir" })],
    }),
  ).filter((row) => agendaRowSection(row) === "program");

  assert.deepEqual(rows.map(describeRow), [
    "slot:interlude(musical)",
    "empty:talk",
  ]);
});

test("participant rows never render in the agenda flow", () => {
  const rows = buildAgendaRows(
    meeting({
      items: [
        item({
          id: "leader",
          type: "leader",
          section: "participants",
          personName: "Bishop",
        }),
        item({ id: "organist", type: "organist", section: "participants" }),
      ],
    }),
  );

  assert.equal(
    rows.some((row) => agendaRowItem(row)?.section === "participants"),
    false,
  );
  assert.deepEqual(rows.map(describeRow), [
    "slot:opening_hymn",
    "slot:opening_prayer",
    "slot:sacrament_hymn",
    "empty:sacrament_blessing",
    "empty:sacrament_passing",
    "slot:interlude",
    "empty:talk",
    "slot:closing_hymn",
    "slot:closing_prayer",
  ]);
});

const persisted = (id, section = "program", overrides = {}) => ({
  kind: "item",
  item: item({ id, section, ...overrides }),
});
const emptySlot = (slot, section) => ({ kind: "slot", slot, section, item: null });

test("moving up lands before the row above", () => {
  const rows = [
    persisted("a", "opening"),
    persisted("b", "opening"),
    persisted("c", "opening"),
  ];

  assert.deepEqual(agendaMoveTarget(rows, "c", "up"), { afterItemId: "a" });
  assert.deepEqual(agendaMoveTarget(rows, "b", "up"), {
    afterItemId: null,
    section: "opening",
  });
  assert.equal(agendaMoveTarget(rows, "a", "up"), null);
});

test("moving up skips empty editors while anchoring", () => {
  const rows = [
    persisted("a", "opening"),
    emptySlot("opening_prayer", "opening"),
    persisted("c", "opening"),
  ];

  assert.deepEqual(agendaMoveTarget(rows, "c", "up"), { afterItemId: "a" });
  assert.deepEqual(agendaMoveTarget(rows, "c", "down"), null);
});

test("moving up across a section boundary anchors in the earlier section", () => {
  const rows = [
    persisted("x", "opening"),
    persisted("y", "opening"),
    persisted("m", "sacrament"),
  ];

  assert.deepEqual(agendaMoveTarget(rows, "m", "up"), { afterItemId: "x" });
});

test("moving up past only empty editors lands at the end of the previous section", () => {
  const rows = [
    emptySlot("opening_hymn", "opening"),
    emptySlot("opening_prayer", "opening"),
    persisted("x", "business"),
  ];

  // The opening section has no persisted rows, so the only representable
  // spot that tracks the visual row is after the last empty editor.
  assert.deepEqual(agendaMoveTarget(rows, "x", "up"), {
    afterItemId: null,
    section: "opening",
    position: "end",
  });
});

test("moving up swaps with the persisted row directly above a phantom gap", () => {
  const rows = [
    emptySlot("opening_hymn", "opening"),
    persisted("prayer", "opening", { type: "prayer" }),
    persisted("x", "business"),
  ];

  assert.deepEqual(agendaMoveTarget(rows, "x", "up"), {
    afterItemId: null,
    section: "opening",
  });
});

test("moving up over a same-section empty editor targets the section start", () => {
  const rows = [
    emptySlot("sacrament_hymn", "sacrament"),
    persisted("blesser", "sacrament", { type: "sacrament_blessing" }),
  ];

  assert.deepEqual(agendaMoveTarget(rows, "blesser", "up"), {
    afterItemId: null,
    section: "sacrament",
  });
});

test("moving down requires a persisted anchor below", () => {
  const rows = [
    persisted("a", "opening"),
    emptySlot("opening_hymn", "opening"),
  ];

  assert.equal(agendaMoveTarget(rows, "a", "down"), null);
  assert.deepEqual(
    agendaMoveTarget(
      [persisted("a"), emptySlot("opening_hymn", "opening"), persisted("c")],
      "a",
      "down",
    ),
    { afterItemId: "c" },
  );
  assert.deepEqual(agendaMoveTarget([persisted("a"), persisted("b")], "a", "down"), {
    afterItemId: "b",
  });
});

test("move targets resolve over the built agenda rows", () => {
  const meetingItems = [
    item({ id: "talk-1", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "talk-2", createdAt: "2025-01-02T00:00:00.000Z" }),
    item({ id: "custom", type: "custom_program", content: "Special" }),
  ];
  const rows = buildAgendaRows(meeting({ items: meetingItems }));

  assert.deepEqual(agendaMoveTarget(rows, "custom", "up"), {
    afterItemId: "talk-1",
  });
  assert.deepEqual(agendaMoveTarget(rows, "talk-1", "down"), {
    afterItemId: "talk-2",
  });
});

test("move targets return null for unknown items", () => {
  assert.equal(agendaMoveTarget([persisted("a")], "nope", "up"), null);
  assert.equal(agendaMoveTarget([persisted("a")], "nope", "down"), null);
});
