import assert from "node:assert/strict";
import test from "node:test";
import {
  findSlotItem,
  speakersOfMeeting,
  participantsByType,
  leaderOfMeeting,
  presiderOfMeeting,
} from "./slots.ts";
import { moveAgendaItems } from "./order.ts";
const item = (id, type, section, orderIndex, slot = null) => ({
  id,
  type,
  section,
  orderIndex,
  slot,
});

test("reordering another hymn before the opening hymn never changes slot identity", () => {
  const items = [
    item("opening", "hymn", "opening", 0, "opening_hymn"),
    item("extra", "hymn", "opening", 1),
  ];
  const moved = moveAgendaItems(items, "extra", {
    direction: "up",
    showSupportText: false,
  });
  assert.equal(moved[0].id, "extra");
  assert.equal(findSlotItem(moved, "opening_hymn").id, "opening");
  assert.equal(findSlotItem([items[1]], "opening_hymn"), undefined);
});

test("interlude identity survives hymn/musical-number changes", () => {
  for (const type of ["hymn", "musical_number"]) {
    assert.equal(
      findSlotItem(
        [
          item("extra", "hymn", "program", 0),
          item("interlude", type, "program", 1, "interlude"),
        ],
        "interlude",
      ).id,
      "interlude",
    );
  }
});

test("speakers and participants use saved order", () => {
  const items = [
    item("b", "talk", "program", 0),
    item("a", "talk", "program", 1),
    item("other", "talk", "business", 0),
    item("organist", "organist", "participants", 0),
    item("leader", "leader", "participants", 1),
    item("presider", "presiding", "participants", 2),
  ];
  assert.deepEqual(
    speakersOfMeeting(items).map((entry) => entry.id),
    ["b", "a"],
  );
  assert.deepEqual(
    participantsByType(items, "organist").map((entry) => entry.id),
    ["organist"],
  );
  assert.equal(leaderOfMeeting(items).id, "leader");
  assert.equal(presiderOfMeeting(items).id, "presider");
  assert.equal(leaderOfMeeting([]), undefined);
});
