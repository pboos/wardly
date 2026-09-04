import assert from "node:assert/strict";
import test from "node:test";
import {
  findSlotItem,
  leaderOfMeeting,
  participantsByType,
  presiderOfMeeting,
  speakersOfMeeting,
} from "./slots.ts";

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

const standardMeetingItems = () => [
  item({ id: "opening-hymn", type: "hymn", section: "opening" }),
  item({ id: "opening-prayer", type: "prayer", section: "opening" }),
  item({ id: "announcement", type: "announcement", section: "opening" }),
  item({ id: "sacrament-hymn", type: "hymn", section: "sacrament" }),
  item({ id: "interlude-hymn", type: "hymn", section: "program" }),
  item({ id: "talk-1", type: "talk", section: "program" }),
  item({ id: "closing-hymn", type: "hymn", section: "closing" }),
  item({ id: "closing-prayer", type: "prayer", section: "closing" }),
];

test("findSlotItem resolves the standard hymn and prayer slots by section", () => {
  const items = standardMeetingItems();

  assert.equal(findSlotItem(items, "opening_hymn")?.id, "opening-hymn");
  assert.equal(findSlotItem(items, "opening_prayer")?.id, "opening-prayer");
  assert.equal(findSlotItem(items, "sacrament_hymn")?.id, "sacrament-hymn");
  assert.equal(findSlotItem(items, "closing_hymn")?.id, "closing-hymn");
  assert.equal(findSlotItem(items, "closing_prayer")?.id, "closing-prayer");
});

test("findSlotItem ignores same-type items outside the slot section", () => {
  const items = [
    item({ id: "program-hymn", type: "hymn", section: "program" }),
    item({ id: "program-prayer", type: "prayer", section: "program" }),
  ];

  assert.equal(findSlotItem(items, "opening_hymn"), undefined);
  assert.equal(findSlotItem(items, "opening_prayer"), undefined);
  assert.equal(findSlotItem(items, "sacrament_hymn"), undefined);
  assert.equal(findSlotItem(items, "closing_hymn"), undefined);
  assert.equal(findSlotItem(items, "closing_prayer"), undefined);
  assert.equal(findSlotItem(items, "interlude")?.id, "program-hymn");
  assert.equal(findSlotItem([], "opening_hymn"), undefined);
});

test("findSlotItem sorts defensively and picks the first item in final order", () => {
  // Created later but parked at the section start via an order override.
  const items = [
    item({
      id: "hymn-later",
      type: "hymn",
      section: "opening",
      createdAt: "2025-02-01T00:00:00.000Z",
    }),
    item({
      id: "hymn-first",
      type: "hymn",
      section: "opening",
      orderIndex: -5,
      createdAt: "2025-03-01T00:00:00.000Z",
    }),
    item({
      id: "hymn-default",
      type: "hymn",
      section: "opening",
      createdAt: "2025-01-01T00:00:00.000Z",
    }),
  ];

  assert.equal(findSlotItem(items, "opening_hymn")?.id, "hymn-first");

  // Without overrides, creation order breaks the rank tie.
  const byCreation = [
    item({
      id: "hymn-newest",
      type: "hymn",
      section: "opening",
      createdAt: "2025-03-01T00:00:00.000Z",
    }),
    item({
      id: "hymn-oldest",
      type: "hymn",
      section: "opening",
      createdAt: "2025-01-01T00:00:00.000Z",
    }),
  ];
  assert.equal(findSlotItem(byCreation, "opening_hymn")?.id, "hymn-oldest");
});

test("the interlude slot accepts the first hymn or musical number in the program", () => {
  const withBoth = [
    item({ id: "musical", type: "musical_number", section: "program" }),
    item({ id: "hymn", type: "hymn", section: "program" }),
  ];
  assert.equal(findSlotItem(withBoth, "interlude")?.id, "hymn");

  const withMusicalOnly = [
    item({ id: "musical", type: "musical_number", section: "program" }),
  ];
  assert.equal(findSlotItem(withMusicalOnly, "interlude")?.id, "musical");

  const overridden = [
    item({ id: "hymn", type: "hymn", section: "program" }),
    item({
      id: "musical-first",
      type: "musical_number",
      section: "program",
      orderIndex: -10,
    }),
  ];
  assert.equal(findSlotItem(overridden, "interlude")?.id, "musical-first");

  const openingOnly = [item({ id: "hymn", type: "hymn", section: "opening" })];
  assert.equal(findSlotItem(openingOnly, "interlude"), undefined);
});

test("the primary presentation slot resolves from the program section", () => {
  const items = [
    item({ id: "presentation", type: "primary_presentation", section: "program" }),
    item({ id: "opening-hymn", type: "hymn", section: "opening" }),
  ];
  assert.equal(findSlotItem(items, "primary_presentation")?.id, "presentation");
  assert.equal(
    findSlotItem(
      [item({ id: "custom", type: "primary_presentation", section: "closing" })],
      "primary_presentation",
    ),
    undefined,
  );
});

test("speakersOfMeeting lists program talks in final order", () => {
  const items = [
    item({ id: "talk-b", type: "talk", section: "program", createdAt: "2025-02-01T00:00:00.000Z" }),
    item({ id: "talk-a", type: "talk", section: "program", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "talk-moved", type: "talk", section: "program", orderIndex: -3, createdAt: "2025-03-01T00:00:00.000Z" }),
    item({ id: "talk-business", type: "talk", section: "business" }),
    item({ id: "hymn", type: "hymn", section: "program" }),
  ];

  assert.deepEqual(
    speakersOfMeeting(items).map((talk) => talk.id),
    ["talk-moved", "talk-a", "talk-b"],
  );
  assert.deepEqual(speakersOfMeeting([]), []);
});

test("participantsByType returns items of the type in final order", () => {
  const items = [
    item({ id: "organist-b", type: "organist", section: "participants", createdAt: "2025-02-01T00:00:00.000Z" }),
    item({ id: "organist-a", type: "organist", section: "participants", createdAt: "2025-01-01T00:00:00.000Z" }),
    item({ id: "leader", type: "leader", section: "participants" }),
    item({ id: "visitor", type: "visitor", section: "participants" }),
    item({ id: "hymn", type: "hymn", section: "opening" }),
  ];

  assert.deepEqual(
    participantsByType(items, "organist").map((entry) => entry.id),
    ["organist-a", "organist-b"],
  );
  assert.deepEqual(participantsByType(items, "visitor").map((entry) => entry.id), [
    "visitor",
  ]);
  assert.deepEqual(participantsByType(items, "music_conductor"), []);
});

test("leaderOfMeeting and presiderOfMeeting find the participant rows", () => {
  const items = [
    item({ id: "leader", type: "leader", section: "participants" }),
    item({ id: "presiding", type: "presiding", section: "participants" }),
  ];
  assert.equal(leaderOfMeeting(items)?.id, "leader");
  assert.equal(presiderOfMeeting(items)?.id, "presiding");

  const empty = [item({ id: "organist", type: "organist", section: "participants" })];
  assert.equal(leaderOfMeeting(empty), undefined);
  assert.equal(presiderOfMeeting(empty), undefined);
  assert.equal(leaderOfMeeting([]), undefined);
  assert.equal(presiderOfMeeting([]), undefined);
});
