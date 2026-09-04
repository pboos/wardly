import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHymnNumber,
  assertNoAdjacentConductorText,
  assertTransitionEmpty,
  MAX_HYMN_NUMBER,
  MAX_ITEM_TEXT_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  resolvePersonInput,
  serializeMetadata,
  trimmedOrNullCapped,
} from "./rules.ts";

test("resolvePersonInput allows member or free text, never both", () => {
  assert.deepEqual(resolvePersonInput(null), {
    memberId: null,
    personName: null,
  });
  assert.deepEqual(
    resolvePersonInput({ memberId: "m1", personName: null }),
    { memberId: "m1", personName: null },
  );
  assert.deepEqual(
    resolvePersonInput({ memberId: null, personName: "  Jane  " }),
    { memberId: null, personName: "Jane" },
  );
  assert.deepEqual(
    resolvePersonInput({ memberId: "  ", personName: " " }),
    { memberId: null, personName: null },
  );
  assert.throws(() =>
    resolvePersonInput({ memberId: "m1", personName: "Jane" }),
  );
  assert.throws(() =>
    resolvePersonInput({
      memberId: null,
      personName: "x".repeat(MAX_PERSON_NAME_LENGTH + 1),
    }),
  );
});

test("assertHymnNumber accepts whole numbers within the bound", () => {
  assert.doesNotThrow(() => assertHymnNumber(null));
  assert.doesNotThrow(() => assertHymnNumber({}));
  assert.doesNotThrow(() => assertHymnNumber({ hymnNumber: 1 }));
  assert.doesNotThrow(() => assertHymnNumber({ hymnNumber: MAX_HYMN_NUMBER }));
  assert.throws(() => assertHymnNumber({ hymnNumber: 0 }));
  assert.throws(() => assertHymnNumber({ hymnNumber: -3 }));
  assert.throws(() => assertHymnNumber({ hymnNumber: 1.5 }));
  // 1e308 is an integer but not a safe one; MAX + 1 exceeds the bound.
  assert.throws(() => assertHymnNumber({ hymnNumber: 1e308 }));
  assert.throws(() => assertHymnNumber({ hymnNumber: MAX_HYMN_NUMBER + 1 }));
});

test("serializeMetadata persists only the hymn number", () => {
  assert.equal(serializeMetadata(null), null);
  assert.equal(serializeMetadata({}), null);
  assert.equal(serializeMetadata({ hymnNumber: null }), null);
  assert.equal(serializeMetadata({ hymnNumber: 12 }), '{"hymnNumber":12}');
  // Unknown client keys are dropped, not persisted.
  assert.equal(
    serializeMetadata({ hymnNumber: 12, junk: "x".repeat(1000) }),
    '{"hymnNumber":12}',
  );
  assert.equal(serializeMetadata({ junk: "x" }), null);
});

test("trimmedOrNullCapped enforces the maximum length", () => {
  assert.equal(trimmedOrNullCapped(null, 10, "Text"), null);
  assert.equal(trimmedOrNullCapped("  hi  ", 10, "Text"), "hi");
  assert.equal(
    trimmedOrNullCapped("x".repeat(MAX_ITEM_TEXT_LENGTH), MAX_ITEM_TEXT_LENGTH, "Text"),
    "x".repeat(MAX_ITEM_TEXT_LENGTH),
  );
  assert.throws(() =>
    trimmedOrNullCapped(
      "x".repeat(MAX_ITEM_TEXT_LENGTH + 1),
      MAX_ITEM_TEXT_LENGTH,
      "Text",
    ),
  );
});

test("assertTransitionEmpty rejects any data on a transition", () => {
  const nobody = { memberId: null, personName: null };
  assert.doesNotThrow(() =>
    assertTransitionEmpty("transition", null, null, nobody),
  );
  assert.throws(() =>
    assertTransitionEmpty("transition", "Text", null, nobody),
  );
  assert.throws(() =>
    assertTransitionEmpty("transition", null, '{"hymnNumber":1}', nobody),
  );
  assert.throws(() =>
    assertTransitionEmpty("transition", null, null, { memberId: "m1", personName: null }),
  );
  assert.doesNotThrow(() =>
    assertTransitionEmpty("announcement", "Text", null, nobody),
  );
});

test("assertNoAdjacentConductorText checks the final order", () => {
  const row = (id, type, section, orderIndex, createdAt) => ({
    id,
    type,
    section,
    orderIndex,
    createdAt,
  });
  const conductor = (id, n, orderIndex = null) =>
    row(id, "conductor_text", "program", orderIndex, `2025-01-0${n}T00:00:00.000Z`);
  const talk = (id, n, orderIndex = null) =>
    row(id, "talk", "program", orderIndex, `2025-01-0${n}T00:00:00.000Z`);

  assert.doesNotThrow(() =>
    assertNoAdjacentConductorText([conductor("a", 1), talk("b", 2)]),
  );
  assert.throws(() =>
    assertNoAdjacentConductorText([conductor("a", 1), conductor("b", 2)]),
  );
  // An item in between (by sort key) keeps them non-adjacent.
  assert.doesNotThrow(() =>
    assertNoAdjacentConductorText([
      conductor("a", 1, 25),
      talk("b", 2, 50),
      conductor("c", 3, 150),
    ]),
  );
  // Consecutive in the final order counts even across sections.
  assert.throws(() =>
    assertNoAdjacentConductorText([
      conductor("a", 1),
      { ...conductor("b", 2), section: "closing" },
    ]),
  );
});
