import assert from "node:assert/strict";
import test from "node:test";
import {
  moveAgendaItems,
  isAutoDeletableItem,
  isItemDataEmpty,
  sortSundayItems,
} from "./order.ts";
import { standardAgendaForMeeting, slotAllowsItemType } from "./templates.ts";
import { parseItemMetadata } from "./types.ts";

const rows = (...types) =>
  types.map((type, orderIndex) => ({
    id: `${type}-${orderIndex}`,
    type,
    section: "program",
    orderIndex,
    slot: null,
  }));
const ids = (items) => items.map((item) => item.id);

test("explicit positions win over type and creation order", () => {
  const items = rows("talk", "hymn", "talk");
  assert.deepEqual(ids(sortSundayItems(items.toReversed())), ids(items));
});

test("repeated up/down moves remain sequential and reversible", () => {
  const original = rows("talk", "hymn", "talk", "custom_program");
  let items = original;
  for (let cycle = 0; cycle < 200; cycle++) {
    items = moveAgendaItems(items, original[3].id, {
      direction: "up",
      showSupportText: false,
    });
    assert.deepEqual(ids(items), [
      original[0].id,
      original[1].id,
      original[3].id,
      original[2].id,
    ]);
    items = moveAgendaItems(items, original[3].id, {
      direction: "down",
      showSupportText: false,
    });
    assert.deepEqual(ids(items), ids(original));
    assert.deepEqual(
      items.map((item) => item.orderIndex),
      [0, 1, 2, 3],
    );
  }
});

test("hidden wording moves with the following visible entry", () => {
  const items = rows("talk", "conductor_text", "talk");
  const result = moveAgendaItems(items, "talk-2", {
    direction: "up",
    showSupportText: false,
  });
  assert.deepEqual(ids(result), ["conductor_text-1", "talk-2", "talk-0"]);
  const shown = moveAgendaItems(items, "talk-2", {
    direction: "up",
    showSupportText: true,
  });
  assert.deepEqual(ids(shown), ["talk-0", "talk-2", "conductor_text-1"]);
});

test("trailing hidden wording travels with the last visible entry", () => {
  const result = moveAgendaItems(
    rows("talk", "talk", "conductor_text"),
    "talk-1",
    { direction: "up", showSupportText: false },
  );
  assert.deepEqual(ids(result), ["talk-1", "conductor_text-2", "talk-0"]);
});

test("arrows stop at section boundaries; explicit section moves append", () => {
  const items = [
    ...rows("talk"),
    { ...rows("hymn")[0], section: "closing", slot: "closing_hymn" },
  ];
  assert.equal(
    moveAgendaItems(items, "talk-0", {
      direction: "down",
      showSupportText: false,
    }),
    null,
  );
  const result = moveAgendaItems(items, "talk-0", {
    section: "closing",
    showSupportText: false,
  });
  assert.deepEqual(ids(result), ["hymn-0", "talk-0"]);
  assert.deepEqual(
    result.map((item) => item.orderIndex),
    [0, 1],
  );
  assert.equal(
    moveAgendaItems(items, "hymn-0", {
      section: "program",
      showSupportText: true,
    }),
    null,
  );
  assert.equal(
    moveAgendaItems(items, "talk-0", {
      section: "participants",
      showSupportText: true,
    }),
    null,
  );
  assert.equal(
    moveAgendaItems(items, "missing", {
      direction: "up",
      showSupportText: true,
    }),
    null,
  );
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
  assert.equal(
    isItemDataEmpty({ ...empty, metadata: { hymnNumber: undefined } }),
    true,
  );
  assert.equal(isItemDataEmpty({ ...empty, content: "Topic" }), false);
  assert.equal(
    isItemDataEmpty({ ...empty, metadata: { hymnNumber: 12 } }),
    false,
  );
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
  assert.equal(
    isAutoDeletableItem({ ...empty, slot: "opening_prayer" }),
    false,
  );
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

test("standard agendas differ per meeting type", () => {
  assert.deepEqual(
    standardAgendaForMeeting("sacrament").map((entry) => entry.slot),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "sacrament_blessing",
      "sacrament_passing",
      "interlude",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(
    standardAgendaForMeeting("fast_testimony").map((entry) => entry.slot),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "sacrament_blessing",
      "sacrament_passing",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(
    standardAgendaForMeeting("childrens_sacrament_presentation").map(
      (entry) => entry.slot,
    ),
    [
      "opening_hymn",
      "opening_prayer",
      "sacrament_hymn",
      "sacrament_blessing",
      "sacrament_passing",
      "primary_presentation",
      "closing_hymn",
      "closing_prayer",
    ],
  );
  assert.deepEqual(standardAgendaForMeeting("stake_conference"), []);
  assert.deepEqual(standardAgendaForMeeting("general_conference"), []);
});

test("slots restrict the item types they accept", () => {
  assert.equal(slotAllowsItemType("opening_hymn", "hymn"), true);
  assert.equal(slotAllowsItemType("opening_hymn", "musical_number"), false);
  assert.equal(slotAllowsItemType("interlude", "musical_number"), true);
  assert.equal(slotAllowsItemType("interlude", "hymn"), true);
  assert.equal(slotAllowsItemType("interlude", "talk"), false);
  assert.equal(
    slotAllowsItemType("primary_presentation", "primary_presentation"),
    true,
  );
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
  assert.deepEqual(parseItemMetadata('{"hymnNumber": 123}'), {
    hymnNumber: 123,
  });
  assert.deepEqual(parseItemMetadata("{}"), null);
  // Unknown keys and invalid value types are dropped.
  assert.deepEqual(parseItemMetadata('{"hymnNumber": 5, "junk": "x"}'), {
    hymnNumber: 5,
  });
  assert.deepEqual(parseItemMetadata('{"hymnNumber": "12"}'), null);
});
