import assert from "node:assert/strict";
import test from "node:test";
import { buildHymnHistory, hymnChoices } from "./hymns.ts";

test("hymn history uses the latest recorded date strictly before local today", () => {
  const item = (number, date) => ({
    metadata: JSON.stringify({ hymnNumber: number }),
    sunday_meeting: { date },
  });
  assert.deepEqual(
    buildHymnHistory(
      [
        item(1, "2026-09-06"),
        item(1, "2026-08-30"),
        item(1, "2026-09-13"),
        item(1, "2026-09-20"),
        item(2, "2026-08-23"),
        { metadata: "invalid", sunday_meeting: { date: "2026-08-23" } },
      ],
      "2026-09-13",
    ),
    { 1: "2026-09-06", 2: "2026-08-23" },
  );
});

test("number completion prioritizes exact matches and preserves catalog gaps", () => {
  const hymns = [110, 11, 1, 10, 1001].map((number) => ({
    number,
    title: `Title ${number}`,
    collection: "hymns",
  }));
  assert.deepEqual(
    hymnChoices(hymns, " 01 ").map((hymn) => hymn.number),
    [1, 10, 11, 110, 1001],
  );
  assert.deepEqual(
    hymnChoices(hymns, "11").map((hymn) => hymn.number),
    [11, 110],
  );
  for (const query of ["", "words", "1.5", "-1", "9999"])
    assert.deepEqual(hymnChoices(hymns, query), []);
});
