import assert from "node:assert/strict";
import test from "node:test";
import {
  RANK_STEP,
  computeMovePlan,
  isAutoDeletableItem,
  isItemDataEmpty,
  sortKey,
  sortSundayItems,
} from "./order.ts";
import {
  SECTION_ORDER,
  SECTION_TYPE_ORDER,
  defaultRank,
  slotAllowsItemType,
  virtualAgendaForMeeting,
} from "./templates.ts";
import { parseItemMetadata } from "./types.ts";

const item = (overrides = {}) => ({
  id: overrides.id ?? "item-1",
  type: overrides.type ?? "talk",
  section: overrides.section ?? "program",
  orderIndex: overrides.orderIndex ?? null,
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
});

test("items sort by default type rank within each section", () => {
  const sorted = sortSundayItems([
    item({ id: "a", type: "prayer", section: "opening" }),
    item({ id: "b", type: "hymn", section: "opening" }),
    item({ id: "c", type: "announcement", section: "opening" }),
    item({ id: "d", type: "sacrament_passing", section: "sacrament" }),
    item({ id: "e", type: "sacrament_blessing", section: "sacrament" }),
    item({ id: "f", type: "hymn", section: "sacrament" }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["c", "b", "a", "f", "e", "d"],
  );
});

test("sections order participants through closing", () => {
  const sorted = sortSundayItems([
    item({ id: "closing", section: "closing", type: "prayer" }),
    item({ id: "opening", section: "opening", type: "hymn" }),
    item({ id: "participants", section: "participants", type: "leader" }),
    item({ id: "program", section: "program", type: "talk" }),
    item({ id: "business", section: "business", type: "ward_business" }),
    item({ id: "sacrament", section: "sacrament", type: "sacrament_blessing" }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.section),
    ["participants", "opening", "business", "sacrament", "program", "closing"],
  );
  assert.equal(SECTION_ORDER.participants, 0);
  assert.equal(SECTION_ORDER.closing, 5);
});

test("equal-rank items tie-break by createdAt then id", () => {
  const sorted = sortSundayItems([
    item({ id: "b", type: "talk", createdAt: "2025-01-02T00:00:00.000Z" }),
    item({ id: "a", type: "talk", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "d", type: "talk", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "c", type: "talk", createdAt: "2025-01-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["a", "c", "d", "b"],
  );
});

test("an order_index override wins over the default rank", () => {
  const sorted = sortSundayItems([
    item({ id: "hymn", type: "hymn", section: "program" }),
    item({ id: "musical", type: "musical_number", section: "program" }),
    item({ id: "custom", type: "custom_program", section: "program" }),
    item({ id: "override", type: "talk", section: "program", orderIndex: 150 }),
    item({ id: "talk", type: "talk", section: "program" }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["hymn", "musical", "override", "talk", "custom"],
  );
});

test("unlisted types sort after listed types by creation order", () => {
  const sorted = sortSundayItems([
    item({
      id: "transition-new",
      type: "transition",
      section: "program",
      createdAt: "2025-03-01T00:00:00.000Z",
    }),
    item({ id: "talk", type: "talk", section: "program" }),
    item({
      id: "transition-old",
      type: "transition",
      section: "program",
      createdAt: "2025-02-01T00:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["talk", "transition-old", "transition-new"],
  );
});

test("sortKey uses orderIndex or the default rank step", () => {
  assert.equal(sortKey({ type: "talk", section: "program", orderIndex: null }), 2 * RANK_STEP);
  assert.equal(sortKey({ type: "hymn", section: "opening", orderIndex: null }), 1 * RANK_STEP);
  assert.equal(sortKey({ type: "talk", section: "program", orderIndex: 42 }), 42);
});

test("defaultRank is the 0-based list index or one past the end when absent", () => {
  assert.equal(defaultRank("opening", "announcement"), 0);
  assert.equal(defaultRank("opening", "prayer"), 2);
  assert.equal(defaultRank("opening", "transition"), SECTION_TYPE_ORDER.opening.length + 1);
  assert.equal(defaultRank("participants", "leader"), 0);
  assert.equal(defaultRank("participants", "presiding"), 1);
});

test("computeMovePlan places an item midway between same-section neighbours", () => {
  const items = [
    item({ id: "hymn", type: "hymn", section: "program" }),
    item({ id: "musical", type: "musical_number", section: "program" }),
    item({ id: "talk", type: "talk", section: "program" }),
    item({ id: "closing-prayer", type: "prayer", section: "closing" }),
  ];

  assert.deepEqual(computeMovePlan(items, "moved", "hymn", "program"), {
    orderIndex: 50,
    rekeys: [],
  });
  assert.deepEqual(computeMovePlan(items, "moved", "musical", "program"), {
    orderIndex: 150,
    rekeys: [],
  });
});

test("computeMovePlan after the last item of a section stays close", () => {
  const items = [
    item({ id: "hymn", type: "hymn", section: "program", orderIndex: 10 }),
    item({ id: "closing-prayer", type: "prayer", section: "closing" }),
  ];

  assert.deepEqual(computeMovePlan(items, "moved", "hymn", "program"), {
    orderIndex: 11,
    rekeys: [],
  });
});

test("computeMovePlan with a null anchor targets the section start", () => {
  const items = [
    item({ id: "musical", type: "musical_number", section: "program", orderIndex: 100 }),
    item({ id: "closing-prayer", type: "prayer", section: "closing" }),
  ];

  assert.deepEqual(computeMovePlan(items, "moved", null, "program"), {
    orderIndex: 99,
    rekeys: [],
  });
  assert.deepEqual(computeMovePlan([], "moved", null, "program"), {
    orderIndex: -1,
    rekeys: [],
  });
});

test("computeMovePlan re-keys tied neighbours instead of overshooting", () => {
  // Three talks tied at the default key; creation order A, B, C.
  const talks = [
    item({ id: "a", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "b", createdAt: "2025-01-02T00:00:00.000Z" }),
    item({ id: "c", createdAt: "2025-01-03T00:00:00.000Z" }),
  ];

  const moveDown = computeMovePlan(talks, "a", "b", "program");
  assert.deepEqual(moveDown.rekeys.map((rekey) => rekey.id), ["c"]);
  const afterDown = sortSundayItems([
    ...talks
      .filter((entry) => entry.id !== "a")
      .map((entry) =>
        entry.id === "c"
          ? { ...entry, orderIndex: moveDown.rekeys[0].orderIndex }
          : entry,
      ),
    { ...talks[0], orderIndex: moveDown.orderIndex },
  ]);
  assert.deepEqual(
    afterDown.map((entry) => entry.id),
    ["b", "a", "c"],
  );

  const moveUp = computeMovePlan(talks, "c", "a", "program");
  assert.deepEqual(moveUp.rekeys.map((rekey) => rekey.id), ["b"]);
  const afterUp = sortSundayItems([
    ...talks
      .filter((entry) => entry.id !== "c")
      .map((entry) =>
        entry.id === "b"
          ? { ...entry, orderIndex: moveUp.rekeys[0].orderIndex }
          : entry,
      ),
    { ...talks[2], orderIndex: moveUp.orderIndex },
  ]);
  assert.deepEqual(
    afterUp.map((entry) => entry.id),
    ["a", "c", "b"],
  );
});

test("computeMovePlan re-keys a whole tie chain, preserving its order", () => {
  const talks = [
    item({ id: "a", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "b", createdAt: "2025-01-02T00:00:00.000Z" }),
    item({ id: "c", createdAt: "2025-01-03T00:00:00.000Z" }),
    item({ id: "d", createdAt: "2025-01-04T00:00:00.000Z" }),
  ];

  const plan = computeMovePlan(talks, "c", "a", "program");
  assert.deepEqual(plan.rekeys.map((rekey) => rekey.id), ["b", "d"]);
  const after = sortSundayItems([
    item({ id: "a", createdAt: "2025-01-01T00:00:00.000Z" }),
    { ...talks[2], orderIndex: plan.orderIndex },
    ...plan.rekeys.map((rekey, index) => ({
      ...talks.find((entry) => entry.id === rekey.id),
      orderIndex: plan.rekeys[index].orderIndex,
    })),
  ]);
  assert.deepEqual(
    after.map((entry) => entry.id),
    ["a", "c", "b", "d"],
  );
});

test("computeMovePlan spreads a tie chain between the anchor and the next distinct key", () => {
  const realistic = [
    item({ id: "musical", type: "musical_number", section: "program" }),
    item({ id: "a", type: "talk", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "b", type: "talk", createdAt: "2025-01-02T00:00:00.000Z" }),
    item({ id: "custom", type: "custom_program", section: "program" }),
  ];
  const spread = computeMovePlan(realistic, "moved", "a", "program");
  assert.deepEqual(spread.rekeys.map((rekey) => rekey.id), ["b"]);
  // Anchor key 200 (talk), next distinct key 400 (custom program) → step
  // (400 - 200) / (1 chain item + 2) for the moved item and re-keyed chain.
  assert.equal(spread.orderIndex, 200 + 200 / 3);
  assert.equal(spread.rekeys[0].orderIndex, 200 + (2 * 200) / 3);
});

test("computeMovePlan rejects unknown anchors and float degeneracies", () => {
  assert.equal(
    computeMovePlan([item({ id: "a" })], "moved", "missing", "program"),
    null,
  );

  // (0 + Number.MIN_VALUE) / 2 rounds to 0 → the position is unrepresentable.
  const degenerate = [
    item({ id: "anchor", orderIndex: 0 }),
    item({ id: "next", orderIndex: Number.MIN_VALUE }),
  ];
  assert.equal(computeMovePlan(degenerate, "moved", "anchor", "program"), null);
});

test("isItemDataEmpty detects rows without user data", () => {
  const empty = {
    type: "talk",
    content: null,
    metadata: null,
    personMemberId: null,
    personName: null,
  };
  assert.equal(isItemDataEmpty(empty), true);
  assert.equal(isItemDataEmpty({ ...empty, content: "   " }), true);
  assert.equal(isItemDataEmpty({ ...empty, metadata: {} }), true);
  assert.equal(isItemDataEmpty({ ...empty, metadata: { hymnNumber: undefined } }), true);
  assert.equal(isItemDataEmpty({ ...empty, content: "Topic" }), false);
  assert.equal(isItemDataEmpty({ ...empty, metadata: { hymnNumber: 12 } }), false);
  assert.equal(isItemDataEmpty({ ...empty, personMemberId: "m1" }), false);
  assert.equal(isItemDataEmpty({ ...empty, personName: "Jane" }), false);
});

test("isAutoDeletableItem exempts transitions and task links", () => {
  const empty = {
    type: "talk",
    content: null,
    metadata: null,
    personMemberId: null,
    personName: null,
    taskId: null,
  };
  assert.equal(isAutoDeletableItem(empty), true);
  // A transition row is managed only by explicit user action.
  assert.equal(isAutoDeletableItem({ ...empty, type: "transition" }), false);
  // A task link counts as data; clearing people or text keeps the row.
  assert.equal(isAutoDeletableItem({ ...empty, taskId: "t1" }), false);
  assert.equal(
    isAutoDeletableItem({ ...empty, type: "calling_sustain", taskId: "t1" }),
    false,
  );
  assert.equal(isAutoDeletableItem({ ...empty, personName: "Jane" }), false);
});

test("virtual agendas differ per meeting type", () => {
  assert.deepEqual(
    virtualAgendaForMeeting("sacrament").map((entry) => entry.slot),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "interlude",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(
    virtualAgendaForMeeting("fast_testimony").map((entry) => entry.slot),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(
    virtualAgendaForMeeting("childrens_sacrament_presentation").map((entry) => entry.slot),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "primary_presentation",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(virtualAgendaForMeeting("stake_conference"), []);
  assert.deepEqual(virtualAgendaForMeeting("general_conference"), []);
});

test("slots restrict the item types they accept", () => {
  assert.equal(slotAllowsItemType("opening_hymn", "hymn"), true);
  assert.equal(slotAllowsItemType("opening_hymn", "musical_number"), false);
  assert.equal(slotAllowsItemType("interlude", "musical_number"), true);
  assert.equal(slotAllowsItemType("interlude", "hymn"), true);
  assert.equal(slotAllowsItemType("interlude", "talk"), false);
  assert.equal(slotAllowsItemType("primary_presentation", "primary_presentation"), true);
  assert.equal(slotAllowsItemType("primary_presentation", "talk"), false);
  assert.equal(slotAllowsItemType("opening_prayer", "prayer"), true);
  assert.equal(slotAllowsItemType("closing_prayer", "hymn"), false);
});

test("parseItemMetadata safely parses JSON objects and keeps only known keys", () => {
  assert.deepEqual(parseItemMetadata(null), null);
  assert.deepEqual(parseItemMetadata(""), null);
  assert.deepEqual(parseItemMetadata("not json"), null);
  assert.deepEqual(parseItemMetadata("[1,2]"), null);
  assert.deepEqual(parseItemMetadata('"text"'), null);
  assert.deepEqual(parseItemMetadata('{"hymnNumber": 123}'), { hymnNumber: 123 });
  assert.deepEqual(parseItemMetadata("{}"), null);
  // Unknown keys and invalid value types are dropped.
  assert.deepEqual(
    parseItemMetadata('{"hymnNumber": 5, "junk": "x"}'),
    { hymnNumber: 5 },
  );
  assert.deepEqual(parseItemMetadata('{"hymnNumber": "12"}'), null);
});
